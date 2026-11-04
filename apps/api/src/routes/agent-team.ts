// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { error, success } from '../utils/response.js'
import {
  AgentTeamError,
  agentTeamService,
  type AgentTeamService,
} from '../services/agent-team-service.js'

const memberRefSchema = z.object({
  memberKind: z.enum(['agent', 'human']),
  memberId: z.string().min(1).max(128),
})

const createTeamBody = z.object({
  name: z.string().min(1).max(128),
})

const addMemberBody = memberRefSchema.extend({
  role: z.enum(['lead', 'member']).default('member'),
})

const sendInboxBody = z.object({
  fromMember: memberRefSchema,
  toMember: memberRefSchema,
  kind: z.enum(['message', 'system']),
  payload: z.record(z.string(), z.unknown()).default({}),
  idempotencyKey: z.string().min(1).max(128),
})

const handoffBody = z.object({
  artifactPath: z.string().min(1).max(1024),
  sha256: z.string().regex(/^[a-fA-F0-9]{64}$/, 'sha256 必须是 64 位十六进制'),
  fromMember: memberRefSchema,
  toMember: memberRefSchema,
  idempotencyKey: z.string().min(1).max(128),
})

const idParam = z.object({ id: z.uuid() })
const memberParam = z.object({
  id: z.uuid(),
  memberKind: z.enum(['agent', 'human']),
  memberId: z.string().min(1).max(128),
})
const inboxEntryParam = z.object({ id: z.uuid(), entryId: z.uuid() })

/**
 * 多 Agent 协作 API(2026-11-04 立)。最终路径 = /api/agent-teams/*。
 *
 * 错误码语义:
 * - 400:参数非法 / handoff 走错端点
 * - 403:非 lead 管理团队(NOT_TEAM_LEAD)、转交对象非本团队成员(NOT_TEAM_MEMBER)、产物越界
 * - 404:团队不存在或跨租户不可见(统一 404,不泄露存在性)
 * - 409:成员已属其他 active 团队、最后一名 lead、sha256 不一致、幂等键已存在(返回 duplicate)
 */
export const agentTeamRoutes: FastifyPluginAsync = async (server) => {
  const service: AgentTeamService = agentTeamService

  const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || '操作失败,请稍后重试'
      return reply.status(statusCode).send(error(statusCode, message))
    }
  }

  /** AgentTeamError 的唯一下行口径:details 原样带回,拒绝原因可被调用方逐字段读取 */
  const fail = (reply: FastifyReply, e: unknown): FastifyReply => {
    if (e instanceof AgentTeamError) {
      return reply.status(e.statusCode).send({
        code: e.statusCode,
        message: e.message,
        errorCode: e.code,
        details: e.details,
      })
    }
    throw e
  }

  server.post('/agent-teams', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    try {
      const body = createTeamBody.parse(request.body)
      return reply.send(success(await service.createTeam(request.userId, body.name)))
    } catch (e) {
      return fail(reply, e)
    }
  })

  server.get('/agent-teams/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    try {
      const { id } = idParam.parse(request.params)
      return reply.send(success(await service.getTeam(request.userId, id)))
    } catch (e) {
      return fail(reply, e)
    }
  })

  server.delete('/agent-teams/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    try {
      const { id } = idParam.parse(request.params)
      return reply.send(success(await service.dissolveTeam(request.userId, id)))
    } catch (e) {
      return fail(reply, e)
    }
  })

  server.post('/agent-teams/:id/members', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    try {
      const { id } = idParam.parse(request.params)
      const body = addMemberBody.parse(request.body)
      return reply.send(success(await service.addMember(request.userId, id, body)))
    } catch (e) {
      return fail(reply, e)
    }
  })

  server.delete('/agent-teams/:id/members/:memberKind/:memberId', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    try {
      const { id, memberKind, memberId } = memberParam.parse(request.params)
      return reply.send(
        success(await service.removeMember(request.userId, id, { memberKind, memberId })),
      )
    } catch (e) {
      return fail(reply, e)
    }
  })

  server.post('/agent-teams/:id/inbox', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    try {
      const { id } = idParam.parse(request.params)
      const body = sendInboxBody.parse(request.body)
      return reply.send(success(await service.sendInbox(request.userId, id, body)))
    } catch (e) {
      return fail(reply, e)
    }
  })

  server.get('/agent-teams/:id/inbox', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    try {
      const { id } = idParam.parse(request.params)
      const query = z
        .object({
          toMemberKind: z.enum(['agent', 'human']).optional(),
          toMemberId: z.string().min(1).max(128).optional(),
        })
        .refine((q) => (q.toMemberKind === undefined) === (q.toMemberId === undefined), {
          message: 'toMemberKind 与 toMemberId 必须同时提供',
        })
        .parse(request.query)
      const to =
        query.toMemberKind && query.toMemberId
          ? { memberKind: query.toMemberKind, memberId: query.toMemberId }
          : undefined
      return reply.send(success({ entries: await service.listInbox(request.userId, id, to) }))
    } catch (e) {
      return fail(reply, e)
    }
  })

  server.post('/agent-teams/:id/inbox/:entryId/read', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    try {
      const { id, entryId } = inboxEntryParam.parse(request.params)
      return reply.send(success(await service.markInboxRead(request.userId, id, entryId)))
    } catch (e) {
      return fail(reply, e)
    }
  })

  server.post('/agent-teams/:id/handoffs', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    try {
      const { id } = idParam.parse(request.params)
      const body = handoffBody.parse(request.body)
      return reply.send(success(await service.handoff(request.userId, id, body)))
    } catch (e) {
      return fail(reply, e)
    }
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
