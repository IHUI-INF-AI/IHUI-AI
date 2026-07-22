/**
 * Spec 路由(2026-07-22 新增,对标 Trae IDE Spec 模式)。
 *
 * Fastify 转发层:JWT 鉴权 + Zod 校验 → 调 spec-service → ai-service /api/spec/*。
 *
 * 路径(在 server.ts 用 prefix:'/api' 注册):
 * - POST /spec/generate   → 生成 spec 文档(markdown)
 * - GET  /spec/templates  → 预置模板列表
 * - GET  /spec/history    → 指定 scope 的历史版本列表(2026-07-22 深化)
 * - GET  /spec/load       → 加载已持久化的 spec(2026-07-22 深化)
 * - POST /spec/diff       → 新 spec 与上次持久化版本对比(2026-07-22 深化)
 * - GET  /spec/variables  → 可用模板变量列表 + 当前值(2026-07-22 深化)
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

  // -------------------------------------------------------------------------
  // 2026-07-22 深化:持久化 + diff + 模板变量
  // -------------------------------------------------------------------------

  const specQuerySchema = z.object({
    workspacePath: z.string().min(1),
    scopeType: z.enum(['file', 'dir', 'workspace']).default('workspace'),
    scopePath: z.string().optional(),
  })

  // GET /spec/history — 指定 scope 的历史版本列表
  server.get('/spec/history', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = specQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const { workspacePath, scopeType, scopePath } = parsed.data
      const data = await specService.getHistory(workspacePath, {
        type: scopeType,
        path: scopePath,
      })
      return reply.send(success(data))
    } catch (e) {
      return reply
        .status(502)
        .send(error(502, `历史版本获取失败: ${(e as Error).message}`))
    }
  })

  // GET /spec/load — 加载已持久化的 spec
  server.get('/spec/load', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const loadSchema = specQuerySchema.extend({
      version: z.string().default('latest'),
    })
    const parsed = loadSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const { workspacePath, scopeType, scopePath, version } = parsed.data
      const data = await specService.loadSpec(
        workspacePath,
        { type: scopeType, path: scopePath },
        version,
      )
      return reply.send(success(data))
    } catch (e) {
      return reply
        .status(502)
        .send(error(502, `spec 加载失败: ${(e as Error).message}`))
    }
  })

  // POST /spec/diff — 新 spec 与上次持久化版本对比
  const specDiffSchema = z.object({
    scope: specScopeSchema.default({ type: 'workspace' }),
    workspacePath: z.string().min(1),
  })

  server.post('/spec/diff', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = specDiffSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const data = await specService.generateDiff(
        request,
        parsed.data.workspacePath,
        parsed.data.scope,
      )
      return reply.send(success(data))
    } catch (e) {
      return reply
        .status(502)
        .send(error(502, `spec diff 生成失败: ${(e as Error).message}`))
    }
  })

  // GET /spec/variables — 可用模板变量列表 + 当前值
  server.get('/spec/variables', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = z
      .object({ workspacePath: z.string().min(1) })
      .safeParse(request.query)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const data = await specService.getVariables(parsed.data.workspacePath)
      return reply.send(success(data))
    } catch (e) {
      return reply
        .status(502)
        .send(error(502, `模板变量获取失败: ${(e as Error).message}`))
    }
  })
}

export default specRoutes
