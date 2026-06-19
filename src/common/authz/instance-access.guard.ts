import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import {
  AccessService,
  type AccessPrincipal,
  type UserAccess,
} from './access.service';
import type { Permission } from './permissions';
import {
  INSTANCE_ID_PARAM_KEY,
  INSTANCE_PERMISSION_KEY,
} from './require-instance-permission.decorator';

interface RequestWithAccess extends Request {
  user?: AccessPrincipal;
  userAccess?: UserAccess;
}

/**
 * Enforces `@RequireInstancePermission(...)`. Checks the caller's **global**
 * dashboard role against the required permission. The route may still carry an
 * instance id param for resource lookup; access is not scoped per instance.
 */
@Injectable()
export class InstanceAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: AccessService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const permission = this.reflector.getAllAndOverride<Permission | undefined>(
      INSTANCE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!permission) {
      return true;
    }

    // Instance id param is validated by the controller; kept for route shape.
    void this.reflector.getAllAndOverride<string | undefined>(
      INSTANCE_ID_PARAM_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<RequestWithAccess>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Not authenticated');
    }

    const access = this.access.resolve(user);
    if (!access.permissions.has(permission)) {
      throw new ForbiddenException(`Missing permission "${permission}"`);
    }
    request.userAccess = access;
    return true;
  }
}
