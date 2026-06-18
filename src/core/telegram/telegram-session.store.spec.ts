import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { sessionKey } from './telegram.constants';
import { TelegramSessionStore } from './telegram-session.store';

function fakeRedis() {
  const strings = new Map<string, string>();
  return {
    get: jest.fn((key: string) => Promise.resolve(strings.get(key) ?? null)),
    set: jest.fn((key: string, value: string) => {
      strings.set(key, value);
      return Promise.resolve();
    }),
    del: jest.fn((key: string) => {
      strings.delete(key);
      return Promise.resolve(1);
    }),
  };
}

const make = (secret?: string) => {
  const redis = fakeRedis();
  const config = {
    get: jest.fn(() => secret),
  } as unknown as ConfigService;
  const store = new TelegramSessionStore(
    redis as unknown as RedisService,
    config,
  );
  return { store, redis };
};

describe('TelegramSessionStore', () => {
  it('round-trips an encrypted session when a secret is set', async () => {
    const { store, redis } = make('a'.repeat(32));

    await store.saveSession('i1', 'SESSION_STRING');

    const stored = redis.set.mock.calls[0][1];
    expect(stored).not.toBe('SESSION_STRING');
    expect(stored.startsWith('enc:v1:')).toBe(true);
    await expect(store.loadSession('i1')).resolves.toBe('SESSION_STRING');
  });

  it('stores plaintext when no secret is set', async () => {
    const { store, redis } = make(undefined);

    await store.saveSession('i1', 'SESSION_STRING');

    expect(redis.set).toHaveBeenCalledWith(sessionKey('i1'), 'SESSION_STRING');
    await expect(store.loadSession('i1')).resolves.toBe('SESSION_STRING');
  });

  it('returns null for an absent session and deletes by key', async () => {
    const { store, redis } = make('a'.repeat(32));
    await expect(store.loadSession('missing')).resolves.toBeNull();

    await store.deleteSession('i1');
    expect(redis.del).toHaveBeenCalledWith(sessionKey('i1'));
  });
});
