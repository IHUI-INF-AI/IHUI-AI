// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RUM 隐私层：脱敏 + 白名单 + 粗粒度平台。
 *
 * 设计原则（对应任务里的四条隐私硬要求）：
 * 1. 只允许白名单字段进入上报体；不在名单里的键（workspace/project/userAgent/screen...）一律丢弃。
 * 2. 自由文本（错误摘要）先删本地路径、file:// URL、邮箱，再按空白 token 兜底路径。
 * 3. 接口路径单独走 sanitizeApiPath：去掉 query/hash，动态段归一成 :id，只保留聚合所需的形状。
 * 4. 平台只输出粗粒度大类；读取 UA 仅用于本地判定，绝不上报 UA 原文。
 */

/** 上报体允许出现的全部字段（白名单是唯一真相源）。 */
export const RUM_ALLOWED_PROP_KEYS = [
  'app_start_ms',
  'first_paint_ms',
  'first_token_ms',
  'stream_ms',
  'duration_ms',
  'long_tasks',
  'platform',
  'app_version',
  'api_path',
  'status',
  'count',
  'error_type',
  'message',
] as const

export type RumAllowedPropKey = (typeof RUM_ALLOWED_PROP_KEYS)[number]

export type RumPropValue = string | number | boolean | null
export type RumProps = Record<string, RumPropValue>

export type CoarsePlatform =
  'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'chromeos' | 'other'

/** 错误摘要最大长度：够定位，又不至于把整段业务文本带出去。 */
export const RUM_MAX_TEXT_LENGTH = 200

const COARSE_PLATFORMS = new Set<CoarsePlatform>([
  'windows',
  'macos',
  'linux',
  'android',
  'ios',
  'chromeos',
  'other',
])

const NUMERIC_KEYS = new Set<RumAllowedPropKey>([
  'app_start_ms',
  'first_paint_ms',
  'first_token_ms',
  'stream_ms',
  'duration_ms',
  'long_tasks',
  'status',
  'count',
])

/** 数值上限：一天毫秒数。超出的时间/计数一定是脏数据，丢弃而不是上报。 */
const MAX_NUMERIC_VALUE = 86_400_000

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const FILE_URL_RE = /file:\/\/[^\s"'<>|]+/gi
const WINDOWS_PATH_RE = /(?:\b[A-Za-z]:\\|\\\\)[^\s"'<>|]+/g
const POSIX_HOME_RE = /(?:\/Users\/|\/home\/|\/root\/)[^\s"'<>|]+/g
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NUMERIC_ID_RE = /^\d+$/
const HEX_ID_RE = /^[0-9a-f]{12,}$/i
const ID_LIKE_RE = /^[0-9A-Za-z_-]{8,}$/

export function isCoarsePlatform(value: unknown): value is CoarsePlatform {
  return typeof value === 'string' && COARSE_PLATFORMS.has(value as CoarsePlatform)
}

/**
 * 自由文本脱敏。
 * - 本地文件路径（Windows 盘符 / UNC / POSIX home / file://）
 * - 邮箱
 * - 兜底：任何以 / 开头且含两级以上路径的 token（日志里的绝对路径常无盘符）
 * 宁可多脱一点，也不让原文出网。
 */
export function redactTelemetryText(
  input: unknown,
  maxLength: number = RUM_MAX_TEXT_LENGTH,
): string {
  if (typeof input !== 'string') return ''
  const replaced = input
    .replace(FILE_URL_RE, '<path>')
    .replace(WINDOWS_PATH_RE, '<path>')
    .replace(POSIX_HOME_RE, '<path>')
    .replace(EMAIL_RE, '<email>')
  const compact = replaced
    .replace(/\S+/g, (token) => {
      if (token.includes('\\')) return '<path>'
      const slashCount = token.split('/').length - 1
      if (token.startsWith('/') && slashCount >= 2) return '<path>'
      return token
    })
    .replace(/\s+/g, ' ')
    .trim()
  return compact.slice(0, maxLength)
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/**
 * 接口路径脱敏：只保留可聚合的路由形状。
 * `?query` / `#hash` 一律删除（具体参数不上报），UUID / 纯数字 / 长十六进制 / 含数字的长段归一为 :id。
 */
export function sanitizeApiPath(input: unknown): string {
  if (typeof input !== 'string') return '<unknown>'
  const noHash = input.split('#')[0] ?? ''
  const noQuery = noHash.split('?')[0] ?? ''
  const trimmed = noQuery.trim()
  if (!trimmed.startsWith('/')) return '<unknown>'
  const segments = trimmed
    .split('/')
    .filter((segment) => segment.length > 0)
    .slice(0, 6)
  const normalized = segments.map((segment) => {
    const decoded = safeDecode(segment)
    if (
      UUID_RE.test(decoded) ||
      NUMERIC_ID_RE.test(decoded) ||
      HEX_ID_RE.test(decoded) ||
      (ID_LIKE_RE.test(decoded) && /\d/.test(decoded))
    ) {
      return ':id'
    }
    return decoded.replace(/[^A-Za-z0-9._:-]/g, '_').slice(0, 32)
  })
  return `/${normalized.join('/')}`.slice(0, 120)
}

function mapPlatformHint(raw: string): CoarsePlatform {
  const hint = raw.toLowerCase()
  if (hint.includes('windows')) return 'windows'
  if (hint.includes('mac')) return 'macos'
  if (hint.includes('chrome os') || hint.includes('chromium os')) return 'chromeos'
  if (hint.includes('android')) return 'android'
  if (hint.includes('ios')) return 'ios'
  if (hint.includes('linux')) return 'linux'
  return 'other'
}

/**
 * 粗粒度平台大类。
 * 只在本地读 UA / userAgentData，返回值永远只有 7 个枚举值之一 —— UA 原文不离开函数。
 */
export function getCoarsePlatform(
  nav: Navigator | undefined = typeof navigator !== 'undefined' ? navigator : undefined,
): CoarsePlatform {
  if (!nav) return 'other'
  const data = (nav as Navigator & { userAgentData?: { platform?: unknown } }).userAgentData
  const hinted = typeof data?.platform === 'string' ? data.platform : ''
  if (hinted) {
    const mapped = mapPlatformHint(hinted)
    if (mapped !== 'other') return mapped
  }
  const ua = typeof nav.userAgent === 'string' ? nav.userAgent : ''
  if (/android/i.test(ua)) return 'android'
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  if (/cros/i.test(ua)) return 'chromeos'
  if (/macintosh|mac os x/i.test(ua)) return 'macos'
  if (/windows/i.test(ua)) return 'windows'
  if (/linux/i.test(ua)) return 'linux'
  return 'other'
}

/**
 * 字段白名单 + 逐字段类型校验 + 脱敏。未知键直接丢弃（workspace/UA/屏幕/时区都不会进入这里）。
 */
export function sanitizeRumProps(input: Record<string, unknown> | null | undefined): RumProps {
  if (!input) return {}
  const out: RumProps = {}
  for (const key of RUM_ALLOWED_PROP_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue
    const value = input[key]
    if (NUMERIC_KEYS.has(key)) {
      if (typeof value !== 'number' || !Number.isFinite(value)) continue
      const rounded = Math.round(value)
      if (rounded < 0 || rounded > MAX_NUMERIC_VALUE) continue
      if (key === 'status' && rounded > 999) continue
      out[key] = rounded
      continue
    }
    if (key === 'platform') {
      out[key] = isCoarsePlatform(value) ? value : 'other'
      continue
    }
    if (key === 'error_type') {
      out[key] = value === 'error' || value === 'unhandledrejection' ? value : 'other'
      continue
    }
    if (key === 'api_path') {
      out[key] = sanitizeApiPath(value)
      continue
    }
    if (key === 'app_version') {
      if (typeof value === 'string' && /^[0-9A-Za-z._-]{1,20}$/.test(value)) out[key] = value
      continue
    }
    if (key === 'message') {
      const message = redactTelemetryText(value)
      if (message) out[key] = message
    }
  }
  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
