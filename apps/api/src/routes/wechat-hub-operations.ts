// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信智联扩展操作路由：联系人同步/删除、群管理、朋友圈发布。
 * 与主路由/自动回复路由分开注册，保持单文件 <250 行。
 */

import type { FastifyPluginAsync } from 'fastify'
import type { WechatGroupActionInput } from '@ihui/types'
import { z } from 'zod'
import { checkAuth } from '../plugins/auth.js'
import { parseOrThrow, success } from '../utils/response.js'
import {
  deleteContact,
  fetchMoments,
  listMomentArchive,
  previewGroupAction,
  publishMoment,
  runGroupAction,
  syncContacts,
} from '../services/wechat-hub/operations.js'
import {
  getGroupWritePolicy,
  getGroupWriteRuntimeView,
  saveGroupWritePolicy,
} from '../services/wechat-hub/group-writes.js'
import { probeBridgeForAccount } from '../services/wechat-hub/bridge-probe.js'
import { wechatHubManager } from '../services/wechat-hub/manager.js'
import { pushMemberMapForAccount } from '../services/wechat-hub/member-map-sync.js'
import { answerError, requireUserId } from './wechat-hub-route-utils.js'

/** 带目标成员的动作：空成员会给桥发空动作，白跑一趟还占频次，必须在 schema 层拦下。 */
const WRITE_WITH_MEMBERS = ['kick', 'invite', 'create'] as const

function groupActionNeedsMembers(action: string): boolean {
  return (WRITE_WITH_MEMBERS as readonly string[]).includes(action)
}

const groupActionSchema = z
  .object({
    action: z.enum(['create', 'invite', 'kick', 'rename', 'announce']),
    conversationId: z.string().min(1).max(255).optional(),
    memberIds: z.array(z.string().min(1).max(255)).max(10).optional(),
    title: z.string().min(1).max(120).optional(),
    text: z.string().max(2000).optional(),
    confirmToken: z.string().min(1).max(2048).optional(),
    dryRun: z.boolean().optional(),
  })
  .superRefine((d, ctx) => {
    if (groupActionNeedsMembers(d.action) && (!d.memberIds || d.memberIds.length === 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${d.action} 动作至少需要 1 个成员` })
    }
  })

const groupPlanSchema = z
  .object({
    action: z.enum(['create', 'invite', 'kick', 'rename', 'announce']),
    conversationId: z.string().min(1).max(255).optional(),
    memberIds: z.array(z.string().min(1).max(255)).max(10).optional(),
    title: z.string().min(1).max(120).optional(),
    text: z.string().max(2000).optional(),
  })
  .superRefine((d, ctx) => {
    if (groupActionNeedsMembers(d.action) && (!d.memberIds || d.memberIds.length === 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${d.action} 动作至少需要 1 个成员` })
    }
  })

const groupPolicySchema = z.object({
  enabled: z.boolean().optional(),
  maxTargetsPerAction: z.coerce.number().int().min(1).max(10).optional(),
  maxActionsPerHour: z.coerce.number().int().min(1).max(10).optional(),
})

const momentSchema = z.object({
  text: z.string().min(1).max(5000),
  mediaUrls: z.array(z.string().url().max(2048)).max(9).optional(),
})

const momentFetchSchema = z.object({
  maxPages: z.coerce.number().int().min(1).max(30).optional(),
  id: z.coerce.number().int().min(0).optional(),
})

const momentArchiveQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).max(100_000).optional(),
})

const momentMediaQuerySchema = z.object({
  momentId: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
})

const momentMediaListQuerySchema = z.object({
  momentId: z.string().min(1).max(200),
})

export const wechatHubOperationsRoutes: FastifyPluginAsync = async (server) => {
  server.post<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/contacts/sync',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        return reply.send(success(await syncContacts(requireUserId(request), request.params.id)))
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.delete<{ Params: { id: string; contactId: string } }>(
    '/wechat-hub/accounts/:id/contacts/:contactId/remote',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        return reply.send(
          success(
            await deleteContact(
              requireUserId(request),
              request.params.id,
              request.params.contactId,
            ),
          ),
        )
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.post<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/groups/action',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        const input = parseOrThrow(groupActionSchema, request.body)
        return reply.send(
          success(await runGroupAction(requireUserId(request), request.params.id, input)),
        )
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  // create 预览没有会话段，conversationId 走 body；非 create 也可从这条入口提交。
  server.post<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/groups/plan',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        const input = parseOrThrow(groupPlanSchema, request.body)
        return reply.send(success(await previewGroupAction(requireUserId(request), request.params.id, input)))
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.post<{ Params: { id: string; conversationId: string } }>(
    '/wechat-hub/accounts/:id/groups/:conversationId/plan',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        const body = parseOrThrow(groupPlanSchema, request.body)
        const input: WechatGroupActionInput = { ...body, conversationId: request.params.conversationId }
        return reply.send(success(await previewGroupAction(requireUserId(request), request.params.id, input)))
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.get<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/groups/policy',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        return reply.send(success(await getGroupWritePolicy(requireUserId(request), request.params.id)))
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.put<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/groups/policy',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        const patch = parseOrThrow(groupPolicySchema, request.body ?? {})
        return reply.send(success(await saveGroupWritePolicy(requireUserId(request), request.params.id, patch)))
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  // 桥体检：3 秒内探一次 /status，把驱动、账号目录、队列长度带回来，桥没起来也照常返回。
  server.get<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/bridge-status',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        return reply.send(
          success(await probeBridgeForAccount(requireUserId(request), request.params.id)),
        )
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  // 群写审计：最近 20 次动作（含被闸拦下的失败），以及当前一小时窗口里还剩几次额度。
  server.get<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/groups/audit',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        const { runtime, policy } = await getGroupWriteRuntimeView(
          requireUserId(request),
          request.params.id,
        )
        return reply.send(
          success({
            entries: runtime.audit.map((entry) => ({
              at: new Date(entry.at).toISOString(),
              action: entry.action,
              conversationId: entry.conversationId,
              chatTitle: entry.chatTitle,
              memberIds: entry.memberIds,
              ok: entry.ok,
              status: entry.status,
            })),
            windowCount: runtime.stamps.length,
            windowLimit: policy.maxActionsPerHour,
            remaining: Math.max(policy.maxActionsPerHour - runtime.stamps.length, 0),
          }),
        )
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.post<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/moments/fetch',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        const input = parseOrThrow(momentFetchSchema, request.body ?? {})
        return reply.send(
          success(await fetchMoments(requireUserId(request), request.params.id, input)),
        )
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.get<{ Params: { id: string }; Querystring: { limit?: number; offset?: number } }>(
    '/wechat-hub/accounts/:id/moments/archive',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        const query = parseOrThrow(momentArchiveQuerySchema, request.query)
        return reply.send(
          success(await listMomentArchive(requireUserId(request), request.params.id, query)),
        )
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.get<{ Params: { id: string }; Querystring: { momentId: string } }>(
    '/wechat-hub/accounts/:id/moments/media/list',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        const query = parseOrThrow(momentMediaListQuerySchema, request.query)
        return reply.send(
          success(
            await wechatHubManager.listMomentMedia(
              requireUserId(request),
              request.params.id,
              query.momentId,
            ),
          ),
        )
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.get<{ Params: { id: string }; Querystring: { momentId: string; name: string } }>(
    '/wechat-hub/accounts/:id/moments/media',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        const query = parseOrThrow(momentMediaQuerySchema, request.query)
        const media = await wechatHubManager.readMomentMedia(
          requireUserId(request),
          request.params.id,
          query.momentId,
          query.name,
        )
        return reply
          .header('Content-Type', media.contentType)
          .header('Content-Disposition', 'inline')
          .header('Cache-Control', 'private, max-age=300')
          .send(media.data)
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.post<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/moments',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        const input = parseOrThrow(momentSchema, request.body)
        return reply.send(
          success(await publishMoment(requireUserId(request), request.params.id, input)),
        )
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.post<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/members/map/push',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        return reply.send(
          success(await pushMemberMapForAccount(requireUserId(request), request.params.id)),
        )
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
