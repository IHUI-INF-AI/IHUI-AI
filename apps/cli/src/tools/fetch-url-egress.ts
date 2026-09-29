// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Literal-egress guard for fetch_url — a separate policy domain from the SSRF guard.
 *
 * Mechanism (mirrors the upstream webfetch literal-egress design, not its code):
 *  - NO DNS preflight. Only hosts that ARE IP literals are judged; plain domains
 *    pass through untouched. A local DNS preflight fails on some networks and
 *    would turn every public URL into a pre-fetch failure.
 *  - "Public" is an allow-list verdict (default non-public), not a deny-list:
 *    an IPv4/IPv6 literal must be an ordinary global unicast address.
 *  - Carrier forms are unwrapped BEFORE the verdict: IPv4-mapped (::ffff:/96)
 *    and NAT64/DNS64 well-known prefix (64:ff9b::/96) yield the embedded IPv4,
 *    which is then judged by the same IPv4 policy. 64:ff9b:1::/48 (local-use
 *    DNS64) is special-use and excluded as a whole range instead.
 *  - IPv6 special-use ranges (loopback, ULA, link-local, multicast, benchmark,
 *    ORCHID/ORCHIDv2, Teredo, 6to4, discard-only, documentation...) are
 *    explicitly excluded.
 *  - localhost / *.localhost are blocked at the hostname layer.
 *  - Error text NEVER echoes the unwrapped/resolved address: these messages go
 *    into model context, and a resolved private IP is a reconnaissance result.
 *
 * Deliberately NOT merged into `@ihui/shared/utils/ssrf-guard`: that module is
 * the deny-list domain (blocks known-bad ranges, does DNS resolution). This
 * module is the allow-list domain (only plain global unicast passes, does no
 * I/O at all). Same parser math, different predicates and different tables.
 */

/** Stable errorType surfaced on ToolResult so callers branch on it, not on prose. */
export const EGRESS_BLOCKED_ERROR_TYPE = 'egress_blocked';

export class EgressBlockedError extends Error {
  readonly code = 'EgressBlocked';
  constructor(message: string) {
    super(message);
    this.name = 'EgressBlockedError';
  }
}

export function isEgressBlockedError(err: unknown): err is EgressBlockedError {
  return err instanceof EgressBlockedError;
}

const HOSTNAME_MESSAGE =
  'WebFetch egress guard: cannot access private or local hostnames (EgressBlocked)';
const IP_MESSAGE =
  'WebFetch egress guard: cannot access private, reserved or non-public IP addresses (EgressBlocked)';

/**
 * Judge ONLY what the URL itself says. No DNS lookup happens anywhere in here.
 * Plain domains (example.com, anything.company.internal...) return normally —
 * name-based targets are the SSRF guard's domain, not this one's.
 */
export function assertFetchLiteralEgress(url: URL): void {
  const hostname = normalizeHostname(url.hostname);
  if (isLocalHostname(hostname)) throw new EgressBlockedError(HOSTNAME_MESSAGE);
  if (!isIpLiteral(hostname)) return;
  if (!isPublicIpAddress(hostname)) throw new EgressBlockedError(IP_MESSAGE);
}

function normalizeHostname(hostname: string): string {
  const trimmed = hostname.trim().toLowerCase();
  const withoutBrackets =
    trimmed.startsWith('[') && trimmed.endsWith(']') ? trimmed.slice(1, -1) : trimmed;
  // Strip a %25-encoded IPv6 zone id if a URL ever carries one.
  const zone = withoutBrackets.indexOf('%');
  const withoutZone = zone >= 0 ? withoutBrackets.slice(0, zone) : withoutBrackets;
  return withoutZone.endsWith('.') ? withoutZone.slice(0, -1) : withoutZone;
}

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname.endsWith('.localhost');
}

function isIpLiteral(hostname: string): boolean {
  return parseIpv4(hostname) !== null || parseIpv6(hostname) !== null;
}

// ───────────────────────────── IPv4 ─────────────────────────────

/**
 * Strict dotted-quad with BSD-style shorthand (1-3 segments, last segment
 * wide). WHATWG URL normalization already canonicalizes IPv4-like hosts before
 * they get here, so shorthand only matters for direct callers.
 */
function parseIpv4(text: string): bigint | null {
  const octets = text.split('.');
  if (octets.length === 0 || octets.length > 4) return null;
  let value = 0n;
  const remainingBits = 32 - 8 * (octets.length - 1);
  for (let i = 0; i < octets.length; i++) {
    const octet = octets[i]!;
    if (!/^\d{1,3}$/.test(octet)) return null;
    const n = Number(octet);
    const isLast = i === octets.length - 1;
    if (n > (isLast ? (1 << remainingBits) - 1 : 255)) return null;
    value = (value << BigInt(isLast ? remainingBits : 8)) | BigInt(n);
  }
  return value;
}

/** IPv4 ranges that are NOT ordinary global unicast (IANA special-purpose). */
const NON_PUBLIC_IPV4_RANGES: readonly { base: bigint; bits: number }[] = (
  [
    '0.0.0.0/8', // "this network"
    '10.0.0.0/8', // private A
    '100.64.0.0/10', // carrier-grade NAT
    '127.0.0.0/8', // loopback
    '169.254.0.0/16', // link-local (incl. cloud metadata)
    '172.16.0.0/12', // private B
    '192.0.0.0/24', // IETF protocol assignments
    '192.0.2.0/24', // TEST-NET-1
    '192.88.99.0/24', // 6to4 relay anycast (deprecated)
    '192.168.0.0/16', // private C
    '198.18.0.0/15', // benchmarking
    '198.51.100.0/24', // TEST-NET-2
    '203.0.113.0/24', // TEST-NET-3
    '224.0.0.0/4', // multicast
    '240.0.0.0/4', // reserved (incl. 255.255.255.255 broadcast)
  ] as const
).map((cidr) => {
  const [base, bits] = cidr.split('/');
  return { base: parseIpv4(base!)!, bits: Number(bits) };
});

function isPublicIpv4(value: bigint): boolean {
  return !NON_PUBLIC_IPV4_RANGES.some(
    ({ base, bits }) => (value >> BigInt(32 - bits)) === (base >> BigInt(32 - bits)),
  );
}

// ───────────────────────────── IPv6 ─────────────────────────────

/** IPv6 → 128-bit BigInt; tolerates `::` compression and a trailing dotted quad. */
function parseIpv6(text: string): bigint | null {
  let s = text.toLowerCase();
  if (s.includes('%')) s = s.slice(0, s.indexOf('%'));

  // Trailing dotted quad (::ffff:192.168.0.1) folds into two 16-bit groups first.
  if (s.includes('.')) {
    const lastColon = s.lastIndexOf(':');
    if (lastColon < 0) return null;
    const v4 = parseIpv4(s.slice(lastColon + 1));
    if (v4 === null) return null;
    s = `${s.slice(0, lastColon + 1)}${(v4 >> 16n).toString(16)}:${(v4 & 0xffffn).toString(16)}`;
  }

  const halves = s.split('::');
  if (halves.length > 2) return null;
  const toGroups = (segment: string): string[] | null => {
    if (segment === '') return [];
    const raw = segment.split(':');
    if (raw.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
    return raw;
  };

  const groupsToBigInt = (groups: readonly string[]): bigint => {
    let value = 0n;
    for (const g of groups) value = (value << 16n) | BigInt(parseInt(g, 16));
    return value;
  };

  if (halves.length === 1) {
    const groups = toGroups(s);
    if (!groups || groups.length !== 8) return null;
    return groupsToBigInt(groups);
  }
  const left = toGroups(halves[0] ?? '');
  const right = toGroups(halves[1] ?? '');
  if (!left || !right) return null;
  const fill = 8 - left.length - right.length;
  if (fill < 0) return null;
  return groupsToBigInt([...left, ...Array.from({ length: fill }, () => '0'), ...right]);
}

/** Unwrap carrier forms: return the embedded 32-bit IPv4, or null if not one. */
function unwrapCarrierIpv6(value: bigint): bigint | null {
  if (value >> 32n === 0xffffn) return value & 0xffffffffn; // ::ffff:0:0/96 mapped
  // NAT64/DNS64 well-known prefix (64:ff9b::/96): low 32 bits are the IPv4.
  if (value >> 96n === 0x64ff9bn) return value & 0xffffffffn;
  return null;
}

/**
 * IPv6 ranges that are not ordinary global unicast. Ranges with an embedded
 * IPv4 (mapped / NAT64 well-known) are handled by `unwrapCarrierIpv6` ABOVE
 * and therefore absent here; 64:ff9b:1::/48 (local-use DNS64) has no public
 * purpose at all and is excluded as a whole range.
 */
const NON_PUBLIC_IPV6_RANGES: readonly { base: bigint; bits: number }[] = (
  [
    '::/8', // reserved low block (unspecified ::, loopback ::1, ...)
    '64:ff9b:1::/48', // local-use DNS64 (RFC 8215)
    '100::/64', // discard-only (RFC 6666)
    '2001::/32', // Teredo
    '2001:2::/48', // benchmarking
    '2001:10::/28', // ORCHID
    '2001:20::/28', // ORCHIDv2
    '2001:db8::/32', // documentation
    '2002::/16', // 6to4
    'fc00::/7', // unique local
    'fe80::/10', // link-local
    'ff00::/8', // multicast
  ] as const
).map((cidr) => {
  const [base, bits] = cidr.split('/');
  return { base: parseIpv6(base!)!, bits: Number(bits) };
});

function isPublicIpv6(value: bigint): boolean {
  return !NON_PUBLIC_IPV6_RANGES.some(
    ({ base, bits }) => (value >> BigInt(128 - bits)) === (base >> BigInt(128 - bits)),
  );
}

function isPublicIpAddress(address: string): boolean {
  const v4 = parseIpv4(address);
  if (v4 !== null) return isPublicIpv4(v4);
  const v6 = parseIpv6(address);
  if (v6 === null) return false; // unparseable literal ⇒ fail closed
  const embedded = unwrapCarrierIpv6(v6);
  if (embedded !== null) return isPublicIpv4(embedded);
  return isPublicIpv6(v6);
}

// ─────────────────── egress-proxy allowlist + message hygiene ───────────────────

const PROXY_BLOCK_HEADER = 'x-proxy-error';
const PROXY_BLOCK_VALUE = 'blocked-by-allowlist';

/** Header shape (get(name): string | null) — satisfied by fetch's Headers. */
interface HeadersLike {
  get(name: string): string | null;
}

/**
 * Recognize an egress-proxy allowlist rejection announced via response header.
 * The proxy sees the real connection; this is the only proxy-side signal that
 * reaches us without a body.
 */
export function isProxyAllowlistBlock(headers: HeadersLike): boolean {
  return headers.get(PROXY_BLOCK_HEADER) === PROXY_BLOCK_VALUE;
}

/**
 * Proxy-block message. Mirrors the upstream JSON shape: it names the DOMAIN the
 * caller asked for (already in model context via the request), never any
 * resolved/unwrapped address.
 */
export function proxyAllowlistBlockedMessage(domain: string): string {
  return JSON.stringify({
    error_type: 'EGRESS_BLOCKED',
    domain,
    message: `Access to ${domain} is blocked by the network egress proxy.`,
  });
}

/**
 * Scrub lower-layer error text before it reaches model context. If the
 * underlying message mentions what a name "resolved to", that resolved address
 * is a reconnaissance result the model must not see — replace it with a
 * statement that carries the verdict but not the address.
 */
export function formatEgressBlockedMessage(message: string, domain: string): string {
  if (message.includes('resolved to')) {
    return `HTTP public egress blocked ${domain} because it resolved to a non-public address`;
  }
  return message;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
