const SESSION_REVOKED_MARKERS = [
  'AUTH_KEY_UNREGISTERED',
  'SESSION_REVOKED',
  'SESSION_EXPIRED',
  'USER_DEACTIVATED',
] as const;

/** True when Telegram rejected the saved auth key (remote logout, revoked session, etc.). */
export function isSessionRevokedError(error: unknown): boolean {
  if (error == null) {
    return false;
  }
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  const upper = message.toUpperCase();
  if (SESSION_REVOKED_MARKERS.some((m) => upper.includes(m))) {
    return true;
  }
  if (typeof error === 'object' && error !== null) {
    const code = (error as { code?: number }).code;
    if (code === 401 || code === 406) {
      return true;
    }
    const errorMessage = (error as { errorMessage?: string }).errorMessage;
    if (
      typeof errorMessage === 'string' &&
      SESSION_REVOKED_MARKERS.some((m) =>
        errorMessage.toUpperCase().includes(m),
      )
    ) {
      return true;
    }
  }
  return false;
}

export function sessionRevokedMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Session was revoked or expired';
}
