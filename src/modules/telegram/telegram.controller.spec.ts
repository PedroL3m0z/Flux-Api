import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { TelegramManager } from '../../core/telegram/telegram.manager';
import { SettingsService } from '../../core/telegram/services/settings.service';
import type { SafeUser } from '../auth/auth.service';
import { MessagingService } from './messaging.service';
import { TelegramController } from './telegram.controller';

const user: SafeUser = { id: 'u1', email: 'a@b.c', username: 'admin' };

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
      createInstance: jest.fn(),
      listInstances: jest.fn(),
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
    controller = new TelegramController(
      manager as unknown as TelegramManager,
      messaging as unknown as MessagingService,
      settings as unknown as SettingsService,
    );
  });

  describe('when disabled', () => {
    beforeEach(() => {
      manager.enabled = false;
    });

    it('rejects every endpoint with 503', async () => {
      expect(() => controller.createInstance(user, { label: 'x' })).toThrow(
        ServiceUnavailableException,
      );
      expect(() => controller.listInstances()).toThrow(
        ServiceUnavailableException,
      );
      await expect(controller.getInstance('i1')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(manager.createInstance).not.toHaveBeenCalled();
    });
  });

  describe('when enabled', () => {
    it('delegates create to the manager', () => {
      void controller.createInstance(user, {
        label: 'Main',
        apiId: '123',
        apiHash: 'h',
      });
      expect(manager.createInstance).toHaveBeenCalledWith(
        'u1',
        'Main',
        undefined,
        { apiId: '123', apiHash: 'h' },
      );
    });

    it('400s when the chosen engine is unavailable', () => {
      manager.isEngineAvailable.mockReturnValue(false);
      expect(() =>
        controller.createInstance(user, {
          label: 'Main',
          engine: 'telegraf',
        }),
      ).toThrow(BadRequestException);
      expect(manager.createInstance).not.toHaveBeenCalled();
    });

    it('404s when an instance is missing', async () => {
      manager.getInstance.mockResolvedValue(null);
      await expect(controller.getInstance('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
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
