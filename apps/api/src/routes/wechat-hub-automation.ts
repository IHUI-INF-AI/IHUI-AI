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
import {
  createRule,
  deleteRule,
  listRules,
  previewAgentReply,
  updateRule,
} from '../services/wechat-hub/automation.js'
import { exportAccountMessages } from '../services/wechat-hub/export.js'
import { importWechatMessages } from '../services/wechat-hub/import.js'
import { syncHistoryFromBridge } from '../services/wechat-hub/history-sync.js'
import { listContacts, listGroupMembers, updateContact } from '../services/wechat-hub/contacts.js'
import { getSchedule, saveSchedule } from '../services/wechat-hub/digest.js'
import { syncGroupMembersFromBridge } from '../services/wechat-hub/operations.js'
import { wechatHubManager } from '../services/wechat-hub/manager.js'
import { listCommandsForAccount } from '../services/wechat-hub/commands.js'
import { buildReport } from '../services/wechat-hub/reports.js'
import { askMessages } from '../services/wechat-hub/ask.js'
import { deleteJob, listJobs, runDueJobs, saveJob, toggleJob } from '../services/wechat-hub/jobs.js'
import { transcribeAccountVoice, transcribeMessage } from '../services/wechat-hub/transcribe.js'
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
  matchType: z.enum(['contains', 'exact', 'prefix', 'agent']).optional(),
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

const previewSchema = z.object({
  text: z.string().min(1).max(2_000),
  conversationId: z.string().uuid().optional(),
})

const exportQuerySchema = z.object({
  format: z.enum(['jsonl', 'csv', 'html', 'markdown', 'xlsx', 'chatlab']).optional(),
  conversationId: z.string().uuid().optional(),
  since: z.string().min(1).max(64).optional(),
  until: z.string().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(20_000).optional(),
  timezone: z.string().min(1).max(64).optional(),
})

const reportSchema = z.object({
  kind: z.enum(['annual', 'pair', 'group']),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  conversationId: z.string().uuid().optional(),
  timezone: z.string().min(1).max(64).optional(),
})

const askSchema = z.object({
  question: z.string().min(1).max(500),
  conversationId: z.string().uuid().optional(),
  since: z.string().min(1).max(64).optional(),
  until: z.string().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  model: z.string().min(1).max(128).optional(),
})

const jobPayloadSchema = z.object({
  text: z.string().max(5_000).optional(),
  mediaUrl: z.string().max(2_000).optional(),
  targets: z.array(z.string().min(1).max(255)).max(100).optional(),
  tags: z.array(z.string().min(1).max(40)).max(30).optional(),
  reportKind: z.enum(['annual', 'pair', 'group']).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  conversationId: z.string().uuid().optional(),
})

const jobSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  kind: z.enum(['broadcast', 'report']),
  enabled: z.boolean().optional(),
  hour: z.coerce.number().int().min(0).max(23).optional(),
  minute: z.coerce.number().int().min(0).max(59).optional(),
  timezone: z.string().min(1).max(64).optional(),
  weekly: z.union([z.coerce.number().int().min(0).max(6), z.null()]).optional(),
  payload: jobPayloadSchema,
})

const jobToggleSchema = z.object({ enabled: z.boolean() })

const transcribeSchema = z.object({
  messageId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
})

const importMessageSchema = z.object({
  platformChatId: z.string().min(1),
  platformMessageId: z.string().optional(),
  conversationTitle: z.string().optional(),
  conversationKind: z.enum(['private', 'group', 'official', 'service']).optional(),
  direction: z.enum(['inbound', 'outbound']).optional(),
  kind: z
    .enum(['text', 'image', 'voice', 'video', 'file', 'link', 'card', 'system', 'other'])
    .optional(),
  senderId: z.string().optional(),
  senderName: z.string().optional(),
  content: z.string().optional(),
  mediaUrl: z.string().optional(),
  sentAt: z.union([z.string(), z.number()]).optional(),
})

const importMessagesSchema = z.object({
  messages: z.array(importMessageSchema).min(1).max(5_000),
})

const historySyncSchema = z.object({
  limit: z.coerce.number().int().min(1).max(2_000).optional(),
  conversationId: z.string().uuid().optional(),
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

  server.post<{ Params: { id: string; conversationId: string } }>(
    '/wechat-hub/accounts/:id/conversations/:conversationId/members/sync',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        return reply.send(
          success(
            await syncGroupMembersFromBridge(
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

  server.post<{ Params: { id: string; ruleId: string } }>(
    '/wechat-hub/accounts/:id/auto-reply-rules/:ruleId/preview',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        const input = parseOrThrow(previewSchema, request.body)
        return reply.send(
          success(
            await previewAgentReply(
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

  server.get<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/commands',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        return reply.send(
          success(await listCommandsForAccount(requireUserId(request), request.params.id)),
        )
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.post<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/reports',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        const input = parseOrThrow(reportSchema, request.body)
        return reply.send(
          success(await buildReport(requireUserId(request), request.params.id, input)),
        )
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.post<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/ask',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        const input = parseOrThrow(askSchema, request.body)
        return reply.send(
          success(await askMessages(requireUserId(request), request.params.id, input)),
        )
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.get<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/jobs',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        return reply.send(success(await listJobs(requireUserId(request), request.params.id)))
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.post<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/jobs',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        const input = parseOrThrow(jobSchema, request.body)
        return reply
          .status(201)
          .send(success(await saveJob(requireUserId(request), request.params.id, input)))
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.patch<{ Params: { id: string; jobId: string } }>(
    '/wechat-hub/accounts/:id/jobs/:jobId',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        const input = parseOrThrow(jobToggleSchema, request.body)
        return reply.send(
          success(
            await toggleJob(
              requireUserId(request),
              request.params.id,
              request.params.jobId,
              input.enabled,
            ),
          ),
        )
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.delete<{ Params: { id: string; jobId: string } }>(
    '/wechat-hub/accounts/:id/jobs/:jobId',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        const deleted = await deleteJob(
          requireUserId(request),
          request.params.id,
          request.params.jobId,
        )
        return reply.send(success({ deleted }))
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  // 手动跑一轮：不等到点也能验收调度链路，返回本轮实际执行的任务清单
  server.post('/wechat-hub/jobs/run', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    try {
      return reply.send(success(await runDueJobs(new Date())))
    } catch (e) {
      return answerError(reply, e)
    }
  })

  // 语音转写：给了 messageId 就转单条，否则批量扫未转写的语音
  server.post<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/voice/transcribe',
    { bodyLimit: 8 * 1024 * 1024 },
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        const input = parseOrThrow(transcribeSchema, request.body ?? {})
        const userId = requireUserId(request)
        const result = input.messageId
          ? await transcribeMessage(userId, request.params.id, input.messageId)
          : await transcribeAccountVoice(userId, request.params.id, { limit: input.limit })
        return reply.send(success(result))
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.get<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/export',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        const query = parseOrThrow(exportQuerySchema, request.query)
        return reply.send(
          success(await exportAccountMessages(requireUserId(request), request.params.id, query)),
        )
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.post<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/import/messages',
    { bodyLimit: 20 * 1024 * 1024 },
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        const input = parseOrThrow(importMessagesSchema, request.body)
        return reply.send(
          success(await importWechatMessages(requireUserId(request), request.params.id, input)),
        )
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.post<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/history/sync',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        const input = parseOrThrow(historySyncSchema, request.body ?? {})
        return reply.send(
          success(await syncHistoryFromBridge(requireUserId(request), request.params.id, input)),
        )
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
