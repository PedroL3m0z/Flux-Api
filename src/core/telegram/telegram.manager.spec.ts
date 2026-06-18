import { EngineRegistry } from './engines/engine.registry';
import { InstancesService } from './services/instances.service';
import { SettingsService } from './services/settings.service';
import { TelegramSessionStore } from './telegram-session.store';
import { TelegramSyncService } from './services/telegram-sync.service';
import { TelegramManager, type QrLoginEvent } from './telegram.manager';
import type { TelegramInstance } from './telegram.constants';

const instance: TelegramInstance = {
  id: 'i1',
  label: 'Main',
  engine: 'gramjs',
  status: 'new',
  createdAt: new Date().toISOString(),
};

const makeClient = () => ({
  isAuthorized: jest.fn().mockResolvedValue(true),
  disconnect: jest.fn().mockResolvedValue(undefined),
  getMe: jest.fn().mockResolvedValue(null),
  saveSession: jest.fn().mockReturnValue('SAVED_SESSION'),
  qrLogin: jest.fn(),
});

const make = (available = true) => {
  const client = makeClient();
  const engine = {
    key: 'gramjs' as const,
    capabilities: { qrLogin: true, botToken: false },
    isAvailable: jest.fn().mockReturnValue(available),
    requiredConfig: jest.fn().mockReturnValue(['apiId', 'apiHash']),
    connect: jest.fn().mockResolvedValue(client),
  };
  const registry = new EngineRegistry([engine]);
  const instances = {
    list: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
    update: jest.fn(),
    getCredentials: jest.fn().mockResolvedValue({ apiId: '1', apiHash: 'h' }),
  };
  const settings = {
    getTelegramCredentials: jest.fn().mockResolvedValue({}),
  };
  const session = {
    loadSession: jest.fn(),
    saveSession: jest.fn(),
    deleteSession: jest.fn(),
  };
  const sync = {
    onAuthorized: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn(),
  };
  const manager = new TelegramManager(
    registry,
    instances as unknown as InstancesService,
    settings as unknown as SettingsService,
    session as unknown as TelegramSessionStore,
    sync as unknown as TelegramSyncService,
  );
  return { manager, instances, settings, session, sync, engine, client };
};

const collect = (manager: TelegramManager, id: string) =>
  new Promise<QrLoginEvent[]>((resolve) => {
    const events: QrLoginEvent[] = [];
    manager.startQrLogin(id).subscribe({
      next: (e) => events.push(e),
      complete: () => resolve(events),
    });
  });

describe('TelegramManager', () => {
  it('is disabled when no engine is available', async () => {
    const { manager, instances } = make(false);
    expect(manager.enabled).toBe(false);
    await expect(manager.instancesSummary()).resolves.toEqual({
      enabled: false,
      total: 0,
      connected: 0,
      engines: [],
    });
    await manager.onApplicationBootstrap();
    expect(instances.list).not.toHaveBeenCalled();
  });

  it('restores and reconnects an authorized instance on boot', async () => {
    const { manager, instances, session, engine, client } = make();
    instances.list.mockResolvedValue([instance]);
    session.loadSession.mockResolvedValue('SESSION');

    await manager.onApplicationBootstrap();

    expect(engine.connect).toHaveBeenCalledWith('SESSION', {
      apiId: '1',
      apiHash: 'h',
    });
    expect(client.isAuthorized).toHaveBeenCalled();
    expect(instances.update).toHaveBeenCalledWith('i1', {
      status: 'authorized',
    });
    expect(manager.getClient('i1')).toBe(client);
  });

  it('skips instances without a saved session', async () => {
    const { manager, instances, session, engine } = make();
    instances.list.mockResolvedValue([instance]);
    session.loadSession.mockResolvedValue(null);

    await manager.onApplicationBootstrap();

    expect(engine.connect).not.toHaveBeenCalled();
    expect(manager.getClient('i1')).toBeUndefined();
  });

  it('marks an instance errored when reconnect fails', async () => {
    const { manager, instances, session, engine } = make();
    instances.list.mockResolvedValue([instance]);
    session.loadSession.mockResolvedValue('SESSION');
    engine.connect.mockRejectedValue(new Error('boom'));

    await manager.onApplicationBootstrap();

    expect(instances.update).toHaveBeenCalledWith('i1', { status: 'error' });
  });

  it('disconnects the client and clears the session when removing', async () => {
    const { manager, instances, session, client } = make();
    instances.list.mockResolvedValue([instance]);
    session.loadSession.mockResolvedValue('SESSION');
    await manager.onApplicationBootstrap();

    await manager.removeInstance('i1');

    expect(client.disconnect).toHaveBeenCalled();
    expect(instances.remove).toHaveBeenCalledWith('i1');
    expect(session.deleteSession).toHaveBeenCalledWith('i1');
    expect(manager.getClient('i1')).toBeUndefined();
  });

  it('returns false when no password prompt is pending', () => {
    const { manager } = make();
    expect(manager.submitPassword('i1', 'pw')).toBe(false);
  });

  describe('QR login', () => {
    it('streams qr then authorized and persists the session', async () => {
      const { manager, instances, session, client } = make();
      instances.get.mockResolvedValue(instance);
      client.qrLogin.mockImplementation(
        (cb: { onQr: (url: string, expires: number) => void }) => {
          cb.onQr('tg://login?token=abc', 60);
          return Promise.resolve({ id: '42', username: 'me' });
        },
      );

      const events = await collect(manager, 'i1');

      expect(events).toEqual([
        { type: 'qr', url: 'tg://login?token=abc', expires: 60 },
        { type: 'authorized', me: { id: '42', username: 'me' } },
      ]);
      expect(session.saveSession).toHaveBeenCalledWith('i1', 'SAVED_SESSION');
      expect(instances.update).toHaveBeenCalledWith('i1', {
        status: 'authorized',
        username: 'me',
      });
      expect(manager.getClient('i1')).toBe(client);
    });

    it('errors when the instance does not exist', async () => {
      const { manager, instances } = make();
      instances.get.mockResolvedValue(null);

      const events = await collect(manager, 'missing');

      expect(events).toEqual([
        { type: 'error', message: 'Instance not found' },
      ]);
    });
  });
});
