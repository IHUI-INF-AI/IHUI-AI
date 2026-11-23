// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信智联（WeChat Hub）HTTP 入口。
 *
 * 路由分四组：
 *  1. /wechat-hub/capabilities            后端能力矩阵
 *  2. /wechat-hub/accounts/**             账号生命周期、会话、消息、审计
 *  3. /wechat-hub/send|analyze            主动动作与 AI 分析
 *  4. /wechat-hub/mcp/**                  MCP 工具清单与统一调用
 *
 * 联系人/群成员/自动回复/日报计划在 wechat-hub-automation.ts 单独注册。
 *
 * 另有 /wechat-hub/webhook/:accountId 供本地桥推送入站消息，走账号级 secret 验签，不要求登录。
 *
 * 鉴权：除 webhook 外全部要求登录；数据按 request.userId 隔离。
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import type { WechatMcpTool } from '@ihui/types'
import { checkAuth } from '../plugins/auth.js'
import { AppError } from '../errors/AppError.js'
import { parseOrThrow, success } from '../utils/response.js'
import { wechatHubManager } from '../services/wechat-hub/manager.js'
import { listContacts, listGroupMembers } from '../services/wechat-hub/contacts.js'
import { listRules } from '../services/wechat-hub/automation.js'
import { getSchedule } from '../services/wechat-hub/digest.js'
import { publishMoment, runGroupAction, syncContacts } from '../services/wechat-hub/operations.js'
import { broadcast } from '../services/wechat-hub/broadcast.js'
import { searchKnowledge } from '../services/wechat-hub/knowledge.js'
import { answerError, requireUserId } from './wechat-hub-route-utils.js'

const backendSchema = z.enum(['ilink', 'bridge', 'mock'])
const kindSchema = z.enum(['text', 'image', 'voice', 'video', 'file', 'link', 'card'])
const analysisKindSchema = z.enum([
  'summary',
  'daily',
  'todos',
  'keywords',
  'relations',
  'sentiment',
  'profile',
])

const createAccountSchema = z.object({
  label: z.string().min(1).max(80),
  backend: backendSchema,
  credentials: z.record(z.string(), z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

const settingsSchema = z.object({
  allowlistEnabled: z.boolean().optional(),
  allowedTargets: z.array(z.string().min(1).max(255)).max(500).optional(),
  blockedWords: z.array(z.string().min(1).max(80)).max(200).optional(),
  rateLimitPerMinute: z.coerce.number().int().min(1).max(120).optional(),
})

const sendSchema = z.object({
  accountId: z.string().min(1),
  target: z.string().min(1).max(255),
  kind: kindSchema.optional(),
  text: z.string().max(5000).optional(),
  mediaUrl: z
    .string()
    .regex(/^https?:\/\//)
    .max(2048)
    .optional(),
  replyToMessageId: z.string().max(255).optional(),
  mentions: z.array(z.string().min(1).max(255)).max(50).optional(),
  dryRun: z.boolean().optional(),
})

const analyzeSchema = z.object({
  accountId: z.string().min(1),
  conversationId: z.string().min(1).optional(),
  kind: analysisKindSchema,
  limit: z.coerce.number().int().min(10).max(1000).optional(),
  model: z.string().max(80).optional(),
  force: z.boolean().optional(),
})

const limitQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

const messagesQuerySchema = z.object({
  conversationId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  before: z.string().optional(),
})

const mcpCallSchema = z.object({
  name: z.string().min(1),
  arguments: z.record(z.string(), z.unknown()).optional(),
})

const groupActionNameSchema = z.enum(['create', 'invite', 'kick', 'rename', 'announce'])

const broadcastKindSchema = z.enum(['text', 'image', 'file', 'link', 'card'])

const MCP_TOOLS: WechatMcpTool[] = [
  {
    name: 'wechat_list_accounts',
    description: '列出当前用户的微信账号及其连接状态。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'wechat_list_conversations',
    description: '列出指定微信账号的会话（私聊/群聊），含未读数与最近消息时间。',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string' },
        limit: { type: 'number', minimum: 1, maximum: 200 },
      },
      required: ['accountId'],
    },
  },
  {
    name: 'wechat_get_messages',
    description: '读取指定微信账号/会话的最近消息。',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string' },
        conversationId: { type: 'string' },
        limit: { type: 'number', minimum: 1, maximum: 200 },
      },
      required: ['accountId'],
    },
  },
  {
    name: 'wechat_search_messages',
    description: '在指定微信账号的消息正文中做关键词检索。',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string' },
        query: { type: 'string' },
        limit: { type: 'number', minimum: 1, maximum: 100 },
      },
      required: ['accountId', 'query'],
    },
  },
  {
    name: 'wechat_send_text',
    description: '以指定微信账号发送文本；会走白名单/敏感词/限流策略，可用 dryRun 预演。',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string' },
        target: { type: 'string' },
        text: { type: 'string' },
        dryRun: { type: 'boolean' },
      },
      required: ['accountId', 'target', 'text'],
    },
  },
  {
    name: 'wechat_analyze',
    description:
      '对指定账号/会话做 AI 分析（summary/daily/todos/keywords/relations/sentiment/profile）。',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string' },
        conversationId: { type: 'string' },
        kind: {
          type: 'string',
          enum: ['summary', 'daily', 'todos', 'keywords', 'relations', 'sentiment', 'profile'],
        },
        limit: { type: 'number', minimum: 10, maximum: 1000 },
        force: { type: 'boolean' },
      },
      required: ['accountId', 'kind'],
    },
  },
  {
    name: 'wechat_daily_digest',
    description: '生成指定账号的当日汇总（跨全部会话）。',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string' },
        limit: { type: 'number', minimum: 10, maximum: 1000 },
      },
      required: ['accountId'],
    },
  },
  {
    name: 'wechat_list_actions',
    description: '查看指定账号的动作审计（发送/分析/账号操作）。',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string' },
        limit: { type: 'number', minimum: 1, maximum: 200 },
      },
      required: ['accountId'],
    },
  },
  {
    name: 'wechat_list_contacts',
    description: '列出指定账号的联系人（入站发送者自动归档，可按昵称/备注/微信号搜索）。',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string' },
        query: { type: 'string' },
      },
      required: ['accountId'],
    },
  },
  {
    name: 'wechat_list_group_members',
    description: '列出指定群聊的成员快照（仅 bridge 后端同步过成员的群可用）。',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string' },
        conversationId: { type: 'string' },
      },
      required: ['accountId', 'conversationId'],
    },
  },
  {
    name: 'wechat_list_auto_reply_rules',
    description: '列出指定账号的自动回复规则与启用状态。',
    inputSchema: {
      type: 'object',
      properties: { accountId: { type: 'string' } },
      required: ['accountId'],
    },
  },
  {
    name: 'wechat_get_digest_schedule',
    description: '读取指定账号的日报计划（启用状态/执行时间/推送目标/上次结果）。',
    inputSchema: {
      type: 'object',
      properties: { accountId: { type: 'string' } },
      required: ['accountId'],
    },
  },
  {
    name: 'wechat_sync_contacts',
    description: '从桥同步联系人到本地（仅 bridge 后端，iLink 返回 unsupported）。',
    inputSchema: {
      type: 'object',
      properties: { accountId: { type: 'string' } },
      required: ['accountId'],
    },
  },
  {
    name: 'wechat_group_action',
    description: '群管理：create/invite/kick/rename/announce（仅 bridge 后端）。',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string' },
        action: { type: 'string', enum: ['create', 'invite', 'kick', 'rename', 'announce'] },
        conversationId: { type: 'string' },
        memberIds: { type: 'array', items: { type: 'string' } },
        title: { type: 'string' },
        text: { type: 'string' },
      },
      required: ['accountId', 'action'],
    },
  },
  {
    name: 'wechat_publish_moment',
    description: '发布朋友圈（仅 bridge 后端；iLink 返回 unsupported）。',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string' },
        text: { type: 'string' },
        mediaUrls: { type: 'array', items: { type: 'string' } },
      },
      required: ['accountId', 'text'],
    },
  },
  {
    name: 'wechat_broadcast',
    description: '按目标/标签/全部联系人群发；逐条走出站策略，单次上限 100。',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string' },
        text: { type: 'string' },
        mediaUrl: { type: 'string' },
        kind: { type: 'string', enum: ['text', 'image', 'file', 'link', 'card'] },
        targets: { type: 'array', items: { type: 'string' } },
        tags: { type: 'array', items: { type: 'string' } },
        includeBlocked: { type: 'boolean' },
        dryRun: { type: 'boolean' },
      },
      required: ['accountId'],
    },
  },
  {
    name: 'wechat_knowledge_search',
    description: '在指定账号的知识库里做语义/关键词检索。',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string' },
        query: { type: 'string' },
        topK: { type: 'number', minimum: 1, maximum: 20 },
      },
      required: ['accountId', 'query'],
    },
  },
]

function readArg(args: Record<string, unknown>, key: string): string {
  const value = args[key]
  if (typeof value !== 'string' || value.length === 0) {
    throw new AppError(`MCP 参数缺失：${key}`, 400, 'WECHAT_MCP_ARGUMENT_MISSING')
  }
  return value
}

function readOptionalNumber(
  args: Record<string, unknown>,
  key: string,
  fallback: number,
  max: number,
): number {
  const value = args[key]
  if (value === undefined) return fallback
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) {
    throw new AppError(`MCP 参数非法：${key}`, 400, 'WECHAT_MCP_ARGUMENT_INVALID')
  }
  return Math.min(Math.max(Math.trunc(number), 1), max)
}

function readOptionalStringArray(
  args: Record<string, unknown>,
  key: string,
  max: number,
): string[] | undefined {
  const value = args[key]
  if (value === undefined) return undefined
  if (!Array.isArray(value)) {
    throw new AppError(`MCP 参数非法：${key}`, 400, 'WECHAT_MCP_ARGUMENT_INVALID')
  }
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .slice(0, max)
}

export const wechatHubRoutes: FastifyPluginAsync = async (server) => {
  wechatHubManager.startSchedulers()

  server.get('/wechat-hub/capabilities', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    return reply.send(success(wechatHubManager.getCapabilities()))
  })

  server.get('/wechat-hub/accounts', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    try {
      return reply.send(success(await wechatHubManager.listAccounts(requireUserId(request))))
    } catch (e) {
      return answerError(reply, e)
    }
  })

  server.post('/wechat-hub/accounts', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    try {
      const input = parseOrThrow(createAccountSchema, request.body)
      return reply
        .status(201)
        .send(success(await wechatHubManager.createAccount(requireUserId(request), input)))
    } catch (e) {
      return answerError(reply, e)
    }
  })

  server.delete<{ Params: { id: string } }>('/wechat-hub/accounts/:id', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    try {
      await wechatHubManager.deleteAccount(requireUserId(request), request.params.id)
      return reply.send(success({ deleted: true }))
    } catch (e) {
      return answerError(reply, e)
    }
  })

  server.post<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/connect',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        await wechatHubManager.connectAccount(requireUserId(request), request.params.id)
        return reply.send(success({ connected: true }))
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.post<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/disconnect',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        await wechatHubManager.disconnectAccount(requireUserId(request), request.params.id)
        return reply.send(success({ disconnected: true }))
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.get<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/status',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        return reply.send(
          success(await wechatHubManager.getStatus(requireUserId(request), request.params.id)),
        )
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.get<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/qrcode',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        return reply.send(
          success(await wechatHubManager.getQrCode(requireUserId(request), request.params.id)),
        )
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.patch<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/settings',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        const patch = parseOrThrow(settingsSchema, request.body)
        return reply.send(
          success(
            await wechatHubManager.updateSettings(requireUserId(request), request.params.id, patch),
          ),
        )
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.get<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/conversations',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        const query = parseOrThrow(limitQuerySchema, request.query)
        return reply.send(
          success(
            await wechatHubManager.listConversations(
              requireUserId(request),
              request.params.id,
              query.limit,
            ),
          ),
        )
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.get<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/messages',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        const query = parseOrThrow(messagesQuerySchema, request.query)
        return reply.send(
          success(
            await wechatHubManager.listMessages(
              requireUserId(request),
              request.params.id,
              query.conversationId ?? null,
              query.limit,
              query.before ? new Date(query.before) : null,
            ),
          ),
        )
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.get<{ Params: { id: string } }>(
    '/wechat-hub/accounts/:id/actions',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      try {
        const query = parseOrThrow(limitQuerySchema, request.query)
        return reply.send(
          success(
            await wechatHubManager.listActions(
              requireUserId(request),
              request.params.id,
              query.limit,
            ),
          ),
        )
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )

  server.post('/wechat-hub/send', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    try {
      const input = parseOrThrow(sendSchema, request.body)
      return reply.send(success(await wechatHubManager.send(requireUserId(request), input)))
    } catch (e) {
      return answerError(reply, e)
    }
  })

  server.post('/wechat-hub/analyze', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    try {
      const input = parseOrThrow(analyzeSchema, request.body)
      return reply.send(success(await wechatHubManager.analyze(requireUserId(request), input)))
    } catch (e) {
      return answerError(reply, e)
    }
  })

  server.get('/wechat-hub/mcp/tools', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    return reply.send(success(MCP_TOOLS))
  })

  server.post('/wechat-hub/mcp/call', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    try {
      const body = parseOrThrow(mcpCallSchema, request.body)
      const userId = requireUserId(request)
      const args = body.arguments ?? {}
      switch (body.name) {
        case 'wechat_list_accounts':
          return reply.send(success(await wechatHubManager.listAccounts(userId)))
        case 'wechat_list_conversations': {
          const accountId = readArg(args, 'accountId')
          return reply.send(
            success(
              await wechatHubManager.listConversations(
                userId,
                accountId,
                readOptionalNumber(args, 'limit', 50, 200),
              ),
            ),
          )
        }
        case 'wechat_get_messages': {
          const accountId = readArg(args, 'accountId')
          const conversationId =
            typeof args.conversationId === 'string' ? args.conversationId : null
          return reply.send(
            success(
              await wechatHubManager.listMessages(
                userId,
                accountId,
                conversationId,
                readOptionalNumber(args, 'limit', 50, 200),
              ),
            ),
          )
        }
        case 'wechat_search_messages': {
          const accountId = readArg(args, 'accountId')
          return reply.send(
            success(
              await wechatHubManager.searchMessages(
                userId,
                accountId,
                readArg(args, 'query'),
                readOptionalNumber(args, 'limit', 20, 100),
              ),
            ),
          )
        }
        case 'wechat_send_text': {
          const accountId = readArg(args, 'accountId')
          return reply.send(
            success(
              await wechatHubManager.send(userId, {
                accountId,
                target: readArg(args, 'target'),
                text: readArg(args, 'text'),
                kind: 'text',
                dryRun: args.dryRun === true,
              }),
            ),
          )
        }
        case 'wechat_analyze': {
          const accountId = readArg(args, 'accountId')
          const kind = parseOrThrow(analysisKindSchema, readArg(args, 'kind'))
          const conversationId =
            typeof args.conversationId === 'string' ? args.conversationId : undefined
          return reply.send(
            success(
              await wechatHubManager.analyze(userId, {
                accountId,
                conversationId,
                kind,
                limit: readOptionalNumber(args, 'limit', 200, 1000),
                force: args.force === true,
              }),
            ),
          )
        }
        case 'wechat_daily_digest': {
          const accountId = readArg(args, 'accountId')
          return reply.send(
            success(
              await wechatHubManager.analyze(userId, {
                accountId,
                kind: 'daily',
                limit: readOptionalNumber(args, 'limit', 500, 1000),
              }),
            ),
          )
        }
        case 'wechat_list_actions': {
          const accountId = readArg(args, 'accountId')
          return reply.send(
            success(
              await wechatHubManager.listActions(
                userId,
                accountId,
                readOptionalNumber(args, 'limit', 100, 200),
              ),
            ),
          )
        }
        case 'wechat_list_contacts': {
          const accountId = readArg(args, 'accountId')
          const query = typeof args.query === 'string' ? args.query : ''
          return reply.send(success(await listContacts(userId, accountId, query)))
        }
        case 'wechat_list_group_members': {
          const accountId = readArg(args, 'accountId')
          const conversationId = readArg(args, 'conversationId')
          return reply.send(success(await listGroupMembers(userId, accountId, conversationId)))
        }
        case 'wechat_list_auto_reply_rules': {
          const accountId = readArg(args, 'accountId')
          return reply.send(success(await listRules(userId, accountId)))
        }
        case 'wechat_get_digest_schedule': {
          const accountId = readArg(args, 'accountId')
          return reply.send(success(await getSchedule(userId, accountId)))
        }
        case 'wechat_sync_contacts': {
          const accountId = readArg(args, 'accountId')
          return reply.send(success(await syncContacts(userId, accountId)))
        }
        case 'wechat_group_action': {
          const accountId = readArg(args, 'accountId')
          const action = parseOrThrow(groupActionNameSchema, readArg(args, 'action'))
          const memberIds = readOptionalStringArray(args, 'memberIds', 50)
          return reply.send(
            success(
              await runGroupAction(userId, accountId, {
                action,
                conversationId:
                  typeof args.conversationId === 'string' ? args.conversationId : undefined,
                memberIds,
                title: typeof args.title === 'string' ? args.title : undefined,
                text: typeof args.text === 'string' ? args.text : undefined,
              }),
            ),
          )
        }
        case 'wechat_publish_moment': {
          const accountId = readArg(args, 'accountId')
          return reply.send(
            success(
              await publishMoment(userId, accountId, {
                text: readArg(args, 'text'),
                mediaUrls: readOptionalStringArray(args, 'mediaUrls', 9),
              }),
            ),
          )
        }
        case 'wechat_broadcast': {
          const accountId = readArg(args, 'accountId')
          const kind =
            typeof args.kind === 'string' ? parseOrThrow(broadcastKindSchema, args.kind) : undefined
          const result = await broadcast(userId, {
            accountId,
            kind,
            text: typeof args.text === 'string' ? args.text : undefined,
            mediaUrl: typeof args.mediaUrl === 'string' ? args.mediaUrl : undefined,
            targets: readOptionalStringArray(args, 'targets', 100),
            tags: readOptionalStringArray(args, 'tags', 20),
            includeBlocked: args.includeBlocked === true,
            dryRun: args.dryRun === true,
          })
          return reply.send(success(result))
        }
        case 'wechat_knowledge_search': {
          const accountId = readArg(args, 'accountId')
          return reply.send(
            success(
              await searchKnowledge(
                userId,
                accountId,
                readArg(args, 'query'),
                readOptionalNumber(args, 'topK', 5, 20),
              ),
            ),
          )
        }
        default:
          throw new AppError(`未知 MCP 工具：${body.name}`, 404, 'WECHAT_MCP_TOOL_UNKNOWN')
      }
    } catch (e) {
      return answerError(reply, e)
    }
  })

  server.post<{ Params: { accountId: string } }>(
    '/wechat-hub/webhook/:accountId',
    async (request, reply) => {
      try {
        const headerSecret =
          (typeof request.headers['x-wechat-hub-secret'] === 'string'
            ? request.headers['x-wechat-hub-secret']
            : null) ??
          (request.headers.authorization?.startsWith('Bearer ')
            ? request.headers.authorization.slice(7)
            : null)
        const accepted = await wechatHubManager.handleBridgeWebhook(
          request.params.accountId,
          request.body,
          headerSecret,
        )
        return reply.send(success({ accepted }))
      } catch (e) {
        return answerError(reply, e)
      }
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
