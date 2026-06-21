/**
 * URL工具函数
 * 提供URL解析、构建、参数处理等功能
 */

export interface UrlParams {
  [key: string]: string | number | boolean | undefined
}

export interface ParsedUrl {
  protocol: string
  host: string
  hostname: string
  port: string
  pathname: string
  search: string
  hash: string
  params: Record<string, string>
}

export function parseUrl(url: string): ParsedUrl | null {
  if (!url || typeof url !== 'string') return null

  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')

    const params: Record<string, string> = {}
    parsed.searchParams.forEach((value, key) => {
      params[key] = value
    })

    return {
      protocol: parsed.protocol.replace(':', ''),
      host: parsed.host,
      hostname: parsed.hostname,
      port: parsed.port,
      pathname: parsed.pathname,
      search: parsed.search,
      hash: parsed.hash,
      params,
    }
  } catch {
    return null
  }
}

export function buildUrl(base: string, params?: UrlParams): string {
  if (!base) return ''

  if (!params || Object.keys(params).length === 0) return base

  const url = new URL(base, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  })

  return url.toString()
}

export function getQueryParams(url?: string): Record<string, string> {
  const searchParams = url ? new URL(url, window.location.origin).searchParams : new URLSearchParams(window.location.search)

  const params: Record<string, string> = {}
  searchParams.forEach((value, key) => {
    params[key] = value
  })

  return params
}

export function getQueryParam(key: string, url?: string): string | null {
  const params = getQueryParams(url)
  return params[key] ?? null
}

export function setQueryParam(url: string, key: string, value: string | number | boolean): string {
  if (!url) return ''

  const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
  parsed.searchParams.set(key, String(value))

  return parsed.toString()
}

export function removeQueryParam(url: string, key: string): string {
  if (!url) return ''

  const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
  parsed.searchParams.delete(key)

  return parsed.toString()
}

export function updateQueryParams(url: string, params: UrlParams): string {
  if (!url) return ''

  const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      parsed.searchParams.delete(key)
    } else {
      parsed.searchParams.set(key, String(value))
    }
  })

  return parsed.toString()
}

export function isAbsoluteUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  return /^[a-z][a-z0-9+.-]*:/.test(url)
}

export function isRelativeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  return url.startsWith('/') || url.startsWith('./') || url.startsWith('../')
}

export function joinUrl(...parts: string[]): string {
  return parts
    .map((part, index) => {
      if (index === 0) {
        return part.replace(/\/+$/, '')
      }
      return part.replace(/^\/+/, '').replace(/\/+$/, '')
    })
    .filter(Boolean)
    .join('/')
}

export function normalizeUrl(url: string): string {
  if (!url || typeof url !== 'string') return ''

  let normalized = url

  const protocolMatch = normalized.match(/^(https?:\/\/)/)
  const protocol = protocolMatch ? protocolMatch[1] : ''

  if (protocol) {
    normalized = normalized.slice(protocol.length)
  }

  normalized = normalized.replace(/\/+/g, '/')

  normalized = normalized.replace('/./', '/')

  while (normalized.includes('/../')) {
    normalized = normalized.replace(/\/[^/]+\/\.\.\//, '/')
  }

  return protocol + normalized
}

export function extractDomain(url: string): string | null {
  const parsed = parseUrl(url)
  return parsed?.hostname ?? null
}

export function extractPath(url: string): string | null {
  const parsed = parseUrl(url)
  return parsed?.pathname ?? null
}

export function extractFilename(url: string): string | null {
  const pathname = extractPath(url)
  if (!pathname) return null

  const parts = pathname.split('/')
  return parts[parts.length - 1] || null
}

export function extractExtension(url: string): string | null {
  const filename = extractFilename(url)
  if (!filename) return null

  const parts = filename.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : null
}

export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false

  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

export function isHttpUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  return /^https?:\/\//i.test(url)
}

export function isDataUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  return /^data:/i.test(url)
}

export function isBlobUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  return /^blob:/i.test(url)
}

export function encodeParams(params: Record<string, unknown>): string {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
}

export function decodeParams(queryString: string): Record<string, string> {
  const params: Record<string, string> = {}

  if (!queryString) return params

  const searchParams = new URLSearchParams(queryString.startsWith('?') ? queryString.slice(1) : queryString)
  searchParams.forEach((value, key) => {
    params[key] = value
  })

  return params
}

export function useUrl() {
  return {
    parseUrl,
    buildUrl,
    getQueryParams,
    getQueryParam,
    setQueryParam,
    removeQueryParam,
    updateQueryParams,
    isAbsoluteUrl,
    isRelativeUrl,
    joinUrl,
    normalizeUrl,
    extractDomain,
    extractPath,
    extractFilename,
    extractExtension,
    isValidUrl,
    isHttpUrl,
    isDataUrl,
    isBlobUrl,
    encodeParams,
    decodeParams,
  }
}

export default {
  parseUrl,
  buildUrl,
  getQueryParams,
  getQueryParam,
  setQueryParam,
  removeQueryParam,
  updateQueryParams,
  isAbsoluteUrl,
  isRelativeUrl,
  joinUrl,
  normalizeUrl,
  extractDomain,
  extractPath,
  extractFilename,
  extractExtension,
  isValidUrl,
  isHttpUrl,
  isDataUrl,
  isBlobUrl,
  encodeParams,
  decodeParams,
}
