import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { TelegramManager } from '../../core/telegram/telegram.manager';
import { SettingsService } from '../../core/telegram/services/settings.service';
import { InstanceAccessService } from '../../core/telegram/services/instance-access.service';
import type { SafeUser } from '../auth/auth.service';
import { MessagingService } from './messaging.service';
import { TelegramController } from './telegram.controller';

const user: SafeUser = {
  id: 'u1',
  email: 'a@b.c',
  username: 'admin',
  role: 'admin',
};

describe('TelegramController', () => {
  let controller: TelegramController;
  let manager: {
    enabled: boolean;
    createInstance: jest.Mock;
    listInstances: jest.Mock;
    getInstance: jest.Mock;
    removeInstance: jest.Mock;
    submitPassword: jest.Mock;
    isEngineAvailable: jest.Mock;
  };
  let access: {
    grantOwner: jest.Mock;
    rolesFor: jest.Mock;
    resolve: jest.Mock;
  };

  beforeEach(() => {
    manager = {
      enabled: true,
      createInstance: jest.fn().mockResolvedValue({ id: 'i1', label: 'Main' }),
      listInstances: jest.fn().mockResolvedValue([]),
      getInstance: jest.fn(),
      removeInstance: jest.fn(),
      submitPassword: jest.fn(),
      isEngineAvailable: jest.fn().mockReturnValue(true),
    };
    const messaging = {
      listChats: jest.fn(),
      listMessages: jest.fn(),
      send: jest.fn(),
      stream: jest.fn(),
    };
    const settings = {
      getTelegramView: jest.fn(),
      setTelegram: jest.fn(),
    };
    access = {
      grantOwner: jest.fn().mockResolvedValue(undefined),
      rolesFor: jest.fn().mockResolvedValue(new Map()),
      resolve: jest
        .fn()
        .mockResolvedValue({ role: 'owner', permissions: new Set() }),
    };
    controller = new TelegramController(
      manager as unknown as TelegramManager,
      messaging as unknown as MessagingService,
      settings as unknown as SettingsService,
      access as unknown as InstanceAccessService,
    );
  });

  describe('when disabled', () => {
    beforeEach(() => {
      manager.enabled = false;
    });

    it('rejects every endpoint with 503', async () => {
      await expect(
        controller.createInstance(user, { label: 'x' }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(controller.listInstances(user)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      await expect(controller.getInstance(user, 'i1')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(manager.createInstance).not.toHaveBeenCalled();
    });
  });

  describe('when enabled', () => {
    it('delegates create to the manager and grants ownership', async () => {
      const result = await controller.createInstance(user, {
        label: 'Main',
        apiId: '123',
        apiHash: 'h',
      });
      expect(manager.createInstance).toHaveBeenCalledWith(
        'u1',
        'Main',
        undefined,
        {
          apiId: '123',
          apiHash: 'h',
        },
      );
      expect(access.grantOwner).toHaveBeenCalledWith('i1', 'u1');
      expect(result.myRole).toBe('owner');
    });

    it('400s when the chosen engine is unavailable', async () => {
      manager.isEngineAvailable.mockReturnValue(false);
      await expect(
        controller.createInstance(user, { label: 'Main', engine: 'telegraf' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(manager.createInstance).not.toHaveBeenCalled();
    });

    it('404s when an instance is missing', async () => {
      manager.getInstance.mockResolvedValue(null);
      await expect(controller.getInstance(user, 'nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('attaches myRole to a fetched instance', async () => {
      manager.getInstance.mockResolvedValue({ id: 'i1', label: 'Main' });
      const result = await controller.getInstance(user, 'i1');
      expect(result.myRole).toBe('owner');
    });

    it('accepts a pending 2FA password', () => {
      manager.submitPassword.mockReturnValue(true);
      expect(controller.submitPassword('i1', { password: 'pw' })).toEqual({
        ok: true,
      });
      expect(manager.submitPassword).toHaveBeenCalledWith('i1', 'pw');
    });

    it('400s when no password prompt is pending', () => {
      manager.submitPassword.mockReturnValue(false);
      expect(() => controller.submitPassword('i1', { password: 'pw' })).toThrow(
        BadRequestException,
      );
    });
  });
});
