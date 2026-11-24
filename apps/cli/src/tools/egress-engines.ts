// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

export type EgressVerdict =
  | { verdict: 'deny'; engine: 'dns' | 'tcp'; reason: 'listed' }
  | { verdict: 'allow'; engine: 'dns' | 'tcp'; reason: 'not-listed' }
  | { verdict: 'unjudged'; reason: 'host-unmeasured' | 'host-invalid' | 'list-unmeasured' | 'list-invalid' }

function normalizeHost(host: string): string {
  let value = host.trim().toLowerCase()
  if (value.startsWith('[') && value.endsWith(']')) value = value.slice(1, -1)
  if (value.endsWith('.')) value = value.slice(0, -1)
  return value
}

function isIpv4(host: string): boolean {
  const parts = host.split('.')
  if (parts.length !== 4) return false
  return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

function isIpv6(host: string): boolean {
  if (!host.includes(':')) return false
  return /^[0-9a-f:]+$/.test(host)
}

function cleanList(list: string[] | null): string[] | null {
  if (list === null) return null
  const cleaned: string[] = []
  for (const entry of list) {
    if (typeof entry !== 'string' || entry.trim() === '') return null
    cleaned.push(normalizeHost(entry))
  }
  return cleaned
}

function domainListed(host: string, list: string[]): boolean {
  return list.some((entry) => host === entry || host.endsWith(`.${entry}`))
}

/**
 * 域名只问域名拒绝表，IP 只问地址拒绝表。
 * 表是 null 表示没量到，不得当成空表放行。
 */
export function judgeEgress(input: {
  host: string | null
  denyDomains: string[] | null
  denyIps: string[] | null
}): EgressVerdict {
  if (input.host === null || input.host.trim() === '') {
    return { verdict: 'unjudged', reason: 'host-unmeasured' }
  }
  const host = normalizeHost(input.host)
  if (host.length === 0 || host.includes('/') || host.includes(' ')) {
    return { verdict: 'unjudged', reason: 'host-invalid' }
  }
  const ip = isIpv4(host) || isIpv6(host)
  if (!ip && !/^[a-z0-9.-]+$/.test(host)) {
    return { verdict: 'unjudged', reason: 'host-invalid' }
  }
  const raw = ip ? input.denyIps : input.denyDomains
  if (raw === null) return { verdict: 'unjudged', reason: 'list-unmeasured' }
  const list = cleanList(raw)
  if (list === null) return { verdict: 'unjudged', reason: 'list-invalid' }
  if (ip) {
    return list.includes(host)
      ? { verdict: 'deny', engine: 'tcp', reason: 'listed' }
      : { verdict: 'allow', engine: 'tcp', reason: 'not-listed' }
  }
  return domainListed(host, list)
    ? { verdict: 'deny', engine: 'dns', reason: 'listed' }
    : { verdict: 'allow', engine: 'dns', reason: 'not-listed' }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
