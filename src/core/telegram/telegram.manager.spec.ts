import { ConfigService } from '@nestjs/config';
import { TelegramSessionStore } from './telegram-session.store';
import { TelegramManager } from './telegram.manager';
import type { TelegramInstance } from './telegram.constants';

const mockClient = {
  connect: jest.fn(),
  isUserAuthorized: jest.fn(),
  disconnect: jest.fn(),
};

jest.mock('telegram', () => ({
  TelegramClient: jest.fn(() => mockClient),
}));
jest.mock('telegram/sessions', () => ({
  StringSession: jest.fn(),
}));

const instance: TelegramInstance = {
  id: 'i1',
  label: 'Main',
  status: 'new',
  createdAt: new Date().toISOString(),
};

const make = (env: Record<string, string | number | undefined>) => {
  const config = {
    get: jest.fn((key: string) => env[key]),
  } as unknown as ConfigService;
  const store = {
    list: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
    update: jest.fn(),
    loadSession: jest.fn(),
  };
  const manager = new TelegramManager(
    config,
    store as unknown as TelegramSessionStore,
  );
  return { manager, store };
};

const enabledEnv = { TELEGRAM_API_ID: 123, TELEGRAM_API_HASH: 'hash' };

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.connect.mockResolvedValue(undefined);
  mockClient.isUserAuthorized.mockResolvedValue(true);
  mockClient.disconnect.mockResolvedValue(undefined);
});

describe('TelegramManager', () => {
  it('is disabled without API credentials', async () => {
    const { manager, store } = make({});
    expect(manager.enabled).toBe(false);
    await expect(manager.instancesSummary()).resolves.toEqual({
      enabled: false,
      total: 0,
      connected: 0,
    });
    await manager.onApplicationBootstrap();
    expect(store.list).not.toHaveBeenCalled();
  });

  it('restores and reconnects an authorized instance on boot', async () => {
    const { manager, store } = make(enabledEnv);
    store.list.mockResolvedValue([instance]);
    store.loadSession.mockResolvedValue('SESSION');

    await manager.onApplicationBootstrap();

    expect(mockClient.connect).toHaveBeenCalled();
    expect(store.update).toHaveBeenCalledWith('i1', { status: 'authorized' });
    expect(manager.getClient('i1')).toBe(mockClient);
  });

  it('skips instances without a saved session', async () => {
    const { manager, store } = make(enabledEnv);
    store.list.mockResolvedValue([instance]);
    store.loadSession.mockResolvedValue(null);

    await manager.onApplicationBootstrap();

    expect(mockClient.connect).not.toHaveBeenCalled();
    expect(manager.getClient('i1')).toBeUndefined();
  });

  it('marks an instance errored when reconnect fails', async () => {
    const { manager, store } = make(enabledEnv);
    store.list.mockResolvedValue([instance]);
    store.loadSession.mockResolvedValue('SESSION');
    mockClient.connect.mockRejectedValue(new Error('boom'));

    await manager.onApplicationBootstrap();

    expect(store.update).toHaveBeenCalledWith('i1', { status: 'error' });
  });

  it('disconnects the live client when removing an instance', async () => {
    const { manager, store } = make(enabledEnv);
    manager.track('i1', mockClient as never);

    await manager.removeInstance('i1');

    expect(mockClient.disconnect).toHaveBeenCalled();
    expect(store.remove).toHaveBeenCalledWith('i1');
    expect(manager.getClient('i1')).toBeUndefined();
  });
});
