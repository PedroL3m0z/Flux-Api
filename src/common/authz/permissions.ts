/**
 * Global dashboard permission levels. Every authenticated user is authorized
 * against the same role → permission map; there is no per-instance membership.
 */

/** Dashboard role (mirrors the Prisma `Role` enum). */
export type UserRole = 'admin' | 'operator' | 'viewer';

/** @deprecated alias kept for gradual migration in types */
export type GlobalRole = UserRole;

/** Fine-grained actions guarded on routes. */
export type Permission =
  | 'instance:read'
  | 'instance:manage'
  | 'instance:delete'
  | 'chat:read'
  | 'message:read'
  | 'message:send'
  | 'media:send'
  | 'webhook:read'
  | 'webhook:manage'
  | 'user:read'
  | 'user:manage';

const VIEWER: Permission[] = [
  'instance:read',
  'chat:read',
  'message:read',
  'webhook:read',
];

const OPERATOR: Permission[] = [
  ...VIEWER,
  'instance:manage',
  'instance:delete',
  'message:send',
  'media:send',
  'webhook:manage',
];

/** All permissions — granted to global admins. */
export const ALL_PERMISSIONS: Permission[] = [
  ...OPERATOR,
  'user:read',
  'user:manage',
];

/** Role → granted permissions. */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: ALL_PERMISSIONS,
  operator: OPERATOR,
  viewer: VIEWER,
};

/** Permissions granted to a role, as a Set for O(1) checks. */
export function permissionsFor(role: UserRole): Set<Permission> {
  return new Set(ROLE_PERMISSIONS[role]);
}

/** Whether a role grants a permission. */
export function roleHas(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
