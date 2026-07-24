import { isIP } from 'node:net'
import type { RegistrySourceType } from '@ihui/types'
import {
  type RawRegistryItem,
  type RegistryAdapter,
  type SyncOptions,
  RegistryAdapterError,
  fetchWithTimeout,
} from './types.js'

const DEFAULT_REGISTRY_URL = 'https://registry.ihui.ai/api/registry/items'

// SSRF 防护:禁止内网地址 / 非白名单协议
const BLOCKED_IP_PATTERNS = [
  /^127\./, // loopback
  /^10\./, // private A
  /^172\.(1[6-9]|2[0-9]|3[01])\./, // private B
  /^192\.168\./, // private C
  /^169\.254\./, // link-local (AWS metadata)
  /^0\./, // current network
  /^::1$/, // IPv6 loopback
  /^fc00:/i, // IPv6 unique local
  /^fe80:/i, // IPv6 link-local
]

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
  if (isIP(hostname)) {
    for (const pattern of BLOCKED_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return { valid: false, reason: `internal IP ${hostname} blocked` }
      }
    }
  }
  return { valid: true }
}

interface CustomRegistryResponse {
  items: RawRegistryItem[]
}

export const customRegistryAdapter: RegistryAdapter = {
  name: 'custom',
  source: 'custom',
  async fetch(sourceType: RegistrySourceType, options?: SyncOptions): Promise<RawRegistryItem[]> {
    const timeoutMs = options?.timeoutMs ?? 15000
    const url =
      options?.customRegistryUrl ??
      process.env.IHUI_CUSTOM_REGISTRY_URL ??
      DEFAULT_REGISTRY_URL

    // SSRF 防护:校验 URL 协议 + 内网地址
    const validation = validateRegistryUrl(url)
    if (!validation.valid) {
      throw new RegistryAdapterError(
        `custom registry URL blocked: ${validation.reason}`,
        'custom',
      )
    }

    try {
      const res = await fetchWithTimeout(
        `${url}?source_type=${encodeURIComponent(sourceType)}`,
        {},
        timeoutMs,
      )
      if (!res.ok) {
        throw new RegistryAdapterError(
          `Custom registry returned ${res.status} for ${url}`,
          'custom',
        )
      }
      const data = (await res.json()) as CustomRegistryResponse
      return data.items ?? []
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
