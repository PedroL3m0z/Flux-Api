import { PrismaService } from '../../core/prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      user: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };
    service = new UsersService(prisma as unknown as PrismaService);
  });

  it('create forwards data to prisma.user.create', async () => {
    const data = { email: 'a@b.dev', username: 'ab', password: 'hashed' };
    prisma.user.create.mockResolvedValue({ id: 'u1', ...data });

    const result = await service.create(data);

    expect(prisma.user.create).toHaveBeenCalledWith({ data });
    expect(result).toEqual({ id: 'u1', ...data });
  });

  it('findByUsernameOrEmail queries username OR email', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await service.findByUsernameOrEmail('flux_user');

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ username: 'flux_user' }, { email: 'flux_user' }] },
    });
  });

  it('findByEmailOrUsername queries email OR username separately', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await service.findByEmailOrUsername('a@b.dev', 'flux_user');

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ email: 'a@b.dev' }, { username: 'flux_user' }] },
    });
  });

  it('findById queries by unique id', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await service.findById('u1');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'u1' },
    });
  });

  it('findAll selects safe fields, newest first', async () => {
    prisma.user.findMany.mockResolvedValue([]);

    await service.findAll();

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  });
});
