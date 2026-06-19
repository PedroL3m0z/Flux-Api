import { applyDecorators, SetMetadata } from '@nestjs/common';
import type { Permission } from './permissions';

export const INSTANCE_PERMISSION_KEY = 'instancePermission';

/** Metadata key for the route param holding the instance id (defaults to `id`). */
export const INSTANCE_ID_PARAM_KEY = 'instanceIdParam';

/**
 * Requires a permission on the instance referenced by a route param.
 * The `InstanceAccessGuard` reads this metadata, resolves the caller's access
 * and rejects with 403 when the permission is missing.
 */
export function RequireInstancePermission(
  permission: Permission,
  idParam = 'id',
) {
  return applyDecorators(
    SetMetadata(INSTANCE_PERMISSION_KEY, permission),
    SetMetadata(INSTANCE_ID_PARAM_KEY, idParam),
  );
}
