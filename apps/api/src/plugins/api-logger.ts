import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { addApiLogsBatch } from '../db/system-queries.js'
import { config } from '../config/index.js'
import { logger } from '../utils/logger.js'

/**
 * API 日志中间件：记录 /api 请求到 api_logs 表。
 * 采样策略：
 * - 2xx 响应：按采样率记录（默认 10%）
 * - 4xx/5xx 响应：全量记录（排查问题）
 * - 健康检查/指标端点：不记录
 * - 配置 API_LOG_ENABLED=false 可完全关闭
 *
 * 批量写入策略(#18 修复):
 * - 内存缓冲,满 API_LOG_BATCH_SIZE(默认 100)或每 API_LOG_FLUSH_INTERVAL_MS(默认 5000ms)批量 flush
 * - 进程退出时 onClose 钩子强制 flush 剩余日志
 * - 高 QPS 下减少 DB 往返次数,4xx/5xx 全量记录也不再逐条写库
 */
interface BufferedLog {
  userId?: string
  method: string
  path: string
  statusCode: number
  duration: number
  ip?: string
  userAgent?: string
  error?: string
}

const apiLoggerPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  if (!config.API_LOG_ENABLED) return

  const skipPaths = ['/api/health', '/api/metrics', '/health', '/metrics']
  const batchSize = config.API_LOG_BATCH_SIZE ?? 100
  const flushIntervalMs = config.API_LOG_FLUSH_INTERVAL_MS ?? 5000

  // 内存缓冲区
  let buffer: BufferedLog[] = []
  let flushing = false

  /** 批量 flush 缓冲区到 DB。 */
  async function flush(): Promise<void> {
    if (flushing || buffer.length === 0) return
    flushing = true
    const batch = buffer
    buffer = []
    try {
      await addApiLogsBatch(batch)
    } catch (e) {
      logger.warn('[api-logger] flush failed', { error: e })
      // flush 失败丢弃当前批次,避免无限累积(日志写入失败不影响业务)
    } finally {
      flushing = false
    }
  }

  // 定时 flush
  const timer = setInterval(() => {
    flush().catch(() => {})
  }, flushIntervalMs)
  timer.unref?.()

  // 进程退出时强制 flush
  server.addHook('onClose', async () => {
    clearInterval(timer)
    await flush()
  })

  server.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const url = request.url.split('?')[0] ?? ''
    if (!url.startsWith('/api/')) return

    // 跳过健康检查和指标端点
    if (skipPaths.some((p) => url === p || url.startsWith(p + '/'))) return

    const method = request.method.toUpperCase()
    const statusCode = reply.statusCode

    // 采样：2xx 按采样率，4xx/5xx 全量
    if (statusCode < 400) {
      if (Math.random() > config.API_LOG_SAMPLE_RATE) return
    }

    const userId = request.userId ?? request.jwtPayload?.userId
    const userAgent = request.headers['user-agent']
    const error = statusCode >= 400 ? `${method} ${url} -> ${statusCode}` : undefined

    buffer.push({
      userId,
      method,
      path: url.slice(0, 512),
      statusCode,
      duration: Math.round(reply.elapsedTime),
      ip: request.ip,
      userAgent: userAgent ? userAgent.slice(0, 512) : undefined,
      error,
    })

    // 缓冲满立即 flush(异步,不阻塞响应)
    if (buffer.length >= batchSize) {
      setImmediate(() => flush().catch(() => {}))
    }
  })
}

export default fp(apiLoggerPlugin, {
  name: 'api-logger-plugin',
  fastify: '5.x',
})
