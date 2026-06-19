import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { EngineRegistry } from './engines/engine.registry';
import type {
  EngineClient,
  EngineKey,
  TelegramMe,
} from './engines/engine.types';
import { InstancesService } from './services/instances.service';
import { SettingsService } from './services/settings.service';
import { TelegramSessionStore } from './telegram-session.store';
import { TelegramSyncService } from './services/telegram-sync.service';
import { TelegramEventBus } from './services/telegram-events.service';
import type { InstanceStatus } from './telegram.constants';
import type { EngineConfig } from './engines/engine.types';
import type { TelegramInstance } from './telegram.constants';
import type { PhoneLoginStepResult } from './telegram.constants';
import { isSessionRevokedError, sessionRevokedMessage } from './session-errors';

// How often a live client is probed (isAuthorized + getMe) to detect a
// session revoked remotely from the Telegram app. Lower = snappier status,
// at the cost of a lightweight RPC per instance per tick.
const SESSION_HEALTH_INTERVAL_MS = 15_000;

export interface InstancesSummary {
  enabled: boolean;
  total: number;
  connected: number;
  engines: EngineKey[];
}

/** Events streamed to the dashboard during a QR login attempt. */
export type QrLoginEvent =
  | { type: 'qr'; url: string; expires: number }
  | { type: 'password_required' }
  | { type: 'authorized'; me: TelegramMe }
  | { type: 'error'; message: string };

/**
 * Owns the live instance clients and their lifecycle, engine-agnostically.
 *
 * The actual Telegram work (connecting, QR login, session serialization) is
 * delegated to the engine resolved from each instance's `engine` field, so new
 * engines (e.g. Telegraf) can be added without touching this class. On boot it
 * rehydrates every instance that has a saved session and reconnects it, so
 * authorized accounts survive restarts; it disconnects them on shutdown.
 */
@Injectable()
export class TelegramManager
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(TelegramManager.name);
  private readonly clients = new Map<string, EngineClient>();
  private readonly connectedAt = new Map<string, number>();
  private readonly pendingPasswords = new Map<string, (pwd: string) => void>();
  private readonly pendingPhoneCodes = new Map<
    string,
    (code: string) => void
  >();
  private readonly phoneLoginClients = new Map<string, EngineClient>();
  private readonly phoneLoginSteps = new Map<
    string,
    {
      resolve: (result: PhoneLoginStepResult) => void;
      reject: (err: Error) => void;
    }
  >();
  private readonly phoneCodeSent = new Map<string, () => void>();
  private readonly healthTimers = new Map<
    string,
    ReturnType<typeof setInterval>
  >();
  private readonly sessionLostBusy = new Set<string>();
  private readonly sessionErrorMessages = new Map<string, string>();

  constructor(
    private readonly registry: EngineRegistry,
    private readonly instances: InstancesService,
    private readonly settings: SettingsService,
    private readonly session: TelegramSessionStore,
    private readonly sync: TelegramSyncService,
    private readonly events: TelegramEventBus,
  ) {}

  /** Publishes a session lifecycle event for webhooks/realtime consumers. */
  private publishStatus(
    instanceId: string,
    status: InstanceStatus,
    extra: Record<string, unknown> = {},
  ): void {
    this.events.publish({
      instanceId,
      type: 'session.status',
      payload: { status, ...extra },
    });
  }

  /** Credentials for an instance: global settings, overridden per-instance. */
  private async resolveConfig(id: string): Promise<EngineConfig> {
    const global = await this.settings.getTelegramCredentials();
    const instance = await this.instances.getCredentials(id);
    return { ...global, ...instance };
  }

  /** True when at least one engine is registered and configured to run. */
  get enabled(): boolean {
    return this.registry.availableKeys().length > 0;
  }

  availableEngines(): EngineKey[] {
    return this.registry.availableKeys();
  }

  isEngineAvailable(key: EngineKey): boolean {
    return this.registry.isAvailable(key);
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.enabled) {
      this.logger.warn(
        'Telegram disabled: no engine is configured (set TELEGRAM_API_ID/HASH for GramJS)',
      );
      return;
    }
    const instances = await this.instances.list();
    for (const instance of instances) {
      await this.restore(instance);
    }
    this.logger.log(`Telegram restored ${this.clients.size} instance(s)`);
  }

  async onModuleDestroy(): Promise<void> {
    for (const timer of this.healthTimers.values()) {
      clearInterval(timer);
    }
    this.healthTimers.clear();
    for (const id of this.clients.keys()) {
      this.sync.stop(id);
    }
    await Promise.all(
      [...this.clients.values()].map((client) =>
        client.disconnect().catch(() => undefined),
      ),
    );
    this.clients.clear();
    this.connectedAt.clear();
  }

  // --- Instance management ---

  createInstance(
    ownerId: string,
    label: string,
    engine?: EngineKey,
    creds?: { apiId?: string; apiHash?: string },
  ): Promise<TelegramInstance> {
    return this.instances.create(ownerId, label, engine, creds);
  }

  listInstances(): Promise<TelegramInstance[]> {
    return this.instances.list();
  }

  getInstance(id: string): Promise<TelegramInstance | null> {
    return this.instances.get(id);
  }

  async removeInstance(id: string): Promise<void> {
    await this.detach(id);
    await this.instances.remove(id);
    await this.session.deleteSession(id);
  }

  getClient(id: string): EngineClient | undefined {
    return this.clients.get(id);
  }

  /** Number of instances with a live connected client. */
  connectedCount(): number {
    return this.clients.size;
  }

  /** Reports RPC errors from messaging; revokes the session when Telegram rejects the auth key. */
  async reportClientError(instanceId: string, error: unknown): Promise<void> {
    if (isSessionRevokedError(error)) {
      await this.handleSessionLost(instanceId, sessionRevokedMessage(error));
    }
  }

  /** Tracks a live client and the moment it connected (for uptime). */
  private attach(id: string, client: EngineClient): void {
    this.clients.set(id, client);
    this.connectedAt.set(id, Date.now());
    this.startHealthCheck(id);
  }

  /** Drops a live client and its connection timestamp. */
  private async detach(id: string): Promise<void> {
    this.stopHealthCheck(id);
    this.sync.stop(id);
    const client = this.clients.get(id);
    if (client) {
      await client.disconnect().catch(() => undefined);
      this.clients.delete(id);
    }
    this.connectedAt.delete(id);
  }

  /** Stops a running instance, keeping its saved session for a later start. */
  async stopInstance(id: string): Promise<void> {
    await this.detach(id);
    await this.instances.update(id, { status: 'disconnected' });
    this.publishStatus(id, 'disconnected');
  }

  /** (Re)connects an instance from its saved session. Re-validates live clients. */
  async startInstance(id: string): Promise<TelegramInstance | null> {
    const instance = await this.instances.get(id);
    if (!instance) {
      return null;
    }
    if (this.clients.has(id)) {
      const healthy = await this.probeClient(id);
      if (healthy) {
        return this.instances.get(id);
      }
      await this.handleSessionLost(
        id,
        'Session was revoked or expired — log in again',
      );
    }
    await this.restore(instance);
    const updated = await this.instances.get(id);
    if (updated?.status === 'error') {
      const message =
        this.sessionErrorMessages.get(id) ??
        'Failed to connect — session may have been revoked. Log in again via QR or phone.';
      throw new Error(message);
    }
    return updated;
  }

  private startHealthCheck(id: string): void {
    this.stopHealthCheck(id);
    const timer = setInterval(() => {
      void this.checkHealth(id);
    }, SESSION_HEALTH_INTERVAL_MS);
    this.healthTimers.set(id, timer);
  }

  private stopHealthCheck(id: string): void {
    const timer = this.healthTimers.get(id);
    if (timer) {
      clearInterval(timer);
      this.healthTimers.delete(id);
    }
  }

  private async probeClient(id: string): Promise<boolean> {
    const client = this.clients.get(id);
    if (!client) {
      return false;
    }
    try {
      if (!(await client.isAuthorized())) {
        return false;
      }
      await client.getMe();
      return true;
    } catch (error) {
      if (isSessionRevokedError(error)) {
        return false;
      }
      return true;
    }
  }

  private async checkHealth(id: string): Promise<void> {
    if (!this.clients.has(id)) {
      this.stopHealthCheck(id);
      return;
    }
    const healthy = await this.probeClient(id);
    if (!healthy) {
      await this.handleSessionLost(
        id,
        'Session was terminated remotely — log in again',
      );
    }
  }

  /** Clears a revoked/invalid session and marks the instance as errored. */
  async handleSessionLost(id: string, reason: string): Promise<void> {
    if (this.sessionLostBusy.has(id)) {
      return;
    }
    this.sessionLostBusy.add(id);
    try {
      this.logger.warn(`Session lost for instance ${id}: ${reason}`);
      this.sessionErrorMessages.set(id, reason);
      await this.detach(id);
      await this.session.deleteSession(id);
      await this.instances.update(id, {
        status: 'error',
        firstName: null,
        username: null,
        phone: null,
        tgUserId: null,
      });
      this.publishStatus(id, 'error', { message: reason });
    } finally {
      this.sessionLostBusy.delete(id);
    }
  }

  /** Public view plus live connection state and uptime, for the info panel. */
  async instanceInfo(
    id: string,
  ): Promise<
    | (TelegramInstance & { connected: boolean; uptimeSeconds: number | null })
    | null
  > {
    const instance = await this.instances.get(id);
    if (!instance) {
      return null;
    }
    const since = this.connectedAt.get(id);
    return {
      ...instance,
      connected: this.clients.has(id),
      uptimeSeconds: since ? Math.floor((Date.now() - since) / 1000) : null,
    };
  }

  async instancesSummary(): Promise<InstancesSummary> {
    const engines = this.registry.availableKeys();
    if (engines.length === 0) {
      return { enabled: false, total: 0, connected: 0, engines };
    }
    const instances = await this.instances.list();
    return {
      enabled: true,
      total: instances.length,
      connected: this.clients.size,
      engines,
    };
  }

  // --- QR login ---

  /**
   * Starts a QR login for an instance and streams the flow as it progresses:
   * `qr` (token URL, refreshed every ~30s), `password_required` (2FA), then
   * `authorized` or `error`. The stream completes once the attempt resolves.
   */
  startQrLogin(id: string): Observable<QrLoginEvent> {
    const subject = new Subject<QrLoginEvent>();
    void this.runQrLogin(id, subject);
    return subject.asObservable();
  }

  /** Resolves a pending 2FA password prompt. Returns false if none is waiting. */
  submitPassword(id: string, password: string): boolean {
    const resolver = this.pendingPasswords.get(id);
    if (!resolver) {
      return false;
    }
    this.pendingPasswords.delete(id);
    resolver(password);
    return true;
  }

  /**
   * Starts a phone-number login: Telegram sends a code to the user's app/SMS.
   * Resolves once the code has been dispatched (instance status → awaiting_code).
   */
  async startPhoneLogin(id: string, phone: string): Promise<void> {
    const instance = await this.instances.get(id);
    if (!instance) {
      throw new Error('Instance not found');
    }
    const engine = this.registry.tryGet(instance.engine);
    if (!engine?.isAvailable() || !engine.capabilities.phoneLogin) {
      throw new Error(
        `Engine "${instance.engine}" does not support phone login`,
      );
    }

    this.cancelPhoneLogin(id);

    const codeSent = new Promise<void>((resolve, reject) => {
      this.phoneCodeSent.set(id, resolve);
      void this.runPhoneLogin(id, phone, instance.engine).catch(reject);
    });

    await codeSent;
  }

  /**
   * Submits the OTP received via Telegram. Returns the next step
   * (`password_required` or `authorized`).
   */
  submitPhoneCode(id: string, code: string): Promise<PhoneLoginStepResult> {
    const resolver = this.pendingPhoneCodes.get(id);
    if (!resolver) {
      throw new Error('No phone login is awaiting a code for this instance');
    }
    this.pendingPhoneCodes.delete(id);
    const step = this.waitPhoneLoginStep(id);
    resolver(code);
    return step;
  }

  /** Waits for the phone login to finish after a 2FA password was submitted. */
  awaitPhoneLoginAfterPassword(
    id: string,
  ): Promise<PhoneLoginStepResult | null> {
    if (!this.phoneLoginClients.has(id)) {
      return Promise.resolve(null);
    }
    return this.waitPhoneLoginStep(id);
  }

  /** True while a phone login session is in progress (before authorized). */
  isPhoneLoginPending(id: string): boolean {
    return this.phoneLoginClients.has(id);
  }

  /** Aborts an in-progress phone login and disconnects the transient client. */
  cancelPhoneLogin(id: string): void {
    this.phoneCodeSent.delete(id);
    this.pendingPhoneCodes.delete(id);
    this.rejectPhoneLoginStep(id, 'Login cancelled');
    const client = this.phoneLoginClients.get(id);
    this.phoneLoginClients.delete(id);
    void client?.disconnect().catch(() => undefined);
  }

  private waitPhoneLoginStep(id: string): Promise<PhoneLoginStepResult> {
    return new Promise((resolve, reject) => {
      this.phoneLoginSteps.set(id, { resolve, reject });
    });
  }

  private resolvePhoneLoginStep(
    id: string,
    result: PhoneLoginStepResult,
  ): void {
    const waiter = this.phoneLoginSteps.get(id);
    if (waiter) {
      this.phoneLoginSteps.delete(id);
      waiter.resolve(result);
    }
  }

  private rejectPhoneLoginStep(id: string, message: string): void {
    const waiter = this.phoneLoginSteps.get(id);
    if (waiter) {
      this.phoneLoginSteps.delete(id);
      waiter.reject(new Error(message));
    }
  }

  private async runPhoneLogin(
    id: string,
    phone: string,
    engineKey: EngineKey,
  ): Promise<void> {
    const engine = this.registry.tryGet(engineKey);
    if (!engine) {
      throw new Error(`Engine "${engineKey}" is not available`);
    }

    let client: EngineClient | undefined;
    try {
      const config = await this.resolveConfig(id);
      client = await engine.connect('', config);
      this.phoneLoginClients.set(id, client);
      await this.instances.update(id, { status: 'connecting' });

      const me = await client.phoneLogin!(phone, {
        onCodeSent: () => {
          void this.instances.update(id, { status: 'awaiting_code' });
          const notify = this.phoneCodeSent.get(id);
          if (notify) {
            this.phoneCodeSent.delete(id);
            notify();
          }
        },
        onCodeRequired: () => this.awaitPhoneCode(id),
        onPasswordRequired: async () => {
          await this.instances.update(id, { status: 'password_required' });
          this.resolvePhoneLoginStep(id, { status: 'password_required' });
          return this.awaitPassword(id);
        },
      });

      await this.finishLogin(id, client, me);
      this.resolvePhoneLoginStep(id, { status: 'authorized', me });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      await this.instances.update(id, { status: 'error' });
      await client?.disconnect().catch(() => undefined);
      this.phoneLoginClients.delete(id);
      this.rejectPhoneLoginStep(id, message);
      // Do NOT resolve `phoneCodeSent` here. If the failure happened before the
      // code was actually dispatched (invalid api_id, bad phone number,
      // FLOOD_WAIT, etc.), the thrown error must propagate so `startPhoneLogin`
      // rejects and the caller sees the real Telegram error — instead of being
      // sent to a "enter code" step for a code that was never delivered.
      throw new Error(message, { cause: error });
    } finally {
      this.pendingPhoneCodes.delete(id);
      this.pendingPasswords.delete(id);
      this.phoneCodeSent.delete(id);
    }
  }

  private async finishLogin(
    id: string,
    client: EngineClient,
    me: TelegramMe,
  ): Promise<void> {
    this.phoneLoginClients.delete(id);
    await this.session.saveSession(id, client.saveSession());
    this.attach(id, client);
    await this.instances.update(id, {
      status: 'authorized',
      firstName: me.firstName,
      username: me.username,
      phone: me.phone,
    });
    this.publishStatus(id, 'authorized', {
      username: me.username,
      phone: me.phone,
    });
    void this.sync.onAuthorized(id, client);
  }

  private awaitPhoneCode(id: string): Promise<string> {
    return new Promise((resolve) => this.pendingPhoneCodes.set(id, resolve));
  }

  private async runQrLogin(
    id: string,
    subject: Subject<QrLoginEvent>,
  ): Promise<void> {
    const instance = await this.instances.get(id);
    if (!instance) {
      this.fail(subject, 'Instance not found');
      return;
    }
    const engine = this.registry.tryGet(instance.engine);
    if (!engine || !engine.isAvailable()) {
      this.fail(subject, `Engine "${instance.engine}" is not available`);
      return;
    }
    if (!engine.capabilities.qrLogin) {
      this.fail(
        subject,
        `Engine "${instance.engine}" does not support QR login`,
      );
      return;
    }

    let client: EngineClient | undefined;
    try {
      const config = await this.resolveConfig(id);
      client = await engine.connect('', config);
      await this.instances.update(id, { status: 'awaiting_qr' });

      const me = await client.qrLogin!({
        onQr: (url, expires) => subject.next({ type: 'qr', url, expires }),
        onPasswordRequired: async () => {
          await this.instances.update(id, { status: 'password_required' });
          subject.next({ type: 'password_required' });
          return this.awaitPassword(id);
        },
      });

      await this.finishLogin(id, client, me);
      subject.next({ type: 'authorized', me });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      await this.instances.update(id, { status: 'error' });
      await client?.disconnect().catch(() => undefined);
      subject.next({ type: 'error', message });
      this.publishStatus(id, 'error', { message });
    } finally {
      this.pendingPasswords.delete(id);
      subject.complete();
    }
  }

  private fail(subject: Subject<QrLoginEvent>, message: string): void {
    subject.next({ type: 'error', message });
    subject.complete();
  }

  private awaitPassword(id: string): Promise<string> {
    return new Promise((resolve) => this.pendingPasswords.set(id, resolve));
  }

  private async restore(instance: TelegramInstance): Promise<void> {
    const engine = this.registry.tryGet(instance.engine);
    if (!engine || !engine.isAvailable()) {
      return;
    }
    const sessionStr = await this.session.loadSession(instance.id);
    if (!sessionStr) {
      return;
    }
    let client: EngineClient | undefined;
    try {
      const config = await this.resolveConfig(instance.id);
      client = await engine.connect(sessionStr, config);
      const authorized = await client.isAuthorized();
      if (!authorized) {
        // The saved session exists but is no longer valid (revoked/expired):
        // mark it as errored — not merely disconnected — so the UI offers a
        // fresh login (Connect) and `startInstance` reports a clear reason.
        await client.disconnect().catch(() => undefined);
        const reason =
          'Session is no longer valid — log in again via QR or phone.';
        this.sessionErrorMessages.set(instance.id, reason);
        await this.session.deleteSession(instance.id);
        await this.instances.update(instance.id, {
          status: 'error',
          firstName: null,
          username: null,
          phone: null,
          tgUserId: null,
        });
        this.publishStatus(instance.id, 'error', { message: reason });
        return;
      }
      const me = await client.getMe().catch(async (error: unknown) => {
        await client!.disconnect().catch(() => undefined);
        if (isSessionRevokedError(error)) {
          await this.handleSessionLost(
            instance.id,
            sessionRevokedMessage(error),
          );
          return null;
        }
        throw error;
      });
      if (!me) {
        return;
      }
      this.attach(instance.id, client);
      await this.instances.update(instance.id, {
        status: 'authorized',
        firstName: me.firstName,
        username: me.username,
        phone: me.phone,
      });
      this.publishStatus(instance.id, 'authorized', {
        username: me.username,
        phone: me.phone,
      });
      void this.sync.onAuthorized(instance.id, client);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(
        `Failed to restore instance ${instance.id}: ${message}`,
      );
      await client?.disconnect().catch(() => undefined);
      this.sessionErrorMessages.set(instance.id, message);
      await this.session.deleteSession(instance.id);
      await this.instances.update(instance.id, {
        status: 'error',
        firstName: null,
        username: null,
        phone: null,
        tgUserId: null,
      });
      this.publishStatus(instance.id, 'error', { message });
    }
  }
}
