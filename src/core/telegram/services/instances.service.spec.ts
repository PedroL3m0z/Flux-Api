import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { deriveKey, encryptSecret } from '../crypto.util';
import { InstancesService } from './instances.service';

const SECRET = 'a'.repeat(32);

const make = (secret: string | undefined = SECRET) => {
  const prisma = {
    instance: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const config = {
    get: jest.fn(() => secret),
  } as unknown as ConfigService;
  const service = new InstancesService(
    prisma as unknown as PrismaService,
    config,
  );
  return { service, prisma };
};

const row = (over: Record<string, unknown> = {}) => ({
  id: 'i1',
  ownerId: 'u1',
  label: 'Main',
  engine: 'gramjs',
  status: 'new',
  apiId: 123,
  apiHashEnc: null,
  tgUserId: null,
  username: null,
  phone: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...over,
});

describe('InstancesService', () => {
  it('encrypts api_hash on create and returns a secret-free public view', async () => {
    const { service, prisma } = make();
    prisma.instance.create.mockResolvedValue(row());

    const created = await service.create('u1', 'Main', 'gramjs', {
      apiId: '123',
      apiHash: 'SECRET_HASH',
    });

    const calls = prisma.instance.create.mock.calls as Array<
      [{ data: { apiId: number; apiHashEnc: string } }]
    >;
    const data = calls[0][0].data;
    expect(data.apiId).toBe(123);
    expect(data.apiHashEnc.startsWith('enc:v1:')).toBe(true);

    expect(created).toEqual({
      id: 'i1',
      label: 'Main',
      engine: 'gramjs',
      status: 'new',
      apiId: '123',
      username: undefined,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(created).not.toHaveProperty('apiHashEnc');
  });

  it('decrypts credentials via getCredentials', async () => {
    const { service, prisma } = make();
    const apiHashEnc = encryptSecret('SECRET_HASH', deriveKey(SECRET));
    prisma.instance.findUnique.mockResolvedValue({ apiId: 123, apiHashEnc });

    await expect(service.getCredentials('i1')).resolves.toEqual({
      apiId: '123',
      apiHash: 'SECRET_HASH',
    });
  });

  it('returns null for a missing instance', async () => {
    const { service, prisma } = make();
    prisma.instance.findUnique.mockResolvedValue(null);
    await expect(service.get('nope')).resolves.toBeNull();
  });
});
