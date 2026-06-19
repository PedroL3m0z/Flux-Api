import { applyDecorators, SetMetadata } from '@nestjs/common';
import type { Permission } from './permissions';

export const INSTANCE_PERMISSION_KEY = 'instancePermission';

/** Metadata key for the route param holding the instance id (defaults to `id`). */
export const INSTANCE_ID_PARAM_KEY = 'instanceIdParam';

/**
 * Requires a permission on instance-scoped routes. Authorization uses the
 * caller's global dashboard role (see {@link AccessService}), not membership
 * on the instance referenced by the route param.
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
