import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let users: jest.Mocked<Pick<UsersService, 'findById'>>;

  const config = {
    get: jest.fn().mockReturnValue('test-secret'),
  } as unknown as ConfigService;

  beforeEach(() => {
    users = { findById: jest.fn() };
    strategy = new JwtStrategy(config, users as unknown as UsersService);
  });

  it('returns the user without the password field', async () => {
    users.findById.mockResolvedValue({
      id: 'u1',
      email: 'user@flux.dev',
      username: 'flux_user',
      password: 'hashed',
    } as never);

    const result = await strategy.validate({
      sub: 'u1',
      username: 'flux_user',
    });

    expect(users.findById).toHaveBeenCalledWith('u1');
    expect(result).not.toHaveProperty('password');
    expect(result).toMatchObject({ id: 'u1', username: 'flux_user' });
  });

  it('throws UnauthorizedException when the user no longer exists', async () => {
    users.findById.mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: 'gone', username: 'x' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
