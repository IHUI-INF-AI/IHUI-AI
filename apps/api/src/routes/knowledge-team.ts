// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D29 团队知识引擎路由(G-35):记忆 / Repo Wiki / 知识卡的云端共享 + 成员修正 + 过程审计。
 *
 * 挂载前缀(由主会话在 routes/index.ts 统一注册,建议 `/api/knowledge-team`):
 * - GET    /spaces                      列团队下的知识空间(?teamId=)
 * - POST   /spaces                      建空间(团队 owner/admin)
 * - GET    /spaces/:spaceId             空间详情(带 myRole)
 * - GET    /spaces/:spaceId/members     空间成员与角色
 * - PUT    /spaces/:spaceId/members     授权/改角色/撤权(空间 owner)
 * - GET    /spaces/:spaceId/items       列条目(kind/status/keyword 过滤)
 * - POST   /spaces/:spaceId/items       新建条目(editor+)
 * - GET    /spaces/:spaceId/revisions   空间审计流
 * - GET    /items/:itemId               条目详情
 * - PUT    /items/:itemId               成员修正(editor+,带 expectedRevision 乐观并发)
 * - POST   /items/:itemId/status        发布 / 归档(editor+)
 * - GET    /items/:itemId/revisions     单条目版本流
 *
 * 鉴权面(§5「鉴权面公开化必须显式列举」):**本面零公开路径** —— 12 条全部挂
 * `requireLogin`,没有任何一条走"参数路由兜底正则"。之所以这里没有公开面要列举:
 * 团队知识不是游客内容,一旦用 `/knowledge-team/[^/]+` 这类形态去放行详情,
 * 就会连静态段一起放行,而下游 handler 依赖 request.userId ⇒ 游客走到那儿是 500 不是 401。
 *
 * 授权面:身份只从 authenticate() 的 payload 取;请求体里的 userId/role 一律不作为
 * 权限依据(见 knowledge-team-service 顶部)。
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { TEAM_KNOWLEDGE_ACTIONS, TEAM_KNOWLEDGE_KINDS, TEAM_KNOWLEDGE_ROLES, TEAM_KNOWLEDGE_STATUSES } from '@ihui/database'
import { authenticate } from '../plugins/auth.js'
import { parseOrThrow, success } from '../utils/response.js'
import {
  createItem,
  createSpace,
  getItem,
  getSpace,
  listItems,
  listRevisions,
  listSpaceMembers,
  listSpaces,
  reviseItem,
  setItemStatus,
  setSpaceMember,
} from '../services/knowledge-team-service.js'

// =============================================================================
// Zod schemas
// =============================================================================

const spaceIdParamSchema = z.object({ spaceId: z.uuid({ error: '无效的空间 ID' }) })
const itemIdParamSchema = z.object({ itemId: z.uuid({ error: '无效的条目 ID' }) })

/** 审计流按动作收窄(如"只看成员的 revise")。面由路径决定(space 或 item),不进 query */
const revisionsQuerySchema = z.object({
  action: z.enum(TEAM_KNOWLEDGE_ACTIONS).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
})

const listSpacesQuerySchema = z.object({
  teamId: z.uuid({ error: '无效的团队 ID' }),
  includeArchived: z
    .union([z.boolean(), z.enum(['true', 'false', '0', '1'])])
    .transform((v) => v === true || v === 'true' || v === '1')
    .optional(),
})

const listItemsQuerySchema = z.object({
  kind: z.enum(TEAM_KNOWLEDGE_KINDS).optional(),
  status: z.enum(TEAM_KNOWLEDGE_STATUSES).optional(),
  keyword: z.string().max(200).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().min(0).max(10_000).optional(),
})

const createSpaceSchema = z.object({
  teamId: z.uuid({ error: '无效的团队 ID' }),
  name: z.string().trim().min(1, '空间名称不能为空').max(128),
  settings: z.record(z.string(), z.unknown()).optional(),
  visibility: z.enum(['team', 'restricted']).optional(),
})

const memberBodySchema = z.object({
  userId: z.uuid({ error: '无效的用户 ID' }),
  /** null = 撤权;刻意不用 optional,漏传会被当成"撤销",那是最危险的默认值 */
  role: z.union([z.enum(TEAM_KNOWLEDGE_ROLES), z.null()]),
})

const createItemSchema = z.object({
  kind: z.enum(TEAM_KNOWLEDGE_KINDS),
  title: z.string().trim().min(1, '标题不能为空').max(300),
  content: z.record(z.string(), z.unknown()),
  plainText: z.string().max(200_000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
  status: z.enum(TEAM_KNOWLEDGE_STATUSES).optional(),
  sourceRef: z.record(z.string(), z.unknown()).nullish(),
  changeNote: z.string().trim().max(500).optional(),
})

const reviseItemSchema = z
  .object({
    title: z.string().trim().min(1).max(300).optional(),
    content: z.record(z.string(), z.unknown()).optional(),
    plainText: z.string().max(200_000).optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
    changeNote: z.string().trim().max(500).optional(),
    expectedRevision: z.coerce.number().int().positive(),
  })
  .refine(
    (v) =>
      v.title !== undefined ||
      v.content !== undefined ||
      v.plainText !== undefined ||
      v.tags !== undefined,
    { message: '没有任何要修改的字段' },
  )

const itemStatusSchema = z.object({
  status: z.enum(TEAM_KNOWLEDGE_STATUSES),
  changeNote: z.string().trim().max(500).optional(),
})

// =============================================================================
// 鉴权
// =============================================================================

/**
 * 登录校验:成功后 request.userId 才有值。
 * 401 是"没登录",403 是"登录了但没权限" —— 两个码由不同层负责:
 * 这里只出 401,403 一律由服务层的 AppError 出,不得在路由里复制一份权限判定。
 */
async function requireLogin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await authenticate(request)
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    void reply.status(statusCode).send({ code: statusCode, message: '请先登录' })
  }
}

/** 取令牌主体;requireLogin 之后仍要判空,是因为 preHandler 与 handler 之间没有类型联系 */
function actorOf(request: FastifyRequest): { userId: string } | null {
  return request.userId ? { userId: request.userId } : null
}

const UNAUTHORIZED = { code: 401, message: '请先登录' }

// =============================================================================
// 路由
// =============================================================================

export const knowledgeTeamRoutes: FastifyPluginAsync = async (app) => {
  // ---------------------------------------------------------------- 空间

  app.get('/spaces', { preHandler: requireLogin }, async (request, reply) => {
    const actor = actorOf(request)
    if (!actor) return reply.status(401).send(UNAUTHORIZED)
    const query = parseOrThrow(listSpacesQuerySchema, request.query)
    const items = await listSpaces(actor, {
      teamId: query.teamId,
      includeArchived: query.includeArchived,
    })
    return reply.send(success(items))
  })

  app.post('/spaces', { preHandler: requireLogin }, async (request, reply) => {
    const actor = actorOf(request)
    if (!actor) return reply.status(401).send(UNAUTHORIZED)
    const body = parseOrThrow(createSpaceSchema, request.body)
    const space = await createSpace(actor, body)
    return reply.status(201).send(success(space))
  })

  app.get('/spaces/:spaceId', { preHandler: requireLogin }, async (request, reply) => {
    const actor = actorOf(request)
    if (!actor) return reply.status(401).send(UNAUTHORIZED)
    const params = parseOrThrow(spaceIdParamSchema, request.params)
    return reply.send(success(await getSpace(actor, params.spaceId)))
  })

  app.get('/spaces/:spaceId/members', { preHandler: requireLogin }, async (request, reply) => {
    const actor = actorOf(request)
    if (!actor) return reply.status(401).send(UNAUTHORIZED)
    const params = parseOrThrow(spaceIdParamSchema, request.params)
    return reply.send(success(await listSpaceMembers(actor, params.spaceId)))
  })

  app.put('/spaces/:spaceId/members', { preHandler: requireLogin }, async (request, reply) => {
    const actor = actorOf(request)
    if (!actor) return reply.status(401).send(UNAUTHORIZED)
    const params = parseOrThrow(spaceIdParamSchema, request.params)
    const body = parseOrThrow(memberBodySchema, request.body)
    return reply.send(
      success(
        await setSpaceMember({
          actor,
          spaceId: params.spaceId,
          /** 请求里的 userId 只是"要对谁做这件事"的目标句柄,从不参与调用人的权限判定 */
          targetUserId: body.userId,
          role: body.role,
        }),
      ),
    )
  })

  // ---------------------------------------------------------------- 条目

  app.get('/spaces/:spaceId/items', { preHandler: requireLogin }, async (request, reply) => {
    const actor = actorOf(request)
    if (!actor) return reply.status(401).send(UNAUTHORIZED)
    const params = parseOrThrow(spaceIdParamSchema, request.params)
    const query = parseOrThrow(listItemsQuerySchema, request.query)
    const items = await listItems(actor, { spaceId: params.spaceId, ...query })
    return reply.send(success(items))
  })

  app.post('/spaces/:spaceId/items', { preHandler: requireLogin }, async (request, reply) => {
    const actor = actorOf(request)
    if (!actor) return reply.status(401).send(UNAUTHORIZED)
    const params = parseOrThrow(spaceIdParamSchema, request.params)
    const body = parseOrThrow(createItemSchema, request.body)
    const item = await createItem(actor, { spaceId: params.spaceId, ...body })
    return reply.status(201).send(success(item))
  })

  app.get('/items/:itemId', { preHandler: requireLogin }, async (request, reply) => {
    const actor = actorOf(request)
    if (!actor) return reply.status(401).send(UNAUTHORIZED)
    const params = parseOrThrow(itemIdParamSchema, request.params)
    return reply.send(success(await getItem(actor, params.itemId)))
  })

  app.put('/items/:itemId', { preHandler: requireLogin }, async (request, reply) => {
    const actor = actorOf(request)
    if (!actor) return reply.status(401).send(UNAUTHORIZED)
    const params = parseOrThrow(itemIdParamSchema, request.params)
    const body = parseOrThrow(reviseItemSchema, request.body)
    return reply.send(success(await reviseItem(actor, { itemId: params.itemId, ...body })))
  })

  app.post('/items/:itemId/status', { preHandler: requireLogin }, async (request, reply) => {
    const actor = actorOf(request)
    if (!actor) return reply.status(401).send(UNAUTHORIZED)
    const params = parseOrThrow(itemIdParamSchema, request.params)
    const body = parseOrThrow(itemStatusSchema, request.body)
    return reply.send(success(await setItemStatus(actor, { itemId: params.itemId, ...body })))
  })

  // ---------------------------------------------------------------- 审计流

  app.get('/spaces/:spaceId/revisions', { preHandler: requireLogin }, async (request, reply) => {
    const actor = actorOf(request)
    if (!actor) return reply.status(401).send(UNAUTHORIZED)
    const params = parseOrThrow(spaceIdParamSchema, request.params)
    const query = parseOrThrow(revisionsQuerySchema, request.query)
    return reply.send(
      success(
        await listRevisions(actor, {
          spaceId: params.spaceId,
          action: query.action,
          limit: query.limit,
        }),
      ),
    )
  })

  app.get('/items/:itemId/revisions', { preHandler: requireLogin }, async (request, reply) => {
    const actor = actorOf(request)
    if (!actor) return reply.status(401).send(UNAUTHORIZED)
    const params = parseOrThrow(itemIdParamSchema, request.params)
    const query = parseOrThrow(revisionsQuerySchema, request.query)
    return reply.send(
      success(
        await listRevisions(actor, {
          itemId: params.itemId,
          action: query.action,
          limit: query.limit,
        }),
      ),
    )
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
