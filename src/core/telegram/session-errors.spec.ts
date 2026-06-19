import { isSessionRevokedError, sessionRevokedMessage } from './session-errors';

describe('session-errors', () => {
  it('detects AUTH_KEY_UNREGISTERED', () => {
    expect(isSessionRevokedError(new Error('401: AUTH_KEY_UNREGISTERED'))).toBe(
      true,
    );
  });

  it('detects SESSION_REVOKED by code', () => {
    expect(isSessionRevokedError({ code: 401, message: 'nope' })).toBe(true);
  });

  it('ignores unrelated errors', () => {
    expect(isSessionRevokedError(new Error('NETWORK_TIMEOUT'))).toBe(false);
  });

  it('extracts message from Error', () => {
    expect(sessionRevokedMessage(new Error('SESSION_REVOKED'))).toBe(
      'SESSION_REVOKED',
    );
  });
});
