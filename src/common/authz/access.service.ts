import { Injectable } from '@nestjs/common';
import { type Permission, type UserRole, permissionsFor } from './permissions';

/** The requesting principal, as attached to the request by the auth guards. */
export interface AccessPrincipal {
  id: string;
  role: UserRole;
}

/** Resolved access for the current principal (global, not per instance). */
export interface UserAccess {
  role: UserRole;
  permissions: Set<Permission>;
}

/**
 * Resolves global dashboard permissions from {@link AccessPrincipal.role}.
 */
@Injectable()
export class AccessService {
  resolve(principal: AccessPrincipal): UserAccess {
    return {
      role: principal.role,
      permissions: permissionsFor(principal.role),
    };
  }

  can(principal: AccessPrincipal, permission: Permission): boolean {
    return permissionsFor(principal.role).has(permission);
  }
}
