import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

const ENC_PREFIX = 'enc:v1:';

/** Derives a 32-byte AES key from a secret, or null when no secret is set. */
export function deriveKey(secret: string | undefined): Buffer | null {
  return secret ? createHash('sha256').update(secret).digest() : null;
}

/**
 * Encrypts a secret (Telegram session string, api_hash) with AES-256-GCM.
 * Without a key it returns the plaintext unchanged (caller should warn).
 */
export function encryptSecret(plain: string, key: Buffer | null): string {
  if (!key) {
    return plain;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

/** Reverses encryptSecret. Plaintext (un-prefixed) values pass through. */
export function decryptSecret(stored: string, key: Buffer | null): string {
  if (!stored.startsWith(ENC_PREFIX)) {
    return stored;
  }
  if (!key) {
    throw new Error(
      'Encrypted value found but TELEGRAM_SESSION_SECRET is not set',
    );
  }
  const [ivB64, tagB64, dataB64] = stored.slice(ENC_PREFIX.length).split(':');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivB64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
