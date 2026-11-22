// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { isIP } from 'node:net'
import type { RegistrySourceType } from '@ihui/types'
import {
  type RawRegistryItem,
  type RegistryAdapter,
  type SyncOptions,
  RegistryAdapterError,
  fetchWithTimeout,
} from './types.js'

// SSRF 防护:禁止内网地址 / 非白名单协议
const BLOCKED_IPV4_PATTERNS = [
  /^127\./, // loopback
  /^10\./, // private A
  /^172\.(1[6-9]|2[0-9]|3[01])\./, // private B
  /^192\.168\./, // private C
  /^169\.254\./, // link-local (AWS metadata)
  /^0\./, // current network
]

/** F-347:`URL.hostname` 对 IPv6 返回带方括号的 `[::1]`,直接 isIP 会得 0 而整体跳过内网判断。 */
function stripIpv6Brackets(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname
}

function isBlockedIpLiteral(hostname: string): boolean {
  const ip = stripIpv6Brackets(hostname)
  const family = isIP(ip)
  if (family === 4) {
    return BLOCKED_IPV4_PATTERNS.some((pattern) => pattern.test(ip))
  }
  if (family === 6) {
    const lower = ip.toLowerCase()
    if (lower === '::' || lower === '::1') return true
    if (/^f[cd][0-9a-f]{0,2}:/.test(lower)) return true // fc00::/7 unique local
    if (/^fe[89ab][0-9a-f]?:/.test(lower)) return true // fe80::/10 link-local
    // IPv4-mapped(::ffff:127.0.0.1);URL 会把这种写法归一成 ::ffff:7f00:1
    const dotted = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower)?.[1]
    if (dotted && isIP(dotted) === 4) {
      return BLOCKED_IPV4_PATTERNS.some((pattern) => pattern.test(dotted))
    }
    const hexMapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower)
    if (hexMapped) {
      const hi = parseInt(hexMapped[1]!, 16)
      const lo = parseInt(hexMapped[2]!, 16)
      const v4 = `${Math.floor(hi / 256)}.${hi % 256}.${Math.floor(lo / 256)}.${lo % 256}`
      return BLOCKED_IPV4_PATTERNS.some((pattern) => pattern.test(v4))
    }
  }
  return false
}

function validateRegistryUrl(urlStr: string): { valid: boolean; reason?: string } {
  let parsed: URL
  try {
    parsed = new URL(urlStr)
  } catch {
    return { valid: false, reason: 'invalid URL' }
  }
  // 协议限制:只允许 https(生产)或 http(开发)
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { valid: false, reason: `protocol ${parsed.protocol} not allowed` }
  }
  // 内网地址过滤
  const hostname = parsed.hostname
  if (hostname === 'localhost') {
    return { valid: false, reason: 'localhost blocked' }
  }
  if (isBlockedIpLiteral(hostname)) {
    return { valid: false, reason: `internal IP ${hostname} blocked` }
  }
  return { valid: true }
}

interface CustomRegistryResponse {
  items: RawRegistryItem[]
}

/** 手动跟随重定向的最大跳数。 */
const MAX_REDIRECT_HOPS = 3

export const customRegistryAdapter: RegistryAdapter = {
  name: 'custom',
  source: 'custom',
  async fetch(sourceType: RegistrySourceType, options?: SyncOptions): Promise<RawRegistryItem[]> {
    const timeoutMs = options?.timeoutMs ?? 15000
    const url = options?.customRegistryUrl ?? process.env.IHUI_CUSTOM_REGISTRY_URL

    // 未配置自定义 registry 时直接跳过。
    // 2026-09-06 修复:此前回退到 registry.aizhs.top 默认域名(该域名未上线,DNS 解析失败),
    // 导致每次同步必然产生 "Custom registry fetch failed" 噪音日志。
    if (!url) {
      return []
    }

    // SSRF 防护:校验 URL 协议 + 内网地址
    const validation = validateRegistryUrl(url)
    if (!validation.valid) {
      throw new RegistryAdapterError(`custom registry URL blocked: ${validation.reason}`, 'custom')
    }

    try {
      let currentUrl = `${url}?source_type=${encodeURIComponent(sourceType)}`
      // F-347:禁止自动跟随 3xx —— 唯一实现是逐跳手动跟随并重跑内网校验,
      // 否则公网地址 302 到 169.254.169.254 会绕过 SSRF 防护。
      for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
        const hopValidation = validateRegistryUrl(currentUrl)
        if (!hopValidation.valid) {
          throw new RegistryAdapterError(
            `custom registry URL blocked: ${hopValidation.reason}`,
            'custom',
          )
        }
        const res = await fetchWithTimeout(currentUrl, { redirect: 'manual' }, timeoutMs)
        if (res.status >= 300 && res.status < 400) {
          const location = res.headers.get('location')
          if (!location) {
            throw new RegistryAdapterError('Custom registry redirect without location', 'custom')
          }
          currentUrl = new URL(location, currentUrl).toString()
          continue
        }
        if (!res.ok) {
          throw new RegistryAdapterError(
            `Custom registry returned ${res.status} for ${url}`,
            'custom',
          )
        }
        const data = (await res.json()) as CustomRegistryResponse
        return data.items ?? []
      }
      throw new RegistryAdapterError(`Custom registry too many redirects (>${MAX_REDIRECT_HOPS})`, 'custom')
    } catch (err) {
      if (err instanceof RegistryAdapterError) throw err
      throw new RegistryAdapterError(
        `Custom registry fetch failed: ${err instanceof Error ? err.message : String(err)}`,
        'custom',
        err,
      )
    }
  },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
