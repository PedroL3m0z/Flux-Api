import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InstanceAccessService } from './instance-access.service';

describe('InstanceAccessService', () => {
  let service: InstanceAccessService;
  let prisma: {
    instanceMember: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      instanceMember: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new InstanceAccessService(prisma as unknown as PrismaService);
  });

  describe('resolve', () => {
    it('grants admins full access without a DB lookup', async () => {
      const access = await service.resolve({ id: 'a1', role: 'admin' }, 'i1');
      expect(access.role).toBe('admin');
      expect(access.permissions.has('instance:delete')).toBe(true);
      expect(prisma.instanceMember.findUnique).not.toHaveBeenCalled();
    });

    it('falls back to viewer when there is no membership', async () => {
      prisma.instanceMember.findUnique.mockResolvedValue(null);
      const access = await service.resolve({ id: 'u1', role: 'member' }, 'i1');
      expect(access.role).toBe('viewer');
      expect(access.permissions.has('message:send')).toBe(false);
    });

    it('uses the membership role when present', async () => {
      prisma.instanceMember.findUnique.mockResolvedValue({ role: 'operator' });
      const access = await service.resolve({ id: 'u1', role: 'member' }, 'i1');
      expect(access.role).toBe('operator');
      expect(access.permissions.has('message:send')).toBe(true);
    });
  });

  describe('rolesFor', () => {
    it('marks every instance admin for a global admin', async () => {
      const roles = await service.rolesFor({ id: 'a1', role: 'admin' }, [
        'i1',
        'i2',
      ]);
      expect(roles.get('i1')).toBe('admin');
      expect(roles.get('i2')).toBe('admin');
      expect(prisma.instanceMember.findMany).not.toHaveBeenCalled();
    });

    it('maps memberships and defaults the rest to viewer', async () => {
      prisma.instanceMember.findMany.mockResolvedValue([
        { instanceId: 'i1', role: 'owner' },
      ]);
      const roles = await service.rolesFor({ id: 'u1', role: 'member' }, [
        'i1',
        'i2',
      ]);
      expect(roles.get('i1')).toBe('owner');
      expect(roles.get('i2')).toBe('viewer');
    });
  });

  describe('removeMember', () => {
    it('refuses to remove the last owner', async () => {
      prisma.instanceMember.findUnique.mockResolvedValue({
        role: 'owner',
        userId: 'u1',
        createdAt: new Date(),
        user: { username: 'u', email: 'e' },
      });
      prisma.instanceMember.count.mockResolvedValue(1);

      await expect(service.removeMember('i1', 'u1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.instanceMember.delete).not.toHaveBeenCalled();
    });

    it('removes a non-last owner', async () => {
      prisma.instanceMember.findUnique.mockResolvedValue({
        role: 'owner',
        userId: 'u1',
        createdAt: new Date(),
        user: { username: 'u', email: 'e' },
      });
      prisma.instanceMember.count.mockResolvedValue(2);

      await service.removeMember('i1', 'u1');
      expect(prisma.instanceMember.delete).toHaveBeenCalled();
    });
  });
});
