import { AccessService } from './access.service';
import { roleHas } from './permissions';

describe('permissions', () => {
  it('viewer is read-only', () => {
    expect(roleHas('viewer', 'instance:read')).toBe(true);
    expect(roleHas('viewer', 'message:send')).toBe(false);
    expect(roleHas('viewer', 'instance:delete')).toBe(false);
  });

  it('operator can manage instances and send messages', () => {
    expect(roleHas('operator', 'instance:manage')).toBe(true);
    expect(roleHas('operator', 'message:send')).toBe(true);
    expect(roleHas('operator', 'instance:delete')).toBe(true);
    expect(roleHas('operator', 'user:manage')).toBe(false);
  });

  it('admin has user management', () => {
    expect(roleHas('admin', 'user:manage')).toBe(true);
    expect(roleHas('admin', 'webhook:manage')).toBe(true);
  });
});

describe('AccessService', () => {
  const access = new AccessService();

  it('resolves permissions from the global role', () => {
    const resolved = access.resolve({ id: 'u1', role: 'operator' });
    expect(resolved.role).toBe('operator');
    expect(resolved.permissions.has('message:send')).toBe(true);
    expect(resolved.permissions.has('user:manage')).toBe(false);
  });

  it('can checks a permission', () => {
    expect(access.can({ id: 'u1', role: 'viewer' }, 'message:send')).toBe(
      false,
    );
    expect(access.can({ id: 'u1', role: 'admin' }, 'user:read')).toBe(true);
  });
});
