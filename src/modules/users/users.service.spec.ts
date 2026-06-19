import { ConflictException, NotFoundException } from '@nestjs/common';
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
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let hashing: { hash: jest.Mock; verify: jest.Mock };

  beforeEach(() => {
    prisma = {
      user: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    hashing = { hash: jest.fn(), verify: jest.fn() };
    service = new UsersService(prisma as unknown as PrismaService, hashing);
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

  it('update hashes the password and patches only provided fields', async () => {
    hashing.hash.mockResolvedValue('hashed-pw');
    prisma.user.update.mockResolvedValue({ id: 'u1', role: 'operator' });

    await service.update('u1', { username: 'newname', password: 'secret123' });

    expect(hashing.hash).toHaveBeenCalledWith('secret123');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { username: 'newname', password: 'hashed-pw' },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
      },
    });
  });

  it('update without a password does not hash', async () => {
    prisma.user.update.mockResolvedValue({ id: 'u1' });

    await service.update('u1', { role: 'viewer' });

    expect(hashing.hash).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { role: 'viewer' },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
      },
    });
  });

  it('update maps a unique-constraint violation to ConflictException', async () => {
    prisma.user.update.mockRejectedValue({ code: 'P2002' });

    await expect(service.update('u1', { email: 'dup@b.dev' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('update maps other failures to NotFoundException', async () => {
    prisma.user.update.mockRejectedValue(new Error('missing'));

    await expect(service.update('nope', { role: 'admin' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('remove deletes by id', async () => {
    prisma.user.delete.mockResolvedValue({ id: 'u1' });

    await service.remove('u1');

    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });

  it('remove throws NotFoundException when the user is missing', async () => {
    prisma.user.delete.mockRejectedValue(new Error('missing'));

    await expect(service.remove('nope')).rejects.toThrow(NotFoundException);
  });
});
