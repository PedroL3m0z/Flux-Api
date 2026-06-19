import { SetMetadata } from '@nestjs/common';
import type { UserRole } from './permissions';

export const ROLES_KEY = 'roles';

/** Restricts a route to the given global dashboard role(s). Enforced by `RolesGuard`. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
