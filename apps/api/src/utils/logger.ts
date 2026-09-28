// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 统一日志工具。
 *
 * 优先使用 Fastify 的 pino 实例（通过 setFastify 注入），
 * 未注入时回退到 console（保持向后兼容）。
 *
 * 用法：
 *   import { logger } from '../utils/logger.js'
 *   logger.info('message', { meta: 'data' })
 *   logger.error('message', { error: err })
 */

import { serializeError } from '@ihui/types'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface FastifyLogger {
  debug: (msg: string, meta?: object) => void
  info: (msg: string, meta?: object) => void
  warn: (msg: string, meta?: object) => void
  error: (msg: string, meta?: object) => void
}

export interface FastifyLogInstance {
  log: {
    debug: (m: object, msg: string) => void
    info: (m: object, msg: string) => void
    warn: (m: object, msg: string) => void
    error: (m: object, msg: string) => void
  }
}

let fastifyInstance: FastifyLogInstance | null = null

export function setFastify(fastify: FastifyLogInstance): void {
  fastifyInstance = fastify
}

/**
 * meta 里 Error 值的序列化(唯一出口 serializeError,2026-09-26 立)。
 *
 * pino 把 meta 做 JSON 序列化,而 JSON.stringify(Error) === "{}"(name/message/stack
 * 均为非枚举自有属性)—— 本文件头注释推荐的写法 `{ error: err }` 在日志里就是一具
 * 空尸体。例外:`err` 保留键刻意不动 —— pino 对它自带标准错误序列化,覆盖反而会改变
 * 既有日志消费方看到的字段形状。其余键上的 Error 一律换成闭集结构;挂在 Error 上的
 * 未知字段(请求体/凭据一类)不带出。无任何 Error 时返回原对象(零开销、零行为变化)。
 */
export function serializeErrorFields(meta: object | undefined): object | undefined {
  if (meta === undefined || meta === null) return meta
  if (meta instanceof Error) return { error: serializeError(meta) }
  const source = meta as Record<string, unknown>
  let changed = false
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(source)) {
    const value = source[key]
    if (key !== 'err' && value instanceof Error) {
      out[key] = serializeError(value)
      changed = true
    } else {
      out[key] = value
    }
  }
  return changed ? out : meta
}

function log(level: LogLevel, msg: string, rawMeta?: object): void {
  const meta = serializeErrorFields(rawMeta)
  if (fastifyInstance) {
    // pino 签名：fastify.log.info(meta, msg)
    fastifyInstance.log[level](meta ?? {}, msg)
  } else {
    // 回退到 console（测试环境/未初始化）
    const prefix = `[${level.toUpperCase()}]`
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info
    if (meta) {
      fn(`${prefix} ${msg}`, meta)
    } else {
      fn(`${prefix} ${msg}`)
    }
  }
}

export const logger: FastifyLogger = {
  debug: (msg, meta) => log('debug', msg, meta),
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
}
