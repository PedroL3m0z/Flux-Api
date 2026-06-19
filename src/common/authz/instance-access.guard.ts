import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import {
  InstanceAccessService,
  type AccessPrincipal,
  type InstanceAccess,
} from '../../core/telegram/services/instance-access.service';
import type { Permission } from './permissions';
import {
  INSTANCE_ID_PARAM_KEY,
  INSTANCE_PERMISSION_KEY,
} from './require-instance-permission.decorator';

interface RequestWithAccess extends Request {
  user?: AccessPrincipal;
  instanceAccess?: InstanceAccess;
}

/**
 * Enforces `@RequireInstancePermission(...)`. Resolves the caller's effective
 * access to the instance in the route param and rejects with 403 when the
 * required permission is missing. Routes without the decorator pass through.
 * The resolved access is attached to `request.instanceAccess`.
 */
@Injectable()
export class InstanceAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: InstanceAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<Permission | undefined>(
      INSTANCE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!permission) {
      return true;
    }
    const idParam =
      this.reflector.getAllAndOverride<string | undefined>(
        INSTANCE_ID_PARAM_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? 'id';

    const request = context.switchToHttp().getRequest<RequestWithAccess>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Not authenticated');
    }
    const instanceId = (request.params as Record<string, string>)[idParam];
    if (!instanceId) {
      throw new ForbiddenException('Missing instance id');
    }

    const access = await this.access.resolve(user, instanceId);
    if (!access.permissions.has(permission)) {
      throw new ForbiddenException(
        `Missing permission "${permission}" on this instance`,
      );
    }
    request.instanceAccess = access;
    return true;
  }
}
