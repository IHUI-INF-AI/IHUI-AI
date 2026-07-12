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

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface FastifyLogger {
  debug: (msg: string, meta?: object) => void
  info: (msg: string, meta?: object) => void
  warn: (msg: string, meta?: object) => void
  error: (msg: string, meta?: object) => void
}

interface FastifyLogInstance {
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

function log(level: LogLevel, msg: string, meta?: object): void {
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
