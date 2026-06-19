/**
 * Authorization primitives shared across the app.
 *
 * Access to an instance resolves to an effective role, which maps to a set of
 * permissions. Global `admin` users bypass instance checks entirely; any other
 * authenticated user has the `viewer` baseline on every instance and is elevated
 * to `operator`/`owner` by an explicit `InstanceMember` row.
 */

/** Global user role (mirrors the Prisma `Role` enum). */
export type GlobalRole = 'admin' | 'member';

/** Per-instance role (mirrors the Prisma `InstanceRole` enum). */
export type InstanceRole = 'owner' | 'operator' | 'viewer';

/** Effective role used for permission resolution (`admin` = global superuser). */
export type EffectiveRole = 'admin' | InstanceRole;

/** Fine-grained actions guarded on instance-scoped routes. */
export type Permission =
  | 'instance:read'
  | 'instance:manage' // start / stop / login lifecycle
  | 'instance:update'
  | 'instance:delete'
  | 'chat:read'
  | 'message:read'
  | 'message:send'
  | 'media:send'
  | 'member:read'
  | 'member:manage'
  | 'webhook:read'
  | 'webhook:manage';

const VIEWER: Permission[] = ['instance:read', 'chat:read', 'message:read'];

const OPERATOR: Permission[] = [
  ...VIEWER,
  'instance:manage',
  'message:send',
  'media:send',
  'member:read',
  'webhook:read',
  'webhook:manage',
];

const OWNER: Permission[] = [
  ...OPERATOR,
  'instance:update',
  'instance:delete',
  'member:manage',
];

/** All permissions — granted to global admins. */
export const ALL_PERMISSIONS: Permission[] = [...OWNER];

/** Effective role → granted permissions. */
export const ROLE_PERMISSIONS: Record<EffectiveRole, Permission[]> = {
  admin: ALL_PERMISSIONS,
  owner: OWNER,
  operator: OPERATOR,
  viewer: VIEWER,
};

/** Permissions granted to an effective role, as a Set for O(1) checks. */
export function permissionsFor(role: EffectiveRole): Set<Permission> {
  return new Set(ROLE_PERMISSIONS[role]);
}

/** Whether an effective role grants a permission. */
export function roleHas(role: EffectiveRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
