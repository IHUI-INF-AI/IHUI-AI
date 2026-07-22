/**
 * Hooks 路由 — Fastify 转发层(2026-07-22 立)。
 *
 * 端点清单(全部 JWT 鉴权):
 *  1. GET    /hooks                       — 列出全部 Hook(可选 ?event=)
 *  2. POST   /hooks                       — 创建 Hook
 *  3. GET    /hooks/:id                   — 获取详情
 *  4. PATCH  /hooks/:id                   — 更新
 *  5. DELETE /hooks/:id                   — 删除
 *  6. POST   /hooks/:id/toggle            — 启用/禁用
 *  7. POST   /hooks/:id/test              — 测试(模拟触发)
 *  8. GET    /hooks/:id/logs              — 查询日志
 *  9. GET    /hooks/logs                  — 查询全部日志
 *
 * 路径前缀:在 server.ts 用 prefix:'/api' 注册 → /api/hooks/*
 * 全部转发到 ai-service /api/hooks/*,自身不存状态。
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import {
  createHook,
  deleteHook,
  getHook,
  listAllHookLogs,
  listHookLogs,
  listHooks,
  testHook,
  toggleHook,
  updateHook,
} from '../services/hooks-service.js'

const HOOK_EVENTS_ENUM = z.enum([
  'tool.before',
  'tool.after',
  'message.send',
  'message.receive',
  'session.start',
  'session.end',
  'error',
])

const HOOK_ACTION_TYPES_ENUM = z.enum(['webhook', 'script', 'log', 'notify'])

const actionConfigSchema = z.object({
  url: z.string().max(2048).optional(),
  method: z.enum(['GET', 'POST', 'PUT']).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.string().max(8192).optional(),
  command: z.string().max(2048).optional(),
  channel: z.enum(['toast', 'notification', 'email']).optional(),
  message: z.string().max(2048).optional(),
})

const actionSchema = z.object({
  type: HOOK_ACTION_TYPES_ENUM,
  config: actionConfigSchema.default({}),
})

const createHookSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  event: HOOK_EVENTS_ENUM,
  condition: z.string().max(8192).nullable().optional(),
  action: actionSchema,
  enabled: z.boolean().optional(),
})

const updateHookSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  event: HOOK_EVENTS_ENUM.optional(),
  condition: z.string().max(8192).nullable().optional(),
  action: actionSchema.optional(),
  enabled: z.boolean().optional(),
})

const toggleHookSchema = z.object({
  enabled: z.boolean(),
})

const testHookSchema = z.object({
  event: HOOK_EVENTS_ENUM,
  context: z.record(z.string(), z.unknown()).default({}),
})

const idParamSchema = z.object({ id: z.string().min(1) })

export const hooksRoutes: FastifyPluginAsync = async (server) => {
  // JWT 鉴权 hook(复用 v1-apply-diff.ts 模式)
  const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || 'Authentication required'
      return reply.status(statusCode).send(error(statusCode, message))
    }
  }

  // 1. GET /hooks — 列表
  server.get('/hooks', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const event = (request.query as { event?: string }).event
    const data = await listHooks(request, event)
    return reply.send(success(data))
  })

  // 2. POST /hooks — 创建
  server.post('/hooks', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const parsed = createHookSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const hook = await createHook(request, parsed.data)
    if (hook === null) {
      return reply.status(503).send(error(503, 'Hook 引擎不可用(ai-service 无响应)'))
    }
    return reply.send(success(hook))
  })

  // 9. GET /hooks/logs — 全部日志(必须在 /:id 之前注册,否则被 /:id 截获)
  server.get('/hooks/logs', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const limit = Math.min(
      1000,
      Math.max(1, Number((request.query as { limit?: string }).limit) || 100),
    )
    const data = await listAllHookLogs(request, limit)
    return reply.send(success(data))
  })

  // 3. GET /hooks/:id — 详情
  server.get('/hooks/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const params = idParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send(error(400, '无效的 Hook ID'))
    }
    const hook = await getHook(request, params.data.id)
    if (hook === null) {
      return reply.status(404).send(error(404, 'Hook 不存在或服务不可用'))
    }
    return reply.send(success(hook))
  })

  // 4. PATCH /hooks/:id — 更新
  server.patch('/hooks/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const params = idParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send(error(400, '无效的 Hook ID'))
    }
    const parsed = updateHookSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const hook = await updateHook(request, params.data.id, parsed.data)
    if (hook === null) {
      return reply.status(404).send(error(404, 'Hook 不存在或服务不可用'))
    }
    return reply.send(success(hook))
  })

  // 5. DELETE /hooks/:id — 删除
  server.delete('/hooks/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const params = idParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send(error(400, '无效的 Hook ID'))
    }
    const ok = await deleteHook(request, params.data.id)
    if (!ok) {
      return reply.status(404).send(error(404, 'Hook 不存在或服务不可用'))
    }
    return reply.send(success({ deleted: true, id: params.data.id }))
  })

  // 6. POST /hooks/:id/toggle — 启用/禁用
  server.post('/hooks/:id/toggle', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const params = idParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send(error(400, '无效的 Hook ID'))
    }
    const parsed = toggleHookSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const hook = await toggleHook(request, params.data.id, parsed.data.enabled)
    if (hook === null) {
      return reply.status(404).send(error(404, 'Hook 不存在或服务不可用'))
    }
    return reply.send(success(hook))
  })

  // 7. POST /hooks/:id/test — 测试
  server.post('/hooks/:id/test', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const params = idParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send(error(400, '无效的 Hook ID'))
    }
    const parsed = testHookSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await testHook(request, params.data.id, parsed.data)
    return reply.send(success(result))
  })

  // 8. GET /hooks/:id/logs — 日志
  server.get('/hooks/:id/logs', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const params = idParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send(error(400, '无效的 Hook ID'))
    }
    const limit = Math.min(
      1000,
      Math.max(1, Number((request.query as { limit?: string }).limit) || 100),
    )
    const data = await listHookLogs(request, params.data.id, limit)
    return reply.send(success(data))
  })
}

export default hooksRoutes
