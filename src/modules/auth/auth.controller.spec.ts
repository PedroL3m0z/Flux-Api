import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService, type SafeUser } from './auth.service';
import { ACCESS_TOKEN_COOKIE } from './auth.cookie';

describe('AuthController', () => {
  let controller: AuthController;
  let service: jest.Mocked<Pick<AuthService, 'register' | 'login'>>;
  let res: { cookie: jest.Mock; clearCookie: jest.Mock };

  const safeUser: SafeUser = {
    id: 'u1',
    email: 'user@flux.dev',
    username: 'flux_user',
  };

  beforeEach(() => {
    service = { register: jest.fn(), login: jest.fn() };
    const config = {
      get: jest.fn((key: string) =>
        key === 'JWT_EXPIRES_IN' ? '3600s' : 'test',
      ),
    } as unknown as ConfigService;
    res = { cookie: jest.fn(), clearCookie: jest.fn() };
    controller = new AuthController(service as unknown as AuthService, config);
  });

  it('register delegates to AuthService.register', () => {
    const dto = {
      email: 'user@flux.dev',
      username: 'flux_user',
      password: 'S3cureP@ss',
    };
    service.register.mockResolvedValue(safeUser);

    void controller.register(dto);

    expect(service.register).toHaveBeenCalledWith(dto);
  });

  it('login returns the token and sets the httpOnly cookie', async () => {
    service.login.mockResolvedValue({ accessToken: 'tok' });

    const result = await controller.login(safeUser, res as unknown as Response);

    expect(service.login).toHaveBeenCalledWith(safeUser);
    expect(result).toEqual({ accessToken: 'tok' });
    expect(res.cookie).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      'tok',
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('logout clears the auth cookie', () => {
    const result = controller.logout(res as unknown as Response);

    expect(res.clearCookie).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      expect.objectContaining({ path: '/' }),
    );
    expect(result).toEqual({ ok: true });
  });

  it('me returns the current user as-is', () => {
    expect(controller.me(safeUser)).toBe(safeUser);
  });

  it('api-key-check returns the static ok payload', () => {
    expect(controller.apiKeyCheck()).toEqual({ ok: true, via: 'api-key' });
  });
});
