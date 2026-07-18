import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../utils/response.js'

/**
 * P3-2 Telemetry 极简上报端点。
 *
 * 接收 CLI 客户端批量上报的 telemetry 事件,写入日志(后续可扩展到数据库/数据仓库)。
 *
 * 灵感来源:参考行业 Agent 框架的 telemetry ingest 端点(PostHog/Mixpanel 模式)。
 * 简化策略(做减法):
 *   - 单端点 POST /v1/telemetry/ingest 接收 { events: TelemetryEvent[] }
 *   - 不引入 OpenTelemetry SDK,不依赖消息队列
 *   - 仅做基础校验 + 日志记录(后续可扩展到 DB 表 telemetry_events)
 *   - 失败静默(返回 success,避免客户端重试堆积)
 *
 * 安全:
 *   - 单批最多 100 条事件(防止超大 payload)
 *   - 单事件 props 最大 4KB(防止内存爆炸)
 *   - 不记录敏感字段(apiKey/token 等已在客户端层脱敏)
 */

const telemetryEventSchema = z.object({
  name: z.string().min(1).max(64),
  props: z.record(z.unknown()).optional(),
  timestamp: z.number().int().positive(),
})

const ingestBodySchema = z.object({
  events: z.array(telemetryEventSchema).min(1).max(100),
})

export const telemetryRoutes: FastifyPluginAsync = async (server) => {
  // POST /v1/telemetry/ingest
  // 接收事件批量,记录到日志(后续可扩展到数据库)
  server.post('/v1/telemetry/ingest', async (request, reply) => {
    const parsed = ingestBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const events = parsed.data.events
      // 简化:仅记录到日志(后续可扩展到 DB 表 telemetry_events)
      // 用 server.log.info 而非 console.info,以便被 pino ELK 管线收集
      server.log.info(
        {
          module: 'telemetry',
          eventCount: events.length,
          events: events.map((e) => ({
            name: e.name,
            timestamp: e.timestamp,
            // props 序列化为字符串,长度限制 4KB(防止日志膨胀)
            props: e.props ? JSON.stringify(e.props).slice(0, 4096) : undefined,
          })),
        },
        'telemetry ingest received',
      )
      return reply.send(success({ accepted: events.length }))
    } catch (err) {
      server.log.warn({ err, module: 'telemetry' }, 'telemetry ingest failed')
      // 失败仍返回 success(避免客户端重试堆积)
      return reply.send(success({ accepted: 0, error: 'ingest failed' }))
    }
  })

  // GET /v1/telemetry/health
  // 健康检查端点(供客户端验证 endpoint 可达)
  server.get('/v1/telemetry/health', async (_request, reply) => {
    return reply.send(success({ status: 'ok', module: 'telemetry' }))
  })
}
