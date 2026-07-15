/**
 * 浏览器端轻量 logger。
 *
 * 设计目标：
 * - 生产环境只输出 error/warn(避免 info 噪音 + 减少敏感信息泄露面)
 * - 开发环境输出全部级别,便于排查
 * - SSR 安全(浏览器 API 仅在 typeof window !== 'undefined' 时执行)
 * - 不在生产打印原始 error 对象(可能含 PII),只打 message
 */

const isProd = typeof process !== 'undefined' && process.env.NODE_ENV === 'production'

function fmt(args: unknown[]): unknown[] {
  return args.map((a) => {
    if (a instanceof Error) return a.message
    if (typeof a === 'object' && a !== null) {
      try {
        return JSON.stringify(a)
      } catch {
        return '[unserializable]'
      }
    }
    return a
  })
}

export const logger = {
  debug: (...args: unknown[]) => {
    if (isProd) return
    console.info('[debug]', ...fmt(args))
  },
  info: (...args: unknown[]) => {
    if (isProd) return
    console.info('[info]', ...fmt(args))
  },
  warn: (...args: unknown[]) => {
    console.warn('[warn]', ...fmt(args))
  },
  error: (...args: unknown[]) => {
    console.error('[error]', ...fmt(args))
  },
}
