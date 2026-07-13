/**
 * HTTP 请求输入归一化公共工具。
 *
 * 统一处理 header 数组形式、trim、字符集校验、URL querystring 剥离等，
 * 消除各插件重复实现的边界缺陷（R12 同类问题）。
 */

/**
 * 归一化 header 值：处理数组形式、trim、空串。
 * @returns 归一化后的字符串；若为空返回 undefined
 */
export function normalizeHeader(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/**
 * 归一化 header 值并校验字符集（白名单：字母数字 + _ - . :）。
 * 用于 X-Tenant-Id、X-Request-Id 等内部标识 header。
 */
export function normalizeHeaderStrict(
  value: string | string[] | undefined,
  maxLen = 128,
): string | undefined {
  const s = normalizeHeader(value)
  if (!s) return undefined
  if (s.length > maxLen) return undefined
  // 白名单字符集：字母数字 + _ - . :（UUID 与 slug 子集）
  if (!/^[A-Za-z0-9_.:-]+$/.test(s)) return undefined
  return s
}

/**
 * 从 URL 中剥离 querystring，返回纯 path。
 * `/api/users?id=1` → `/api/users`
 */
export function parsePath(url: string): string {
  return url.split('?')[0] ?? ''
}

/**
 * 精确前缀匹配：path 等于 prefix，或 path 以 prefix + '/' 开头。
 * 用于白名单匹配，避免 `startsWith(prefix)` 导致 `/api/authlogin` 命中 `/api/auth`。
 *
 * 特殊处理：prefix 以 '/' 结尾时（如 `/api/auth/`），直接用 startsWith。
 */
export function matchesPrefix(path: string, prefix: string): boolean {
  if (path === prefix) return true
  if (prefix.endsWith('/')) return path.startsWith(prefix)
  return path.startsWith(prefix + '/')
}

/**
 * 判断 path 是否命中任一前缀白名单。
 */
export function matchesAnyPrefix(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => matchesPrefix(path, p))
}
