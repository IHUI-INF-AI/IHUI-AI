/**
 * Rules 转发路由 — Fastify 层,转发到 ai-service。
 *
 * 端点(全部 JWT 鉴权 + Zod 校验):
 *  - GET    /api/rules          列出全部规则
 *  - POST   /api/rules          创建规则
 *  - GET    /api/rules/:id      获取单个规则
 *  - PATCH  /api/rules/:id      更新规则
 *  - DELETE /api/rules/:id      删除规则
 *  - POST   /api/rules/:id/test 测试规则
 *  - POST   /api/rules/match    匹配规则(供 agent loop 调用)
 *
 * 在 server.ts 注册:server.register(rulesRoutes, { prefix: '/api' })
 *
 * 响应格式:{ code: 0, message: 'success', data: ... }
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { rulesService } from '../services/rules-service.js'

export const rulesRoutes: FastifyPluginAsync = async (server) => {
  // 鉴权 helper(同 v1-apply-diff.ts 模式)
  const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || 'Authentication required'
      return reply.status(statusCode).send(error(statusCode, message))
    }
  }

  const ruleCreateSchema = z.object({
    name: z.string().min(1).max(128),
    description: z.string().optional(),
    content: z.string().min(1),
    scope: z.enum(['global', 'workspace', 'agent']).default('global'),
    agentId: z.string().optional(),
    priority: z.number().int().min(0).max(100).default(50),
    enabled: z.boolean().default(true),
    matchType: z.enum(['always', 'keyword', 'regex', 'semantic']).default('always'),
    matchPattern: z.string().optional(),
  })

  const ruleUpdateSchema = z.object({
    name: z.string().min(1).max(128).optional(),
    description: z.string().optional(),
    content: z.string().min(1).optional(),
    scope: z.enum(['global', 'workspace', 'agent']).optional(),
    agentId: z.string().optional(),
    priority: z.number().int().min(0).max(100).optional(),
    enabled: z.boolean().optional(),
    matchType: z.enum(['always', 'keyword', 'regex', 'semantic']).optional(),
    matchPattern: z.string().optional(),
  })

  const ruleTestSchema = z.object({
    message: z.string().min(1),
  })

  const ruleMatchSchema = z.object({
    message: z.string().min(1),
    scope: z.string().optional(),
  })

  // GET /rules — 列出全部规则
  server.get('/rules', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const data = await rulesService.listRules()
    return reply.send(success(data))
  })

  // POST /rules — 创建规则
  server.post('/rules', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const parsed = ruleCreateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const rule = await rulesService.createRule(parsed.data)
      return reply.status(201).send(success(rule))
    } catch (e) {
      return reply.status(502).send(error(502, (e as Error).message))
    }
  })

  // GET /rules/:id — 获取单个规则
  server.get<{ Params: { id: string } }>(
    '/rules/:id',
    async (request, reply) => {
      await requireAuth(request, reply)
      if (!request.userId) return
      const rule = await rulesService.getRule(request.params.id)
      if (!rule) {
        return reply.status(404).send(error(404, '规则不存在'))
      }
      return reply.send(success(rule))
    },
  )

  // PATCH /rules/:id — 更新规则
  server.patch<{ Params: { id: string } }>(
    '/rules/:id',
    async (request, reply) => {
      await requireAuth(request, reply)
      if (!request.userId) return
      const parsed = ruleUpdateSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      try {
        const rule = await rulesService.updateRule(
          request.params.id,
          parsed.data,
        )
        if (!rule) {
          return reply.status(404).send(error(404, '规则不存在'))
        }
        return reply.send(success(rule))
      } catch (e) {
        return reply.status(502).send(error(502, (e as Error).message))
      }
    },
  )

  // DELETE /rules/:id — 删除规则
  server.delete<{ Params: { id: string } }>(
    '/rules/:id',
    async (request, reply) => {
      await requireAuth(request, reply)
      if (!request.userId) return
      const deleted = await rulesService.deleteRule(request.params.id)
      if (!deleted) {
        return reply.status(404).send(error(404, '规则不存在'))
      }
      return reply.send(success({ id: request.params.id, deleted: true }))
    },
  )

  // POST /rules/:id/test — 测试规则
  server.post<{ Params: { id: string } }>(
    '/rules/:id/test',
    async (request, reply) => {
      await requireAuth(request, reply)
      if (!request.userId) return
      const parsed = ruleTestSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      try {
        const result = await rulesService.testRule(
          request.params.id,
          parsed.data.message,
        )
        return reply.send(success(result))
      } catch (e) {
        return reply.status(502).send(error(502, (e as Error).message))
      }
    },
  )

  // POST /rules/match — 匹配规则(供 agent loop 调用)
  server.post('/rules/match', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const parsed = ruleMatchSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await rulesService.matchRules(
      parsed.data.message,
      parsed.data.scope,
    )
    return reply.send(success(result))
  })
}

export default rulesRoutes
