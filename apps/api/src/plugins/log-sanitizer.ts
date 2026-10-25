// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type {
  FastifyBaseLogger,
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
} from 'fastify'
import fp from 'fastify-plugin'
import { redactUrl, SECRET_RULES } from '@ihui/shared/utils/redact'
import { buildSensitiveKeySet, sanitizeData, type SanitizerOptions } from './response-sanitizer.js'

const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const
type LogLevel = (typeof LOG_LEVELS)[number]

/**
 * 日志脱敏插件：包装 pino logger，自动脱敏日志中的敏感字段。
 * 与 response-sanitizer 共用字段名规则；**自由文本里的凭据**走共享层唯一脱敏出口
 * `@ihui/shared/utils/redact`（G-21③：按字段名打码看不见嵌在 message/stack/URL 里的凭据）。
 *
 * 实现方式：onRequest 阶段用 Proxy 包装 request.log，对各级别方法的入参
 * （mergeObject / message）做递归脱敏后再委托给原 logger 输出。
 */
function redactCredentialText(text: string): string {
  let out = redactUrl(text)
  for (const rule of SECRET_RULES) out = out.replace(rule.pattern, rule.replacement)
  return out
}

/** 字段名规则之后再扫一遍字符串叶子；对象/数组形状保持不变 */
function redactCredentialStrings(value: unknown): unknown {
  if (typeof value === 'string') return redactCredentialText(value)
  if (Array.isArray(value)) return value.map(redactCredentialStrings)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactCredentialStrings(v)
    }
    return out
  }
  return value
}

function wrapLogger(log: FastifyBaseLogger, keys: Set<string>): FastifyBaseLogger {
  return new Proxy(log, {
    get(target, prop, _receiver) {
      if (typeof prop === 'string' && (LOG_LEVELS as readonly string[]).includes(prop)) {
        const level = prop as LogLevel
        // 转为可变参函数，规避 pino/Fastify logger 复杂重载签名
        const original = (target[level] as (...args: unknown[]) => void).bind(target)
        return (...args: unknown[]) => {
          const masked = args.map((a) => redactCredentialStrings(sanitizeData(a, keys)))
          return original(...masked)
        }
      }
      if (prop === 'child') {
        const childFn = target.child.bind(target) as (
          ...args: Parameters<FastifyBaseLogger['child']>
        ) => FastifyBaseLogger
        return (...args: Parameters<FastifyBaseLogger['child']>) =>
          wrapLogger(childFn(...args), keys)
      }
      const val = Reflect.get(target, prop)
      return typeof val === 'function' ? val.bind(target) : val
    },
  }) as FastifyBaseLogger
}

const logSanitizerPlugin: FastifyPluginAsync<SanitizerOptions> = async (
  server: FastifyInstance,
  opts: SanitizerOptions,
) => {
  const keys = buildSensitiveKeySet(opts.extraKeys)

  server.addHook('onRequest', async (request: FastifyRequest) => {
    request.log = wrapLogger(request.log, keys)
  })
}

export default fp(logSanitizerPlugin, {
  name: 'log-sanitizer-plugin',
  fastify: '5.x',
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
