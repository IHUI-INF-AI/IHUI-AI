// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信智联 P0 增补路由：联系人 / 群成员 / 自动回复规则 / 日报计划。
 * 与主路由分开注册，避免单文件继续膨胀；鉴权与错误响应走共用助手。
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { checkAuth } from '../plugins/auth.js'
import { parseOrThrow, success } from '../utils/response.js'
import { createRule, deleteRule, listRules, updateRule } from '../services/wechat-hub/automation.js'
import { listContacts, listGroupMembers, updateContact } from '../services/wechat-hub/contacts.js'
import { getSchedule, saveSchedule } from '../services/wechat-hub/digest.js'
import { wechatHubManager } from '../services/wechat-hub/manager.js'
import { answerError, requireUserId } from './wechat-hub-route-utils.js'

const contactQuerySchema = z.object({ query: z.string().max(80).optional() })

const contactUpdateSchema = z.object({
  remark: z.string().max(255).optional(),
  tags: z.array(z.string().min(1).max(40)).max(30).optional(),
  blocked: z.boolean().optional(),
})

const ruleSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  enabled: z.boolean().optional(),
  matchType: z.enum(['contains', 'exact', 'prefix']).optional(),
  keywords: z.array(z.string().min(1).max(80)).max(50).optional(),
  replyText: z.string().max(5000).optional(),
  scope: z.enum(['all', 'private', 'group']).optional(),
  cooldownSeconds: z.coerce.number().int().min(0).max(86_400).optional(),
})

const digestSchema = z.object({
  enabled: z.boolean().optional(),
  hour: z.coerce.number().int().min(0).max(23).optional(),
  minute: z.coerce.number().int().min(0).max(59).optional(),
  timezone: z.string().min(1).max(64).optional(),
  target: z.string().max(255).optional(),
})

export const wechatHubAutomationRoutes: FastifyPluginAsync = async (server) => {
  server.get<{ Params: { id: string }; Querystring: { query?: string } }>(
    '/wechat-hub/accounts/:id/contacts',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        const query = parseOrThrow(contactQuerySchema, request.query)
        return reply.send(
          success(await listContacts(requireUserId(request), request.params.id, query.query ?? '')),
        )
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.patch<{ Params: { id: string; contactId: string } }>(
    '/wechat-hub/accounts/:id/contacts/:contactId',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        const patch = parseOrThrow(contactUpdateSchema, request.body)
        return reply.send(
          success(
            await updateContact(
              requireUserId(request),
              request.params.id,
              request.params.contactId,
              patch,
            ),
          ),
        )
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.get<{ Params: { id: string; conversationId: string } }>(
    '/wechat-hub/accounts/:id/conversations/:conversationId/members',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        return reply.send(
          success(
            await listGroupMembers(
              requireUserId(request),
              request.params.id,
              request.params.conversationId,
            ),
          ),
        )
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.get<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/auto-reply-rules',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        return reply.send(success(await listRules(requireUserId(request), request.params.id)))
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.post<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/auto-reply-rules',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        const input = parseOrThrow(ruleSchema, request.body)
        return reply
          .status(201)
          .send(success(await createRule(requireUserId(request), request.params.id, input)))
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.patch<{ Params: { id: string; ruleId: string } }>(
    '/wechat-hub/accounts/:id/auto-reply-rules/:ruleId',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        const input = parseOrThrow(ruleSchema, request.body)
        return reply.send(
          success(
            await updateRule(
              requireUserId(request),
              request.params.id,
              request.params.ruleId,
              input,
            ),
          ),
        )
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.delete<{ Params: { id: string; ruleId: string } }>(
    '/wechat-hub/accounts/:id/auto-reply-rules/:ruleId',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        await deleteRule(requireUserId(request), request.params.id, request.params.ruleId)
        return reply.send(success({ deleted: true }))
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.get<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/digest-schedule',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        return reply.send(success(await getSchedule(requireUserId(request), request.params.id)))
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.put<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/digest-schedule',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        const input = parseOrThrow(digestSchema, request.body)
        return reply.send(
          success(await saveSchedule(requireUserId(request), request.params.id, input)),
        )
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.post<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/digest-schedule/run',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        return reply.send(
          success(await wechatHubManager.runDigestNow(requireUserId(request), request.params.id)),
        )
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
