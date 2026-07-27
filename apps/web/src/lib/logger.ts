/**
 * 浏览器端轻量 logger。
 *
 * 设计目标：
 * - 生产环境只输出 error/warn(避免 info 噪音 + 减少敏感信息泄露面)
 * - 开发环境输出全部级别,便于排查
 * - SSR 安全(浏览器 API 仅在 typeof window !== 'undefined' 时执行)
 * - 不在生产打印原始 error 对象(可能含 PII),只打 message
 *
 * 为何不消费 @ihui/shared/utils/logger(2026-07-27 审计):
 * - shared logger 是三参数结构化 (module, action, err/message),为 miniapp-taro 跨端兼容设计
 * - web 端 22 处调用走变参 (...args) + 标签前缀,与 shared 签名完全不兼容
 * - web 需要 SSR 安全 + PII 保护(shared logger 无此设计),设计目标根本不同
 * - 两端 logger 各自存在是合理的端差异,非死代码;shared logger 由 miniapp-taro 消费
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
