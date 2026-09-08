// © 2026 IHUI AI (智汇AI) · 版权所有者:李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:

/**
 * 团队共享记忆路由 (2026-09-08 新增,对标竞品团队知识引擎)
 *
 * 挂载前缀(由 routes/index.ts 统一注册,前缀 /api/team-memory):
 * - GET    /          列出某 scope 记忆(scopeId 必填,支持 kind/tag/keyword 过滤)
 * - POST   /          创建记忆(作者 = 当前登录用户)
 * - GET    /:id       获取单条
 * - PUT    /:id       更新单条(局部,scopeId 不可变)
 * - DELETE /:id       删除单条
 *
 * 隔离维度是 scopeId(teamId 或 workspaceKey),所有登录用户按 scope 共享读写。
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { parseOrThrow, success, error } from '../utils/response.js'
import {
  listTeamMemories,
  getTeamMemory,
  createTeamMemory,
  updateTeamMemory,
  deleteTeamMemory,
  type UpdateTeamMemoryInput,
} from '../services/team-memory-service.js'

// =============================================================================
// Zod schemas
// =============================================================================

/** 记忆类型(本地副本,避免依赖被测试 mock 的 @ihui/database 运行时导出) */
const TEAM_MEMORY_KIND_VALUES = ['decision', 'convention', 'pitfall', 'fingerprint'] as const

const listQuerySchema = z.object({
  scopeId: z.string().min(1, 'scopeId 不能为空').max(128),
  kind: z.enum(TEAM_MEMORY_KIND_VALUES).optional(),
  tag: z.string().max(128).optional(),
  keyword: z.string().max(256).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
})

const createSchema = z.object({
  scopeId: z.string().min(1, 'scopeId 不能为空').max(128),
  kind: z.enum(TEAM_MEMORY_KIND_VALUES),
  title: z.string().min(1, '标题不能为空').max(300),
  content: z.string().min(1, '内容不能为空').max(100_000),
  tags: z.array(z.string().min(1).max(64)).max(30).optional().default([]),
})

const updateSchema = z.object({
  kind: z.enum(TEAM_MEMORY_KIND_VALUES).optional(),
  title: z.string().min(1).max(300).optional(),
  content: z.string().min(1).max(100_000).optional(),
  tags: z.array(z.string().min(1).max(64)).max(30).optional(),
})

const idParamSchema = z.object({ id: z.uuid({ error: '无效的记忆 ID' }) })

// =============================================================================
// 鉴权
// =============================================================================

/** 登录校验(authenticate 失败 → 401;成功后 request.userId 可用) */
async function requireLogin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await authenticate(request)
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    return reply.status(statusCode).send(error(statusCode, '请先登录'))
  }
}

// =============================================================================
// 路由
// =============================================================================

export const teamMemoryRoutes: FastifyPluginAsync = async (app) => {
  // GET / — 列表(按 scopeId 隔离 + kind/tag/keyword 过滤)
  app.get('/', { preHandler: requireLogin }, async (request, reply) => {
    const query = parseOrThrow(listQuerySchema, request.query)
    const rows = await listTeamMemories({
      scopeId: query.scopeId,
      kind: query.kind as ListTeamMemoryKind,
      tag: query.tag,
      keyword: query.keyword,
      limit: query.limit,
    })
    return reply.send(success(rows))
  })

  // POST / — 创建(作者 = 当前用户)
  app.post('/', { preHandler: requireLogin }, async (request, reply) => {
    const body = parseOrThrow(createSchema, request.body)
    const userId = request.userId
    if (!userId) {
      return reply.status(401).send(error(401, '请先登录'))
    }
    const created = await createTeamMemory({
      scopeId: body.scopeId,
      kind: body.kind as CreateTeamMemoryKind,
      title: body.title,
      content: body.content,
      tags: body.tags,
      sourceUserId: userId,
    })
    return reply.send(success(created))
  })

  // GET /:id — 详情
  app.get('/:id', { preHandler: requireLogin }, async (request, reply) => {
    const params = parseOrThrow(idParamSchema, request.params)
    const row = await getTeamMemory(params.id)
    if (!row) {
      return reply.status(404).send(error(404, '记忆不存在'))
    }
    return reply.send(success(row))
  })

  // PUT /:id — 更新(局部)
  app.put('/:id', { preHandler: requireLogin }, async (request, reply) => {
    const params = parseOrThrow(idParamSchema, request.params)
    const body = parseOrThrow(updateSchema, request.body)
    const patch: UpdateTeamMemoryInput = {}
    if (body.kind !== undefined) patch.kind = body.kind as UpdateTeamMemoryKind
    if (body.title !== undefined) patch.title = body.title
    if (body.content !== undefined) patch.content = body.content
    if (body.tags !== undefined) patch.tags = body.tags
    const updated = await updateTeamMemory(params.id, patch)
    if (!updated) {
      return reply.status(404).send(error(404, '记忆不存在'))
    }
    return reply.send(success(updated))
  })

  // DELETE /:id — 删除
  app.delete('/:id', { preHandler: requireLogin }, async (request, reply) => {
    const params = parseOrThrow(idParamSchema, request.params)
    const ok = await deleteTeamMemory(params.id)
    if (!ok) {
      return reply.status(404).send(error(404, '记忆不存在'))
    }
    return reply.send(success({ deleted: true }))
  })
}

// 类型别名(避免与 zod 推断类型命名冲突)
type ListTeamMemoryKind = (typeof TEAM_MEMORY_KIND_VALUES)[number] | undefined
type CreateTeamMemoryKind = (typeof TEAM_MEMORY_KIND_VALUES)[number]
type UpdateTeamMemoryKind = (typeof TEAM_MEMORY_KIND_VALUES)[number]
