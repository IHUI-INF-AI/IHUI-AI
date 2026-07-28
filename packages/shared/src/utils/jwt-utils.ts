interface JWTPayload {
  exp?: number
  iat?: number
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/**
 * 原生 atob 引用(模块加载时一次性捕获)。
 * web 端存在原生 atob;mobile-rn Hermes / 旧版环境无。
 */
const nativeAtob: ((s: string) => string) | undefined =
  typeof globalThis !== 'undefined' && typeof globalThis.atob === 'function'
    ? globalThis.atob
    : undefined

/**
 * 原生 TextDecoder 构造器引用。
 * web 端 / RN 0.71+ 存在;旧版 Hermes 无。
 */
const NativeTextDecoder: (typeof TextDecoder) | undefined =
  typeof globalThis !== 'undefined' && 'TextDecoder' in globalThis
    ? (globalThis as { TextDecoder: typeof TextDecoder }).TextDecoder
    : undefined

/** 纯 JS atob polyfill(对称反向解码,兼容 Hermes 等无 atob 环境)。 */
function atobPolyfill(input: string): string {
  const cleanInput = input.replace(/=+$/, '')
  let result = ''
  let i = 0
  while (i < cleanInput.length) {
    const a = BASE64_CHARS.indexOf(cleanInput[i++] || '')
    const b = BASE64_CHARS.indexOf(cleanInput[i++] || '')
    const c = BASE64_CHARS.indexOf(cleanInput[i++] || '')
    const d = BASE64_CHARS.indexOf(cleanInput[i++] || '')
    if (a < 0 || b < 0) break
    result += String.fromCharCode((a << 2) | (b >> 4))
    if (c >= 0) result += String.fromCharCode(((b & 15) << 4) | (c >> 2))
    if (d >= 0) result += String.fromCharCode(((c & 3) << 6) | d)
  }
  return result
}

/** UTF-8 解码:优先用原生 TextDecoder,缺失时回退到纯 JS polyfill。 */
function utf8Decode(bytes: Uint8Array): string {
  if (NativeTextDecoder) return new NativeTextDecoder().decode(bytes)
  let result = ''
  let i = 0
  while (i < bytes.length) {
    const b = bytes[i++] || 0
    if (b < 0x80) {
      result += String.fromCharCode(b)
    } else if (b < 0xe0) {
      const b2 = bytes[i++] || 0
      result += String.fromCharCode(((b & 0x1f) << 6) | (b2 & 0x3f))
    } else if (b < 0xf0) {
      const b2 = bytes[i++] || 0
      const b3 = bytes[i++] || 0
      result += String.fromCharCode(((b & 0x0f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f))
    } else {
      const b2 = bytes[i++] || 0
      const b3 = bytes[i++] || 0
      const b4 = bytes[i++] || 0
      const codepoint =
        ((b & 0x07) << 18) | ((b2 & 0x3f) << 12) | ((b3 & 0x3f) << 6) | (b4 & 0x3f)
      const adjusted = codepoint - 0x10000
      result += String.fromCharCode(0xd800 | (adjusted >> 10), 0xdc00 | (adjusted & 0x3ff))
    }
  }
  return result
}

/**
 * base64url → UTF-8 字符串。
 * 自动检测原生 atob / TextDecoder,缺失时回退到纯 JS polyfill,
 * 兼容 Edge / browser / extension / miniapp / mobile-rn 运行时,不依赖 Node Buffer。
 */
export function base64UrlDecode(input: string): string {
  const s = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = s + '='.repeat((4 - (s.length % 4)) % 4)
  const binary = nativeAtob ? nativeAtob(padded) : atobPolyfill(padded)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return utf8Decode(bytes)
}

/**
 * 从 JWT 中读取 exp 字段(Unix 秒)。
 * 返回 null 表示 token 格式无效或 payload 无法解析。
 */
export function readExp(token: string): number | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const payloadPart = parts[1]
  if (!payloadPart) return null
  try {
    const decoded = JSON.parse(base64UrlDecode(payloadPart)) as JWTPayload
    return typeof decoded.exp === 'number' ? decoded.exp : null
  } catch {
    return null
  }
}
