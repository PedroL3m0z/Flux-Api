import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { ACCESS_TOKEN_COOKIE } from '../auth.cookie';

export interface JwtPayload {
  sub: string;
  username: string;
}

/** Reads the JWT from the httpOnly cookie (SPA), falling back to the header. */
function cookieExtractor(req: Request): string | null {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const token = cookies?.[ACCESS_TOKEN_COOKIE];
  return typeof token === 'string' ? token : null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'dev-secret-change-me'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    const { password: _password, ...safe } = user;
    return safe;
  }
}
