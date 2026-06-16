import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { LocalStrategy } from './local.strategy';

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;
  let authService: jest.Mocked<Pick<AuthService, 'validateUser'>>;

  const safeUser = { id: 'u1', email: 'user@flux.dev', username: 'flux_user' };

  beforeEach(() => {
    authService = { validateUser: jest.fn() };
    strategy = new LocalStrategy(authService as unknown as AuthService);
  });

  it('returns the user when credentials are valid', async () => {
    authService.validateUser.mockResolvedValue(safeUser);

    await expect(strategy.validate('flux_user', 'pw')).resolves.toBe(safeUser);
    expect(authService.validateUser).toHaveBeenCalledWith('flux_user', 'pw');
  });

  it('throws UnauthorizedException when validateUser returns null', async () => {
    authService.validateUser.mockResolvedValue(null);

    await expect(strategy.validate('flux_user', 'bad')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
