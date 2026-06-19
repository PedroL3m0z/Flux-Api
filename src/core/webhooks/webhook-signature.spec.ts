import { createHmac } from 'node:crypto';
import { signPayload } from './webhook-signature';

describe('signPayload', () => {
  it('produces a deterministic sha256= HMAC', () => {
    const body = '{"hello":"world"}';
    const expected = `sha256=${createHmac('sha256', 'secret').update(body).digest('hex')}`;
    expect(signPayload('secret', body)).toBe(expected);
  });

  it('changes with the secret', () => {
    const body = 'x';
    expect(signPayload('a', body)).not.toBe(signPayload('b', body));
  });
});
