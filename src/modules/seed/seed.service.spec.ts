import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';
import { UsersService } from '../users/users.service';
import { SeedService } from './seed.service';

describe('SeedService', () => {
  let users: jest.Mocked<
    Pick<UsersService, 'findByEmailOrUsername' | 'setRole'>
  >;
  let auth: jest.Mocked<Pick<AuthService, 'register'>>;

  const make = (env: Record<string, string | undefined>) => {
    const config = {
      get: jest.fn((key: string) => env[key]),
    } as unknown as ConfigService;
    users = { findByEmailOrUsername: jest.fn(), setRole: jest.fn() };
    auth = { register: jest.fn() };
    return new SeedService(
      config,
      users as unknown as UsersService,
      auth as unknown as AuthService,
    );
  };

  const full = {
    SEED_EMAIL: 'admin@flux.dev',
    SEED_USERNAME: 'admin',
    SEED_PASSWORD: 'S3cureP@ss',
  };

  it('does nothing when seed vars are missing', async () => {
    const svc = make({ SEED_USERNAME: 'admin' }); // incomplete
    await svc.onApplicationBootstrap();
    expect(users.findByEmailOrUsername).not.toHaveBeenCalled();
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('registers the user as admin when absent', async () => {
    const svc = make(full);
    users.findByEmailOrUsername.mockResolvedValue(null);
    auth.register.mockResolvedValue({
      id: 'u1',
      email: 'admin@flux.dev',
      username: 'admin',
      role: 'member',
    });

    await svc.onApplicationBootstrap();

    expect(auth.register).toHaveBeenCalledWith({
      email: 'admin@flux.dev',
      username: 'admin',
      password: 'S3cureP@ss',
    });
    expect(users.setRole).toHaveBeenCalledWith('u1', 'admin');
  });

  it('promotes an existing non-admin seed user', async () => {
    const svc = make(full);
    users.findByEmailOrUsername.mockResolvedValue({
      id: 'u1',
      role: 'member',
    } as never);

    await svc.onApplicationBootstrap();

    expect(auth.register).not.toHaveBeenCalled();
    expect(users.setRole).toHaveBeenCalledWith('u1', 'admin');
  });

  it('skips when the user already exists as admin', async () => {
    const svc = make(full);
    users.findByEmailOrUsername.mockResolvedValue({
      id: 'u1',
      role: 'admin',
    } as never);

    await svc.onApplicationBootstrap();

    expect(auth.register).not.toHaveBeenCalled();
    expect(users.setRole).not.toHaveBeenCalled();
  });

  it('never throws if registration fails', async () => {
    const svc = make(full);
    users.findByEmailOrUsername.mockResolvedValue(null);
    auth.register.mockRejectedValue(new Error('db down'));

    await expect(svc.onApplicationBootstrap()).resolves.toBeUndefined();
  });
});
