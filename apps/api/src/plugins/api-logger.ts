// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { addApiLogsBatch } from '../db/system-queries.js'
import { config } from '../config/index.js'
import { logger } from '../utils/logger.js'
// O5 归因(2026-09-21):复用 audit-logger 的同一套归因口径,不在此另写一份字段提取。
import {
  OPEN_SURFACE_PREFIXES,
  buildRequestAttribution,
  isOpenSurfacePath,
} from './audit-logger.js'

/**
 * API 日志中间件：记录请求到 api_logs 表。
 *
 * 覆盖范围(O5 修正 2026-09-21):此前只匹配 `/api/` 前缀,对外开放面
 * (/v1/、/v1beta/)整段落在表外 —— 中转站的流量/耗时/错误在 api_logs 里完全不可见。
 * 现同时覆盖 `/api/` + `/v1/` + `/v1beta/`。
 *
 * 采样策略：
 * - 2xx 响应：按采样率记录（默认 100%，可用 API_LOG_SAMPLE_RATE 调低）
 * - 4xx/5xx 响应：全量记录（排查问题）
 * - 健康检查/指标端点：不记录
 * - 配置 API_LOG_ENABLED=false 可完全关闭
 *
 * 关于 apiKeyId:api_logs 表没有 api_key_id 列(建列需改 packages/database/src/schema/system.ts
 * 与 db/system-queries.ts 的插入函数,不在本子任务允许改动的文件范围)。
 * 因此**持久化归因以 audit_logs_chain / audit_logs 的 JSONB 为准**(见 plugins/audit-logger.ts);
 * 本表做的是流量/耗时/错误口径,已按"key 归属人"补齐 userId 维度,使网关流量不再是一排 null。
 * 开放面的 4xx/5xx(401/403/429 这类安全事件)额外打一条结构化 stdout 日志,
 * 让 ELK/pino 侧能直接按 apiKeyId 检索。注意:该行走模块级 logger,不经过
 * log-sanitizer 插件的 request.log Proxy 链 —— 其字段集本身即归因安全:只有
 * id / 脱敏路径 / 状态码 / 耗时 / ip,不含凭据原文与任何请求正文(见
 * audit-logger.ts 的 buildRequestAttribution)。
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

/** 记录范围前缀:站内会话 API + 对外开放面网关(与 nginx 被限流的前缀一一对应)。 */
const LOGGED_PREFIXES: readonly string[] = ['/api/', ...OPEN_SURFACE_PREFIXES]

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
    if (!LOGGED_PREFIXES.some((p) => url.startsWith(p))) return

    // 跳过健康检查和指标端点
    if (skipPaths.some((p) => url === p || url.startsWith(p + '/'))) return

    const method = request.method.toUpperCase()
    const statusCode = reply.statusCode

    // 采样：2xx 按采样率，4xx/5xx 全量
    if (statusCode < 400) {
      if (Math.random() > config.API_LOG_SAMPLE_RATE) return
    }

    const attribution = buildRequestAttribution(request, reply, reply.elapsedTime)
    // 会话用户优先;开放面没有 JWT,则归因到 key 的归属人 —— 否则网关流量的 userId 全为 null
    const userId = attribution.userId ?? attribution.apiKeyOwnerId ?? undefined
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

    // 开放面的失败请求(401/403/429 等安全事件)带完整归因打一条 stdout 日志。
    // 只在开放面 + >=400 时输出,正常流量零额外日志量;字段本身不含任何正文。
    if (statusCode >= 400 && isOpenSurfacePath(url)) {
      logger.warn('[api-logger] open-surface request failed', {
        apiKeyId: attribution.apiKeyId,
        apiKeyOwnerId: attribution.apiKeyOwnerId,
        userId: attribution.userId,
        capabilityScope: attribution.capabilityScope,
        capabilityDataClass: attribution.capabilityDataClass,
        method: attribution.method,
        url: attribution.url,
        routePattern: attribution.routePattern,
        statusCode,
        durationMs: attribution.durationMs,
        ip: request.ip,
      })
    }

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
