import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { TelegramManager } from '../../core/telegram/telegram.manager';
import { SettingsService } from '../../core/telegram/services/settings.service';
import type { SafeUser } from '../auth/auth.service';
import { TelegramEventBus } from '../../core/telegram/services/telegram-events.service';
import { TelegramController } from './telegram.controller';
import { MessagingService } from './messaging.service';

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
    const events = { events$: jest.fn() };
    controller = new TelegramController(
      manager as unknown as TelegramManager,
      messaging as unknown as MessagingService,
      settings as unknown as SettingsService,
      events as unknown as TelegramEventBus,
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
    });
  });

  describe('createInstance', () => {
    it('creates an instance and echoes the caller global role as myRole', async () => {
      const result = await controller.createInstance(user, { label: 'Main' });
      expect(manager.createInstance).toHaveBeenCalled();
      expect(result).toMatchObject({ id: 'i1', myRole: 'admin' });
    });

    it('rejects unknown engines', async () => {
      manager.isEngineAvailable.mockReturnValue(false);
      await expect(
        controller.createInstance(user, { label: 'x', engine: 'telegraf' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getInstance', () => {
    it('returns 404 when missing', async () => {
      manager.getInstance.mockResolvedValue(null);
      await expect(
        controller.getInstance(user, 'missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('includes myRole from the caller global role', async () => {
      manager.getInstance.mockResolvedValue({ id: 'i1', label: 'Main' });
      const result = await controller.getInstance(
        { ...user, role: 'viewer' },
        'i1',
      );
      expect(result.myRole).toBe('viewer');
    });
  });
});
