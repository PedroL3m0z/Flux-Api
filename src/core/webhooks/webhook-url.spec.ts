import { BadRequestException } from '@nestjs/common';
import {
  assertSafeWebhookUrl,
  isAlwaysBlockedIp,
  isPrivateIp,
} from './webhook-url';

describe('isPrivateIp', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254', // cloud metadata
    '100.64.0.1', // CGNAT
    '0.0.0.0',
    '::1',
    'fc00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
  ])('flags %s as private/reserved', (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '1.1.1.1', '203.0.113.10', '2606:4700:4700::1111'])(
    'allows public %s',
    (ip) => {
      expect(isPrivateIp(ip)).toBe(false);
    },
  );

  it('treats a non-IP string as unsafe (fail closed)', () => {
    expect(isPrivateIp('not-an-ip')).toBe(true);
  });
});

describe('assertSafeWebhookUrl', () => {
  it('accepts a public https URL', () => {
    expect(() =>
      assertSafeWebhookUrl('https://hooks.example.com/x'),
    ).not.toThrow();
  });

  it('rejects a non-http scheme', () => {
    expect(() => assertSafeWebhookUrl('ftp://example.com')).toThrow(
      BadRequestException,
    );
    expect(() => assertSafeWebhookUrl('file:///etc/passwd')).toThrow(
      BadRequestException,
    );
  });

  it('rejects localhost and *.localhost', () => {
    expect(() => assertSafeWebhookUrl('http://localhost/x')).toThrow(
      BadRequestException,
    );
    expect(() => assertSafeWebhookUrl('http://api.localhost/x')).toThrow(
      BadRequestException,
    );
  });

  it('rejects literal private/loopback/metadata IPs', () => {
    expect(() => assertSafeWebhookUrl('http://127.0.0.1/x')).toThrow(
      BadRequestException,
    );
    expect(() => assertSafeWebhookUrl('http://169.254.169.254/latest')).toThrow(
      BadRequestException,
    );
    expect(() => assertSafeWebhookUrl('http://[::1]/x')).toThrow(
      BadRequestException,
    );
  });

  it('rejects a malformed URL', () => {
    expect(() => assertSafeWebhookUrl('not a url')).toThrow(
      BadRequestException,
    );
  });
});

describe('isAlwaysBlockedIp', () => {
  it.each(['169.254.169.254', '169.254.0.1', 'fe80::1', '::ffff:169.254.0.1'])(
    'flags %s (link-local / metadata) even with allowInternal',
    (ip) => {
      expect(isAlwaysBlockedIp(ip)).toBe(true);
    },
  );

  it.each(['10.0.0.1', '192.168.1.1', '127.0.0.1', '8.8.8.8'])(
    'does not flag %s as always-blocked',
    (ip) => {
      expect(isAlwaysBlockedIp(ip)).toBe(false);
    },
  );
});

describe('assertSafeWebhookUrl with allowInternal', () => {
  it('permits localhost and private hosts/IPs when opted in', () => {
    expect(() =>
      assertSafeWebhookUrl('http://localhost/x', true),
    ).not.toThrow();
    expect(() => assertSafeWebhookUrl('http://n8n:5678/x', true)).not.toThrow();
    expect(() =>
      assertSafeWebhookUrl('http://192.168.1.10:5678/x', true),
    ).not.toThrow();
    expect(() => assertSafeWebhookUrl('http://[::1]/x', true)).not.toThrow();
  });

  it('still blocks cloud-metadata / link-local even when opted in', () => {
    expect(() =>
      assertSafeWebhookUrl('http://169.254.169.254/latest', true),
    ).toThrow(BadRequestException);
  });
});
