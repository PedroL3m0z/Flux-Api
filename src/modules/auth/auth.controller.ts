import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthService, type SafeUser } from './auth.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  ACCESS_TOKEN_COOKIE,
  accessTokenCookieOptions,
  expiresInToMs,
} from './auth.cookie';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ApiKeyAuthGuard } from './guards/api-key-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  private setAuthCookie(res: Response, token: string): void {
    const maxAge = expiresInToMs(
      this.config.get<string>('JWT_EXPIRES_IN', '3600s'),
    );
    // `secure` requires HTTPS — a Secure cookie is never sent over plain HTTP.
    // Driven by COOKIE_SECURE (set it true when serving behind TLS), not by
    // NODE_ENV, so http deployments and local docker still work.
    const secure = this.config.get<string>('COOKIE_SECURE') === 'true';
    res.cookie(
      ACCESS_TOKEN_COOKIE,
      token,
      accessTokenCookieOptions(maxAge, secure),
    );
  }

  @Post('register')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a user (JWT protected; the seeded user creates others)',
  })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @ApiBody({ type: LoginDto })
  @ApiOperation({
    summary:
      'Login with username/email + password; sets an httpOnly JWT cookie',
  })
  async login(
    @CurrentUser() user: SafeUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(user);
    this.setAuthCookie(res, result.accessToken);
    return result;
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear the auth cookie' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current user (JWT protected)' })
  me(@CurrentUser() user: SafeUser) {
    return user;
  }

  @Get('api-key-check')
  @Public()
  @UseGuards(ApiKeyAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Example route protected by static API key' })
  apiKeyCheck() {
    return { ok: true, via: 'api-key' };
  }
}
