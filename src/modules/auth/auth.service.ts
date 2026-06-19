import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { HashingService } from '../../common/hashing/hashing.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import type { JwtPayload } from './strategies/jwt.strategy';
import type { UserRole } from '../../common/authz/permissions';

export interface SafeUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
}

/** True for a Prisma unique-constraint violation (error code P2002). */
function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly hashing: HashingService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<SafeUser> {
    const existing = await this.usersService.findByEmailOrUsername(
      dto.email,
      dto.username,
    );
    if (existing) {
      throw new ConflictException('Email or username already in use');
    }
    const password = await this.hashing.hash(dto.password);
    try {
      const user = await this.usersService.create({
        email: dto.email,
        username: dto.username,
        password,
      });
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      };
    } catch (error) {
      // Unique-constraint race: another request created the same email/username
      // between the check above and this insert. Prisma reports it as P2002.
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Email or username already in use');
      }
      throw error;
    }
  }

  /** Used by LocalStrategy. Returns the safe user or null. */
  async validateUser(
    identifier: string,
    password: string,
  ): Promise<SafeUser | null> {
    const user = await this.usersService.findByUsernameOrEmail(identifier);
    if (!user) {
      return null;
    }
    const valid = await this.hashing.verify(user.password, password);
    if (!valid) {
      return null;
    }
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    };
  }

  async login(user: SafeUser): Promise<{ accessToken: string }> {
    if (!user) {
      throw new UnauthorizedException();
    }
    const payload: JwtPayload = { sub: user.id, username: user.username };
    return { accessToken: await this.jwt.signAsync(payload) };
  }
}
