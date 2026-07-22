/**
 * Spec 路由(2026-07-22 新增,对标 Trae IDE Spec 模式)。
 *
 * Fastify 转发层:JWT 鉴权 + Zod 校验 → 调 spec-service → ai-service /api/spec/*。
 *
 * 路径(在 server.ts 用 prefix:'/api' 注册):
 * - POST /spec/generate   → 生成 spec 文档(markdown)
 * - GET  /spec/templates  → 预置模板列表
 *
 * 响应统一 { code: 0, message: 'success', data: ... } 格式。
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { specService } from '../services/spec-service.js'

export const specRoutes: FastifyPluginAsync = async (server) => {
  // 鉴权:复用 packages/auth 的 authenticate(同 v1-apply-diff.ts 模式)
  const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || 'Authentication required'
      return reply.status(statusCode).send(error(statusCode, message))
    }
  }

  const specScopeSchema = z.object({
    type: z.enum(['file', 'dir', 'workspace']).default('workspace'),
    path: z.string().optional(),
  })

  const specGenerateSchema = z.object({
    scope: specScopeSchema.default({ type: 'workspace' }),
    workspacePath: z.string().min(1),
    includeDependencies: z.boolean().optional(),
    languages: z.array(z.string()).optional(),
  })

  // POST /spec/generate — 生成 spec 文档
  server.post('/spec/generate', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = specGenerateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const data = await specService.generate(request, parsed.data)
      return reply.send(success(data))
    } catch (e) {
      return reply
        .status(502)
        .send(error(502, `spec 生成失败: ${(e as Error).message}`))
    }
  })

  // GET /spec/templates — 预置模板列表
  server.get('/spec/templates', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    try {
      const templates = await specService.getTemplates(request)
      return reply.send(success({ templates }))
    } catch (e) {
      return reply
        .status(502)
        .send(error(502, `模板获取失败: ${(e as Error).message}`))
    }
  })
}

export default specRoutes
