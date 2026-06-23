import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';
import { UsersService } from '../users/users.service';
import { SeedService } from './seed.service';

describe('SeedService', () => {
  let users: jest.Mocked<
    Pick<UsersService, 'findByEmailOrUsername' | 'setRole' | 'count'>
  >;
  let auth: jest.Mocked<Pick<AuthService, 'register'>>;

  const make = (env: Record<string, string | undefined>) => {
    const config = {
      get: jest.fn((key: string) => env[key]),
    } as unknown as ConfigService;
    users = {
      findByEmailOrUsername: jest.fn(),
      setRole: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    };
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

  it('does nothing when no SEED_PASSWORD is available', async () => {
    const svc = make({ SEED_USERNAME: 'admin' }); // no password
    await svc.onApplicationBootstrap();
    expect(users.findByEmailOrUsername).not.toHaveBeenCalled();
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('auto-seeds a default admin on a fresh install (password only)', async () => {
    const svc = make({ SEED_PASSWORD: 'generated-pass' });
    users.count.mockResolvedValue(0);
    users.findByEmailOrUsername.mockResolvedValue(null);
    auth.register.mockResolvedValue({
      id: 'u1',
      email: 'admin@flux.local',
      username: 'admin',
      role: 'viewer',
    });

    await svc.onApplicationBootstrap();

    expect(auth.register).toHaveBeenCalledWith({
      email: 'admin@flux.local',
      username: 'admin',
      password: 'generated-pass',
    });
    expect(users.setRole).toHaveBeenCalledWith('u1', 'admin');
  });

  it('does not auto-seed when users already exist (no explicit creds)', async () => {
    const svc = make({ SEED_PASSWORD: 'generated-pass' });
    users.count.mockResolvedValue(3);

    await svc.onApplicationBootstrap();

    expect(users.findByEmailOrUsername).not.toHaveBeenCalled();
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('seeds explicit creds even when users already exist', async () => {
    const svc = make(full);
    users.count.mockResolvedValue(5);
    users.findByEmailOrUsername.mockResolvedValue(null);
    auth.register.mockResolvedValue({
      id: 'u1',
      email: 'admin@flux.dev',
      username: 'admin',
      role: 'viewer',
    });

    await svc.onApplicationBootstrap();

    expect(users.count).not.toHaveBeenCalled();
    expect(auth.register).toHaveBeenCalled();
  });

  it('registers the user as admin when absent', async () => {
    const svc = make(full);
    users.findByEmailOrUsername.mockResolvedValue(null);
    auth.register.mockResolvedValue({
      id: 'u1',
      email: 'admin@flux.dev',
      username: 'admin',
      role: 'viewer',
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
      role: 'viewer',
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
