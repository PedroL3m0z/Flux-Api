import { createHmac } from 'node:crypto';

/** HMAC-SHA256 signature of a payload, formatted `sha256=<hex>`. */
export function signPayload(secret: string, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}
