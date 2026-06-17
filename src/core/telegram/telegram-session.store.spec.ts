import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { sessionKey } from './telegram.constants';
import { TelegramSessionStore } from './telegram-session.store';

function fakeRedis() {
  const strings = new Map<string, string>();
  const hashes = new Map<string, Record<string, string>>();
  const sets = new Map<string, Set<string>>();
  const client = {
    hset: jest.fn((key: string, obj: Record<string, string>) => {
      hashes.set(key, { ...(hashes.get(key) ?? {}), ...obj });
      return Promise.resolve(1);
    }),
    hgetall: jest.fn((key: string) => Promise.resolve(hashes.get(key) ?? {})),
    sadd: jest.fn((key: string, member: string) => {
      const set = sets.get(key) ?? new Set<string>();
      set.add(member);
      sets.set(key, set);
      return Promise.resolve(1);
    }),
    smembers: jest.fn((key: string) =>
      Promise.resolve([...(sets.get(key) ?? [])]),
    ),
    srem: jest.fn((key: string, member: string) => {
      sets.get(key)?.delete(member);
      return Promise.resolve(1);
    }),
    del: jest.fn((key: string) => {
      strings.delete(key);
      hashes.delete(key);
      return Promise.resolve(1);
    }),
  };
  return {
    client,
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
  describe('session encryption', () => {
    it('round-trips an encrypted session when a secret is set', async () => {
      const secret = 'a'.repeat(32);
      const { store, redis } = make(secret);

      await store.saveSession('i1', 'SESSION_STRING');

      const stored = redis.set.mock.calls[0][1];
      expect(stored).not.toBe('SESSION_STRING');
      expect(stored.startsWith('enc:v1:')).toBe(true);
      await expect(store.loadSession('i1')).resolves.toBe('SESSION_STRING');
    });

    it('stores plaintext when no secret is set', async () => {
      const { store, redis } = make(undefined);

      await store.saveSession('i1', 'SESSION_STRING');

      expect(redis.set).toHaveBeenCalledWith(
        sessionKey('i1'),
        'SESSION_STRING',
      );
      await expect(store.loadSession('i1')).resolves.toBe('SESSION_STRING');
    });

    it('returns null for an absent session', async () => {
      const { store } = make('a'.repeat(32));
      await expect(store.loadSession('missing')).resolves.toBeNull();
    });
  });

  describe('instance registry', () => {
    it('creates, lists, updates and removes instances', async () => {
      const { store } = make('a'.repeat(32));

      const created = await store.create('Main');
      expect(created).toMatchObject({ label: 'Main', status: 'new' });
      expect(created.id).toBeDefined();

      await expect(store.get(created.id)).resolves.toMatchObject({
        id: created.id,
        label: 'Main',
        status: 'new',
      });
      await expect(store.list()).resolves.toHaveLength(1);

      await store.update(created.id, { status: 'authorized', username: 'me' });
      await expect(store.get(created.id)).resolves.toMatchObject({
        status: 'authorized',
        username: 'me',
      });

      await store.remove(created.id);
      await expect(store.get(created.id)).resolves.toBeNull();
      await expect(store.list()).resolves.toHaveLength(0);
    });

    it('removing an instance also clears its session', async () => {
      const { store } = make('a'.repeat(32));
      const created = await store.create('Main');
      await store.saveSession(created.id, 'SESSION');

      await store.remove(created.id);

      await expect(store.loadSession(created.id)).resolves.toBeNull();
    });
  });
});
