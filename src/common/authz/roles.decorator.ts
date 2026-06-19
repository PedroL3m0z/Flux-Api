import { SetMetadata } from '@nestjs/common';
import type { GlobalRole } from './permissions';

export const ROLES_KEY = 'roles';

/** Restricts a route to the given global role(s). Enforced by `RolesGuard`. */
export const Roles = (...roles: GlobalRole[]) => SetMetadata(ROLES_KEY, roles);
