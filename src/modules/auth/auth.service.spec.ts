import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { HashingService } from '../../common/hashing/hashing.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let users: jest.Mocked<
    Pick<UsersService, 'findByUsernameOrEmail' | 'create'>
  >;
  let hashing: jest.Mocked<Pick<HashingService, 'hash' | 'verify'>>;
  let jwt: jest.Mocked<Pick<JwtService, 'signAsync'>>;

  const dbUser = {
    id: 'u1',
    email: 'user@flux.dev',
    username: 'flux_user',
    password: 'hashed',
  };
  const safeUser = { id: 'u1', email: 'user@flux.dev', username: 'flux_user' };

  beforeEach(() => {
    users = {
      findByUsernameOrEmail: jest.fn(),
      create: jest.fn(),
    };
    hashing = { hash: jest.fn(), verify: jest.fn() };
    jwt = { signAsync: jest.fn() };
    service = new AuthService(
      users as unknown as UsersService,
      hashing,
      jwt as unknown as JwtService,
    );
  });

  describe('register', () => {
    const dto = {
      email: 'user@flux.dev',
      username: 'flux_user',
      password: 'S3cureP@ss',
    };

    it('hashes the password and returns a safe user (no password)', async () => {
      users.findByUsernameOrEmail.mockResolvedValue(null);
      hashing.hash.mockResolvedValue('hashed');
      users.create.mockResolvedValue(dbUser as never);

      const result = await service.register(dto);

      expect(hashing.hash).toHaveBeenCalledWith('S3cureP@ss');
      expect(users.create).toHaveBeenCalledWith({
        email: 'user@flux.dev',
        username: 'flux_user',
        password: 'hashed',
      });
      expect(result).toEqual(safeUser);
      expect(result).not.toHaveProperty('password');
    });

    it('throws ConflictException when the user already exists', async () => {
      users.findByUsernameOrEmail.mockResolvedValue(dbUser as never);

      await expect(service.register(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(users.create).not.toHaveBeenCalled();
      expect(hashing.hash).not.toHaveBeenCalled();
    });
  });

  describe('validateUser', () => {
    it('returns null when the user is not found', async () => {
      users.findByUsernameOrEmail.mockResolvedValue(null);
      await expect(service.validateUser('nobody', 'pw')).resolves.toBeNull();
      expect(hashing.verify).not.toHaveBeenCalled();
    });

    it('returns null when the password is wrong', async () => {
      users.findByUsernameOrEmail.mockResolvedValue(dbUser as never);
      hashing.verify.mockResolvedValue(false);
      await expect(
        service.validateUser('flux_user', 'bad'),
      ).resolves.toBeNull();
    });

    it('returns the safe user when credentials are valid', async () => {
      users.findByUsernameOrEmail.mockResolvedValue(dbUser as never);
      hashing.verify.mockResolvedValue(true);

      const result = await service.validateUser('flux_user', 'S3cureP@ss');

      expect(hashing.verify).toHaveBeenCalledWith('hashed', 'S3cureP@ss');
      expect(result).toEqual(safeUser);
    });
  });

  describe('login', () => {
    it('signs a JWT with sub + username', async () => {
      jwt.signAsync.mockResolvedValue('signed.jwt.token');

      const result = await service.login(safeUser);

      expect(jwt.signAsync).toHaveBeenCalledWith({
        sub: 'u1',
        username: 'flux_user',
      });
      expect(result).toEqual({ accessToken: 'signed.jwt.token' });
    });

    it('throws UnauthorizedException when no user is provided', async () => {
      await expect(service.login(undefined as never)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });
  });
});
