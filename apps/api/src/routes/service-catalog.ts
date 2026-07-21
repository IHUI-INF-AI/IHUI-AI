import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import { generateCompactId } from '../utils/crypto-random.js'

/**
 * 服务注册发现 — 轻量级内存实现(无 schema 依赖)
 * 用于内部微服务/外部 API 厂商的注册与发现。
 * 适用场景:ai-service 实例、CDN 节点、第三方 API 网关等。
 */

interface ServiceInstance {
  id: string
  name: string
  type: 'ai-service' | 'cdn' | 'api-gateway' | 'third-party' | 'internal'
  endpoint: string
  status: 'healthy' | 'degraded' | 'down'
  metadata: Record<string, string>
  lastHeartbeat: number
  registeredAt: number
}

const registry = new Map<string, ServiceInstance>()

const serviceSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['ai-service', 'cdn', 'api-gateway', 'third-party', 'internal']).default('internal'),
  endpoint: z.string().min(1).max(500),
  metadata: z.record(z.string(), z.string()).default({}),
})

const serviceCatalogRoutes: FastifyPluginAsync = async (server) => {
  // 列表(支持 type/name 筛选)
  server.get('/', async (request, reply) => {
    const parsed = z
      .object({
        type: z.string().optional(),
        name: z.string().optional(),
        status: z.string().optional(),
      })
      .safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { type, name, status } = parsed.data
    let list = [...registry.values()]
    if (type) list = list.filter((s) => s.type === type)
    if (name) list = list.filter((s) => s.name.includes(name))
    if (status) list = list.filter((s) => s.status === status)
    list.sort((a, b) => b.registeredAt - a.registeredAt)
    return reply.send(success({ list, total: list.length }))
  })

  // 发现(按 name 返回健康实例,负载均衡随机)
  server.get('/discover/:name', async (request, reply) => {
    const { name } = z.object({ name: z.string() }).parse(request.params)
    const healthy = [...registry.values()].filter((s) => s.name === name && s.status === 'healthy')
    if (healthy.length === 0) {
      return reply.status(404).send(error(404, `无健康实例: ${name}`))
    }
    const instance = healthy[Math.floor(Math.random() * healthy.length)]
    return reply.send(success(instance))
  })

  // 详情
  server.get('/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params)
    const svc = registry.get(id)
    if (!svc) return reply.status(404).send(error(404, '服务不存在'))
    return reply.send(success(svc))
  })

  // 注册(管理员)
  server.post('/', async (request, reply) => {
    const body = serviceSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    // 2026-07-21 安全审计加固:用 CSPRNG 替换 Math.random 生成服务实例 ID
    // 风险:可预测服务 ID → 攻击者枚举内部微服务/CDN 节点 → 越权访问
    const id = generateCompactId('svc')
    const now = Date.now()
    const instance: ServiceInstance = {
      id,
      name: body.data.name,
      type: body.data.type,
      endpoint: body.data.endpoint,
      status: 'healthy',
      metadata: body.data.metadata,
      lastHeartbeat: now,
      registeredAt: now,
    }
    registry.set(id, instance)
    return reply.status(201).send(success(instance))
  })

  // 更新(管理员)
  server.put('/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params)
    const existing = registry.get(id)
    if (!existing) return reply.status(404).send(error(404, '服务不存在'))
    const body = serviceSchema.partial().safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const updated: ServiceInstance = {
      ...existing,
      ...(body.data.name && { name: body.data.name }),
      ...(body.data.type && { type: body.data.type }),
      ...(body.data.endpoint && { endpoint: body.data.endpoint }),
      ...(body.data.metadata && { metadata: { ...existing.metadata, ...body.data.metadata } }),
    }
    registry.set(id, updated)
    return reply.send(success(updated))
  })

  // 心跳(服务自报状态)
  server.post('/:id/heartbeat', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params)
    const body = z
      .object({ status: z.enum(['healthy', 'degraded', 'down']).default('healthy') })
      .safeParse(request.body ?? {})
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = registry.get(id)
    if (!existing) return reply.status(404).send(error(404, '服务不存在'))
    existing.status = body.data.status
    existing.lastHeartbeat = Date.now()
    registry.set(id, existing)
    return reply.send(
      success({ id, status: existing.status, lastHeartbeat: existing.lastHeartbeat }),
    )
  })

  // 注销(管理员)
  server.delete('/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params)
    if (!registry.has(id)) return reply.status(404).send(error(404, '服务不存在'))
    registry.delete(id)
    return reply.send(success({ id, deleted: true }))
  })
}

// 管理员路由(写操作需 admin)
const adminServiceCatalogRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)
  server.register(serviceCatalogRoutes)
}

export { serviceCatalogRoutes, adminServiceCatalogRoutes }
