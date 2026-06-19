import { BadRequestException } from '@nestjs/common';
import type { SafeUser } from '../auth/auth.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

const admin: SafeUser = {
  id: 'me',
  email: 'me@flux.dev',
  username: 'me',
  role: 'admin',
};

describe('UsersController', () => {
  it('findAll delegates to UsersService.findAll', () => {
    const service = { findAll: jest.fn().mockResolvedValue([]) };
    const controller = new UsersController(service as unknown as UsersService);

    void controller.findAll();

    expect(service.findAll).toHaveBeenCalled();
  });

  describe('setRole', () => {
    it('delegates for another user', () => {
      const service = { setRole: jest.fn().mockResolvedValue({}) };
      const controller = new UsersController(
        service as unknown as UsersService,
      );

      void controller.setRole(admin, 'other', { role: 'operator' });

      expect(service.setRole).toHaveBeenCalledWith('other', 'operator');
    });

    it('rejects changing your own role', () => {
      const service = { setRole: jest.fn() };
      const controller = new UsersController(
        service as unknown as UsersService,
      );

      expect(() => controller.setRole(admin, 'me', { role: 'viewer' })).toThrow(
        BadRequestException,
      );
      expect(service.setRole).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('lets you edit your own profile without a role change', () => {
      const service = { update: jest.fn().mockResolvedValue({}) };
      const controller = new UsersController(
        service as unknown as UsersService,
      );

      void controller.update(admin, 'me', { username: 'newname' });

      expect(service.update).toHaveBeenCalledWith('me', {
        username: 'newname',
      });
    });

    it('lets you submit your own unchanged role', () => {
      const service = { update: jest.fn().mockResolvedValue({}) };
      const controller = new UsersController(
        service as unknown as UsersService,
      );

      void controller.update(admin, 'me', { role: 'admin' });

      expect(service.update).toHaveBeenCalled();
    });

    it('rejects demoting your own role', () => {
      const service = { update: jest.fn() };
      const controller = new UsersController(
        service as unknown as UsersService,
      );

      expect(() => controller.update(admin, 'me', { role: 'viewer' })).toThrow(
        BadRequestException,
      );
      expect(service.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes another user', async () => {
      const service = { remove: jest.fn().mockResolvedValue(undefined) };
      const controller = new UsersController(
        service as unknown as UsersService,
      );

      await controller.remove(admin, 'other');

      expect(service.remove).toHaveBeenCalledWith('other');
    });

    it('rejects deleting your own account', async () => {
      const service = { remove: jest.fn() };
      const controller = new UsersController(
        service as unknown as UsersService,
      );

      await expect(controller.remove(admin, 'me')).rejects.toThrow(
        BadRequestException,
      );
      expect(service.remove).not.toHaveBeenCalled();
    });
  });
});
