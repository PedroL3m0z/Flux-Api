import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { NO_API_KEY } from '../../../common/decorators/no-api-key.decorator';
import { safeEqual } from '../../../common/security/safe-compare';
import { API_KEY_HEADER } from '../strategies/api-key.strategy';

/**
 * Global guard requiring a valid API key on every request, on top of JWT auth.
 * Routes marked @Public() or @NoApiKey() are skipped. The key is read from the
 * `x-api-key` header, falling back to an `apiKey` query param so browser-driven
 * requests that cannot set headers (SSE EventSource, <img>/<a> media URLs) can
 * still authenticate.
 */
@Injectable()
export class GlobalApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const skip =
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ||
      this.reflector.getAllAndOverride<boolean>(NO_API_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
    if (skip) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers?.[API_KEY_HEADER];
    const fromHeader = Array.isArray(header) ? header[0] : header;
    const fromQuery = req.query?.apiKey;
    const provided =
      fromHeader ?? (typeof fromQuery === 'string' ? fromQuery : undefined);

    const expected = this.config.get<string>('API_KEY');
    if (expected && safeEqual(provided, expected)) {
      return true;
    }
    throw new UnauthorizedException('Missing or invalid API key');
  }
}
