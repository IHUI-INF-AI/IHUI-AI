/**
 * Clawdbot 共享日志器
 */
import { pino, type Logger } from 'pino'

const logger: Logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
})

export { logger }
