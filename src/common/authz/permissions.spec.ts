import { permissionsFor, roleHas } from './permissions';

describe('permissions', () => {
  it('viewer can read but not send or manage', () => {
    const p = permissionsFor('viewer');
    expect(p.has('message:read')).toBe(true);
    expect(p.has('message:send')).toBe(false);
    expect(p.has('member:manage')).toBe(false);
  });

  it('operator can send and manage webhooks but not members', () => {
    expect(roleHas('operator', 'message:send')).toBe(true);
    expect(roleHas('operator', 'media:send')).toBe(true);
    expect(roleHas('operator', 'webhook:manage')).toBe(true);
    expect(roleHas('operator', 'member:manage')).toBe(false);
    expect(roleHas('operator', 'instance:delete')).toBe(false);
  });

  it('owner can manage members and delete the instance', () => {
    expect(roleHas('owner', 'member:manage')).toBe(true);
    expect(roleHas('owner', 'instance:delete')).toBe(true);
    expect(roleHas('owner', 'instance:update')).toBe(true);
  });

  it('admin has every permission an owner has', () => {
    const owner = permissionsFor('owner');
    const admin = permissionsFor('admin');
    for (const perm of owner) {
      expect(admin.has(perm)).toBe(true);
    }
  });

  it('roles are strictly increasing in privilege', () => {
    expect(permissionsFor('operator').size).toBeGreaterThan(
      permissionsFor('viewer').size,
    );
    expect(permissionsFor('owner').size).toBeGreaterThan(
      permissionsFor('operator').size,
    );
  });
});
