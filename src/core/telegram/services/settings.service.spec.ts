import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from './settings.service';

const make = (secret: string | undefined = 'a'.repeat(32)) => {
  const store = new Map<string, string>();
  const prisma = {
    setting: {
      findMany: jest.fn(({ where }: { where: { key: { in: string[] } } }) =>
        Promise.resolve(
          where.key.in
            .filter((k) => store.has(k))
            .map((k) => ({ key: k, value: store.get(k) })),
        ),
      ),
      upsert: jest.fn(
        ({
          where,
          create,
        }: {
          where: { key: string };
          create: { key: string; value: string };
        }) => {
          store.set(where.key, create.value);
          return Promise.resolve(create);
        },
      ),
    },
  };
  const config = {
    get: jest.fn(() => secret),
  } as unknown as ConfigService;
  const service = new SettingsService(
    prisma as unknown as PrismaService,
    config,
  );
  return { service, store };
};

describe('SettingsService', () => {
  it('stores api_id plainly and encrypts api_hash', async () => {
    const { service, store } = make();

    await service.setTelegram({ apiId: '123', apiHash: 'SECRET' });

    expect(store.get('telegram.apiId')).toBe('123');
    expect(store.get('telegram.apiHash')?.startsWith('enc:v1:')).toBe(true);
  });

  it('exposes a secret-free view but decrypts for credentials', async () => {
    const { service } = make();
    await service.setTelegram({ apiId: '123', apiHash: 'SECRET' });

    await expect(service.getTelegramView()).resolves.toEqual({
      apiId: '123',
      hasApiHash: true,
    });
    await expect(service.getTelegramCredentials()).resolves.toEqual({
      apiId: '123',
      apiHash: 'SECRET',
    });
  });
});
