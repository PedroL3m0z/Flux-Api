import { BadRequestException } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * SSRF guard for outbound webhook URLs. Operators can register an arbitrary URL
 * that the delivery worker then POSTs to, so without these checks a webhook
 * could be aimed at the host's own loopback, the private network, or a cloud
 * metadata endpoint (169.254.169.254) to reach internal services.
 *
 * Two layers:
 * - {@link assertSafeWebhookUrl} validates the literal URL at create/update time
 *   (scheme + obvious internal hosts).
 * - {@link assertSafeResolvedUrl} additionally resolves the hostname right before
 *   delivery, closing the DNS-rebinding gap where a public name later resolves
 *   to a private address.
 */

const BLOCKED_HOSTNAMES = new Set(['localhost']);

/** Lowercases a URL hostname and unwraps an `[ipv6]` literal. */
function unwrapHost(hostname: string): string {
  const host = hostname.toLowerCase();
  return host.startsWith('[') && host.endsWith(']')
    ? host.slice(1, -1)
    : host;
}

/** True for loopback, private, link-local, CGNAT or otherwise reserved IPs. */
export function isPrivateIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    return isPrivateIpv4(ip);
  }
  if (version === 6) {
    return isPrivateIpv6(ip);
  }
  // Not a parseable IP: treat as unsafe so callers fail closed.
  return true;
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number(p));
  if (
    parts.length !== 4 ||
    parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)
  ) {
    return true; // malformed → unsafe
  }
  const [a, b] = parts;
  if (a === 0) return true; // "this" network
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT (100.64.0.0/10)
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const addr = ip.toLowerCase().split('%')[0]; // strip zone id
  if (addr === '::1' || addr === '::') return true; // loopback / unspecified
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(addr);
  if (mapped) return isPrivateIpv4(mapped[1]); // IPv4-mapped
  const hextet = parseInt(addr.split(':')[0] || '0', 16);
  if ((hextet & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if ((hextet & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  return false;
}

/** Parses and validates the literal webhook URL. Throws on an unsafe target. */
export function assertSafeWebhookUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BadRequestException('Invalid webhook URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BadRequestException('Webhook URL must use http or https');
  }
  // WHATWG URL keeps the brackets around an IPv6 literal (e.g. "[::1]");
  // strip them so `isIP` recognizes the address.
  const host = unwrapHost(url.hostname);
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith('.localhost')) {
    throw new BadRequestException('Webhook URL host is not allowed');
  }
  if (isIP(host) && isPrivateIp(host)) {
    throw new BadRequestException(
      'Webhook URL must not target a private or reserved address',
    );
  }
  return url;
}

/**
 * Delivery-time guard: re-validates the literal URL, then resolves the hostname
 * and rejects if any resolved address is private/reserved (DNS rebinding).
 */
export async function assertSafeResolvedUrl(raw: string): Promise<void> {
  const url = assertSafeWebhookUrl(raw);
  const host = unwrapHost(url.hostname);
  if (isIP(host)) {
    return; // literal IP already checked above
  }
  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new Error(`Could not resolve webhook host "${host}"`);
  }
  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw new Error(
        `Webhook host "${host}" resolves to a private or reserved address`,
      );
    }
  }
}
