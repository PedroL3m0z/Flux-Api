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

export interface SafeUser {
  id: string;
  email: string;
  username: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly hashing: HashingService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<SafeUser> {
    const existing = await this.usersService.findByUsernameOrEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email or username already in use');
    }
    const password = await this.hashing.hash(dto.password);
    const user = await this.usersService.create({
      email: dto.email,
      username: dto.username,
      password,
    });
    return { id: user.id, email: user.email, username: user.username };
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
    return { id: user.id, email: user.email, username: user.username };
  }

  async login(user: SafeUser): Promise<{ accessToken: string }> {
    if (!user) {
      throw new UnauthorizedException();
    }
    const payload: JwtPayload = { sub: user.id, username: user.username };
    return { accessToken: await this.jwt.signAsync(payload) };
  }
}
