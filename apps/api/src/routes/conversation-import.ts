// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 外部会话导入路由(D28,2026-09-20 立)
 *
 * 3 个端点:
 *   1. POST /conversation-import/parse    multipart 上传会话导出文件,转发 ai-service 解析
 *   2. POST /conversation-import/commit   逐会话落库(chat_conversations + chat_messages) + 写批次记录
 *   3. GET  /conversation-import/history  当前用户的导入历史
 *
 * 数据流(迁入即用):
 *   web 上传文件 → /parse 转发 ai-service 解析(api 原样透传响应 JSON)
 *   → web 预览 → 逐会话调 /commit → 落 chat_conversations/chat_messages(保留原始时间戳)
 *   → 写 conversation_imports 批次记录 → 用户聊天侧栏立即可见新会话
 *
 * 设计要点:
 * - 所有端点都要求登录(preHandler authenticate)
 * - /parse 只做转发:重建 multipart 原样传给 ai-service,不手动设置 Content-Type
 *   (保留 fetch 自动生成的 boundary),Authorization 由 aiServiceFetch 自动透传
 * - /commit 无服务端 preview 缓存:web 持有 /parse 的解析结果,逐会话直接提交
 * - 原始时间戳保留:会话/消息的 createdAt 缺省或非法时回退导入时刻
 * - 会话 + 消息在同一事务写入,消息写入失败整体回滚,避免侧栏出现空会话
 * - 批次记录写入失败不阻塞交付(仅记日志,与 cli-import 同语义)
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { chatConversations, chatMessages, conversationImports } from '@ihui/database'

import { db } from '../db/index.js'
import { authenticate } from '../plugins/auth.js'
import { withTurnOrdinals } from '../services/turn-ordinal.js'
import { success, error } from '../utils/response.js'
import { aiServiceFetch } from '../utils/ai-service-fetch.js'

// =============================================================================
// Schemas
// =============================================================================

/** 外部工具来源枚举 */
const importSourceSchema = z.enum(['claude_code', 'codex', 'cursor', 'aider'])

/** 单条待导入消息(时间戳为 ISO 字符串,宽松校验,落库前统一解析) */
const importedMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(1_000_000),
  reasoning: z.string().max(1_000_000).optional(),
  createdAt: z.string().min(1).max(64).optional(),
  tokens: z.number().int().nonnegative().max(10_000_000).optional(),
})

const commitSchema = z.object({
  source: importSourceSchema,
  fileName: z.string().min(1).max(500).optional(),
  title: z.string().min(1).max(255).optional(),
  model: z.string().min(1).max(64).optional(),
  createdAt: z.string().min(1).max(64).optional(),
  messages: z.array(importedMessageSchema).min(1).max(2000),
})

// =============================================================================
// Helpers
// =============================================================================

/**
 * 解析外部导出的时间戳;缺省或非法时回退 fallback(导入时刻/会话时间)。
 */
function parseTimestamp(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? fallback : d
}

// =============================================================================
// Route
// =============================================================================

/** /commit 路由级请求体上限,与 ai-service 侧上传上限一致(全局 bodyLimit 是 10MiB) */
const COMMIT_BODY_LIMIT_BYTES = 20 * 1024 * 1024

export const conversationImportRoutes: FastifyPluginAsync = async (server) => {
  // 所有路由要求登录
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      // 必须 return reply,防止 handler 在未认证时继续执行
      return reply.status(statusCode).send(error(statusCode, (e as Error).message || '需要登录'))
    }
  })

  // -------------------------------------------------------------------------
  // 1. POST /conversation-import/parse — 转发 ai-service 解析
  // -------------------------------------------------------------------------
  server.post('/conversation-import/parse', async (request, reply) => {
    const userId = request.userId!

    // 原样收集 multipart 各部分,重建 FormData 转发(字段 + 文件透传,解析逻辑在 ai-service)
    const formData = new FormData()
    let hasFile = false
    try {
      for await (const part of request.parts()) {
        if (part.type === 'file') {
          const buffer = await part.toBuffer()
          formData.append(part.fieldname, new Blob([new Uint8Array(buffer)]), part.filename)
          hasFile = true
        } else {
          formData.append(part.fieldname, String(await part.value))
        }
      }
    } catch (err) {
      request.log.warn({ err, userId }, '[conversation-import] parse upload read failed')
      return reply.status(400).send(error(400, `上传文件读取失败: ${(err as Error).message}`))
    }

    if (!hasFile) {
      return reply.status(400).send(error(400, '缺少上传的会话导出文件'))
    }

    try {
      // 不手动设置 Content-Type:FormData 需 fetch 自动生成带 boundary 的头
      const resp = await aiServiceFetch(request, '/api/session-import/parse', {
        method: 'POST',
        body: formData,
      })
      // 原样透传 ai-service 响应(状态码 + body + content-type)
      const text = await resp.text()
      const contentType = resp.headers.get('content-type')
      if (contentType) {
        reply.type(contentType)
      } else {
        reply.type('application/json; charset=utf-8')
      }
      return reply.status(resp.status).send(text)
    } catch (err) {
      request.log.error({ err, userId }, '[conversation-import] parse forward failed')
      return reply.status(502).send(error(502, '解析服务暂不可用,请稍后重试'))
    }
  })

  // -------------------------------------------------------------------------
  // 2. POST /conversation-import/commit — 逐会话落库 + 写批次记录
  // -------------------------------------------------------------------------
  server.post(
    '/conversation-import/commit',
    // 单会话 JSON 体可达数 MB(ai-service 侧按 20MiB 上传上限解析,但只按字符数收口),
    // 全局 bodyLimit 10MiB 会让大会话直接 413 且前端只显示"导入失败",故为本路由放宽。
    { bodyLimit: COMMIT_BODY_LIMIT_BYTES },
    async (request, reply) => {
      const userId = request.userId!
      const parsed = commitSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const data = parsed.data
      const importId = crypto.randomUUID()

      // 保留原始时间戳:会话/消息时间缺省或非法时回退导入时刻
      const now = new Date()
      const conversationCreatedAt = parseTimestamp(data.createdAt, now)
      const messageTimestamps = data.messages.map((m) =>
        parseTimestamp(m.createdAt, conversationCreatedAt),
      )
      const lastMessageAt = messageTimestamps.reduce(
        (acc, d) => (d > acc ? d : acc),
        conversationCreatedAt,
      )

      try {
        const conversationId = await db.transaction(async (tx) => {
          const [conversation] = await tx
            .insert(chatConversations)
            .values({
              userId,
              title: data.title ?? '新对话',
              model: data.model ?? 'gpt-4o-mini',
              metadata: {
                importedFrom: data.source,
                importedVia: 'conversation-import',
                fileName: data.fileName ?? null,
              },
              createdAt: conversationCreatedAt,
              updatedAt: now,
              lastMessageAt,
            })
            .returning({ id: chatConversations.id })
          if (!conversation) throw new Error('会话创建失败')

          // D35(2026-09-26 第二段):导入的会话必须带 turn 序号落库 —— 本路径绕过
          // chat-queries 直插,不补就是 NULL,而 turn 分片端点对 NULL 行不可见,
          // 用户侧表现是"导入成功的会话翻不到历史"且全程无报错。
          // 规则取 services/turn-ordinal 唯一出口(按提交数组顺序,user 开启新轮)。
          const orderedMessages = withTurnOrdinals(data.messages)
          await tx.insert(chatMessages).values(
            orderedMessages.map((m, i) => ({
              conversationId: conversation.id,
              role: m.role,
              content: m.content,
              reasoning: m.reasoning ?? null,
              tokens: m.tokens ?? null,
              // 原始时间戳(缺省回退会话创建时间)
              createdAt: messageTimestamps[i]!,
              turnOrdinal: m.turnOrdinal,
            })),
          )
          return conversation.id
        })

        // 写导入批次记录(失败不阻塞交付,与 cli-import 同语义)
        try {
          await db.insert(conversationImports).values({
            id: importId,
            ownerUuid: userId,
            source: data.source,
            conversationId,
            fileName: data.fileName ?? null,
            parsedCount: data.messages.length,
            importedCount: data.messages.length,
            failedCount: 0,
            status: 'success',
            errorMessage: null,
          })
        } catch (err) {
          request.log.error({ err, importId }, '[conversation-import] failed to write history')
        }

        request.log.info(
          { userId, importId, source: data.source, conversationId, count: data.messages.length },
          '[conversation-import] commit done',
        )
        return reply
          .status(201)
          .send(success({ importId, conversationId, importedMessages: data.messages.length }))
      } catch (err) {
        request.log.error(
          { err, userId, source: data.source },
          '[conversation-import] commit failed',
        )
        // 失败也必须留痕:否则 conversation_imports.status 的 partial|failed 两态永不可达,
        // 而 web / CLI / mobile-rn 三端都在渲染失败徽标 —— 不留痕就是死 UI。
        try {
          await db.insert(conversationImports).values({
            id: importId,
            ownerUuid: userId,
            source: data.source,
            conversationId: null,
            fileName: data.fileName ?? null,
            parsedCount: data.messages.length,
            importedCount: 0,
            failedCount: data.messages.length,
            status: 'failed',
            errorMessage: `${(err as Error).message}`.slice(0, 500),
          })
        } catch (historyErr) {
          request.log.error(
            { err: historyErr, importId },
            '[conversation-import] failed to write failure history',
          )
        }
        return reply.status(500).send(error(500, `导入落库失败: ${(err as Error).message}`))
      }
    },
  )

  // -------------------------------------------------------------------------
  // 3. GET /conversation-import/history — 用户导入历史
  // -------------------------------------------------------------------------
  server.get('/conversation-import/history', async (request, reply) => {
    const userId = request.userId!
    const limit = 50
    const rows = await db
      .select({
        id: conversationImports.id,
        source: conversationImports.source,
        conversationId: conversationImports.conversationId,
        fileName: conversationImports.fileName,
        parsedCount: conversationImports.parsedCount,
        importedCount: conversationImports.importedCount,
        failedCount: conversationImports.failedCount,
        status: conversationImports.status,
        errorMessage: conversationImports.errorMessage,
        importedAt: conversationImports.importedAt,
      })
      .from(conversationImports)
      .where(eq(conversationImports.ownerUuid, userId))
      .orderBy(desc(conversationImports.importedAt))
      .limit(limit)

    return reply.send(
      success({
        list: rows.map((r) => ({
          id: r.id,
          source: r.source,
          conversationId: r.conversationId,
          fileName: r.fileName,
          parsedCount: r.parsedCount,
          importedCount: r.importedCount,
          failedCount: r.failedCount,
          status: r.status,
          errorMessage: r.errorMessage,
          importedAt: r.importedAt.toISOString(),
        })),
        total: rows.length,
      }),
    )
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
