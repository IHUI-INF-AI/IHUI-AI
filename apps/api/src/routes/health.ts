import type { FastifyPluginAsync } from 'fastify'
import { db } from '../db/index.js'
import { sql } from 'drizzle-orm'
import { config } from '../config/index.js'
import { resetBulkhead } from '../plugins/resilience-extended.js'

interface HealthHistoryEntry {
  timestamp: string
  status: string
  checks: Record<string, { status: string; latency?: number }>
}

const MAX_HISTORY = 100
const healthHistory: HealthHistoryEntry[] = []

export const healthRoutes: FastifyPluginAsync = async (server) => {
  server.get('/health', async () => {
    return {
      status: 'ok',
      service: '@ihui/api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }
  })

  // 就绪检查:检查 DB 连通性
  server.get('/health/ready', async (request, reply) => {
    const checks: Record<string, { status: string; latency?: number }> = {}
    let allOk = true

    // DB 检查
    try {
      const start = Date.now()
      await db.execute(sql`SELECT 1`)
      checks.database = { status: 'ok', latency: Date.now() - start }
    } catch {
      checks.database = { status: 'error' }
      allOk = false
    }

    // Redis 检查：实际 ping 命令验证连通性
    // 若 Redis 插件未注册（如测试环境或单实例无 Redis 部署），返回 skip 不影响 ready 状态
    const redisClient = (server as unknown as { redis?: { ping(): Promise<string> } }).redis
    if (!redisClient) {
      checks.redis = { status: 'skip' }
    } else {
      try {
        const start = Date.now()
        const pong = await redisClient.ping()
        checks.redis = {
          status: pong === 'PONG' ? 'ok' : 'error',
          latency: Date.now() - start,
        }
        if (pong !== 'PONG') allOk = false
      } catch (e) {
        checks.redis = { status: 'error' }
        allOk = false
        request.log.warn({ err: e }, 'redis health check failed')
      }
    }

    // AI service 检查:实际 HTTP 请求验证连通性(让 AI_SERVICE_URL 配置有真实用途)
    // 超时 2s,失败不阻塞 ready(降级为 warning)
    try {
      const start = Date.now()
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 2000)
      const aiResp = await fetch(`${config.AI_SERVICE_URL}/health`, {
        signal: controller.signal,
      })
      clearTimeout(timer)
      checks.aiService = {
        status: aiResp.ok ? 'ok' : 'error',
        latency: Date.now() - start,
      }
      if (!aiResp.ok) {
        // AI service 不可用不阻塞 ready(降级运行,chat 功能受影响但其他正常)
        request.log.warn({ status: aiResp.status }, 'ai service health check non-2xx')
      }
    } catch (e) {
      checks.aiService = { status: 'unreachable' }
      request.log.warn({ err: e }, 'ai service health check failed (degraded)')
    }

    const status = allOk ? 'ready' : 'degraded'
    healthHistory.push({ timestamp: new Date().toISOString(), status, checks })
    if (healthHistory.length > MAX_HISTORY) healthHistory.shift()
    reply.code(allOk ? 200 : 503)
    return { status, checks }
  })

  // 存活检查
  server.get('/health/live', async () => {
    return { status: 'alive', uptime: process.uptime() }
  })

  // 指标摘要(简化版,完整指标在 /metrics)
  server.get('/health/metrics', async () => {
    const m = server.metrics
    if (!m) return { status: 'metrics not available' }
    return {
      requestsTotal: m.requestsTotal,
      avgResponseTime: m.responseTimeCount > 0 ? m.responseTimeSum / m.responseTimeCount : 0,
      uptime: process.uptime(),
    }
  })

  // 健康检查历史（最近 MAX_HISTORY 次 /health/ready 结果）
  server.get('/health/history', async () => {
    return {
      total: healthHistory.length,
      list: healthHistory,
    }
  })

  // OpenAPI tag 列表（按 tag 统计端点数）
  server.get('/openapi/tags', async () => {
    const schema = server.swagger()
    const tagCounts: Record<string, number> = {}
    const paths = schema.paths ?? {}
    for (const path of Object.values(paths)) {
      if (!path) continue
      for (const methodData of Object.values(path)) {
        if (!methodData) continue
        for (const tag of (methodData as { tags?: string[] }).tags ?? []) {
          tagCounts[tag] = (tagCounts[tag] ?? 0) + 1
        }
      }
    }
    return {
      totalTags: Object.keys(tagCounts).length,
      tags: tagCounts,
    }
  })

  // OpenAPI 指定 tag 的端点子文档
  server.get<{ Params: { tagName: string } }>('/openapi/tag/:tagName', async (request, reply) => {
    const { tagName } = request.params
    const schema = server.swagger()
    const filteredPaths: NonNullable<typeof schema.paths> = {}
    const paths = schema.paths ?? {}
    for (const [path, methods] of Object.entries(paths)) {
      if (!methods) continue
      const filteredMethods: Record<string, unknown> = {}
      let matched = false
      for (const [method, methodData] of Object.entries(methods)) {
        if (!methodData) continue
        if ((methodData as { tags?: string[] }).tags?.includes(tagName)) {
          filteredMethods[method] = methodData
          matched = true
        }
      }
      if (matched) filteredPaths[path] = filteredMethods as never
    }
    if (Object.keys(filteredPaths).length === 0) {
      return reply.status(404).send({ code: 404, message: `tag "${tagName}" 不存在` })
    }
    return {
      openapi: (schema as { openapi?: string }).openapi ?? '3.0.0',
      info: schema.info,
      paths: filteredPaths,
    }
  })

  // 重置指定 Bulkhead 隔离器（新架构用 Bulkhead 替代旧架构 CircuitBreaker）
  server.post<{ Params: { circuitName: string } }>(
    '/resilience/reset/:circuitName',
    async (request, reply) => {
      const { circuitName } = request.params
      const ok = resetBulkhead(circuitName)
      if (!ok) {
        return reply.status(404).send({ code: 404, message: `隔离器 "${circuitName}" 不存在` })
      }
      return { code: 0, message: 'ok', data: { circuitName, reset: true } }
    },
  )
}
