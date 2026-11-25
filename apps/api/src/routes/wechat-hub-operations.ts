// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信智联扩展操作路由：联系人同步/删除、群管理、朋友圈发布。
 * 与主路由/自动回复路由分开注册，保持单文件 <250 行。
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { checkAuth } from '../plugins/auth.js'
import { parseOrThrow, success } from '../utils/response.js'
import {
  deleteContact,
  fetchMoments,
  listMomentArchive,
  publishMoment,
  runGroupAction,
  syncContacts,
} from '../services/wechat-hub/operations.js'
import { pushMemberMapForAccount } from '../services/wechat-hub/member-map-sync.js'
import { answerError, requireUserId } from './wechat-hub-route-utils.js'

const groupActionSchema = z.object({
  action: z.enum(['create', 'invite', 'kick', 'rename', 'announce']),
  conversationId: z.string().min(1).max(255).optional(),
  memberIds: z.array(z.string().min(1).max(255)).max(50).optional(),
  title: z.string().min(1).max(120).optional(),
  text: z.string().max(2000).optional(),
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

  server.get<{ Params: { id: string }; Querystring: { limit?: number } }>(
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
