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
import type { EngineConfig } from './engines/engine.types';
import type { TelegramInstance } from './telegram.constants';

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

  constructor(
    private readonly registry: EngineRegistry,
    private readonly instances: InstancesService,
    private readonly settings: SettingsService,
    private readonly session: TelegramSessionStore,
    private readonly sync: TelegramSyncService,
  ) {}

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

  /** Tracks a live client and the moment it connected (for uptime). */
  private attach(id: string, client: EngineClient): void {
    this.clients.set(id, client);
    this.connectedAt.set(id, Date.now());
  }

  /** Drops a live client and its connection timestamp. */
  private async detach(id: string): Promise<void> {
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
  }

  /** (Re)connects an instance from its saved session. No-op if already live. */
  async startInstance(id: string): Promise<TelegramInstance | null> {
    const instance = await this.instances.get(id);
    if (!instance) {
      return null;
    }
    if (!this.clients.has(id)) {
      await this.restore(instance);
    }
    return this.instances.get(id);
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

      await this.session.saveSession(id, client.saveSession());
      this.attach(id, client);
      await this.instances.update(id, {
        status: 'authorized',
        firstName: me.firstName,
        username: me.username,
        phone: me.phone,
      });
      subject.next({ type: 'authorized', me });
      void this.sync.onAuthorized(id, client);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      await this.instances.update(id, { status: 'error' });
      await client?.disconnect().catch(() => undefined);
      subject.next({ type: 'error', message });
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
    const session = await this.session.loadSession(instance.id);
    if (!session) {
      return;
    }
    try {
      const config = await this.resolveConfig(instance.id);
      const client = await engine.connect(session, config);
      const authorized = await client.isAuthorized();
      this.attach(instance.id, client);
      const me = authorized ? await client.getMe().catch(() => null) : null;
      await this.instances.update(instance.id, {
        status: authorized ? 'authorized' : 'disconnected',
        firstName: me?.firstName,
        username: me?.username,
        phone: me?.phone,
      });
      if (authorized) {
        void this.sync.onAuthorized(instance.id, client);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(
        `Failed to restore instance ${instance.id}: ${message}`,
      );
      await this.instances.update(instance.id, { status: 'error' });
    }
  }
}
