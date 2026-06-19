import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { GlobalRole } from './permissions';
import { ROLES_KEY } from './roles.decorator';

interface RequestWithUser extends Request {
  user?: { role?: GlobalRole };
}

/**
 * Enforces `@Roles(...)` for global-role-gated routes (e.g. admin-only user
 * management). Routes without the decorator pass through.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<GlobalRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles || roles.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const role = request.user?.role;
    if (!role || !roles.includes(role)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
