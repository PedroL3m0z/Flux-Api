import { BadRequestException } from '@nestjs/common';
import { assertSafeWebhookUrl, isPrivateIp } from './webhook-url';

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
