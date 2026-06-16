import { AuthController } from './auth.controller';
import { AuthService, type SafeUser } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let service: jest.Mocked<Pick<AuthService, 'register' | 'login'>>;

  const safeUser: SafeUser = {
    id: 'u1',
    email: 'user@flux.dev',
    username: 'flux_user',
  };

  beforeEach(() => {
    service = { register: jest.fn(), login: jest.fn() };
    controller = new AuthController(service as unknown as AuthService);
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

  it('login delegates the current user to AuthService.login', () => {
    service.login.mockResolvedValue({ accessToken: 'tok' });

    void controller.login(safeUser);

    expect(service.login).toHaveBeenCalledWith(safeUser);
  });

  it('me returns the current user as-is', () => {
    expect(controller.me(safeUser)).toBe(safeUser);
  });

  it('api-key-check returns the static ok payload', () => {
    expect(controller.apiKeyCheck()).toEqual({ ok: true, via: 'api-key' });
  });
});
