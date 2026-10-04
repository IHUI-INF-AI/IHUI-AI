// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 导入会话 → 知识库路由(2026-10-03 立,"导入的会话进知识库、可被 RAG 检索"那一层)。
 *
 * 背景:会话导入管道(/conversation-import/parse + /commit)只把内容落进
 * chat_conversations + chat_messages;而知识库入库路径(ingestText / ingestFile)
 * 只认文件与纯文本 ⇒ 用户导一批微信群聊记录进来,这些内容躺在会话表里,
 * `knowledgeRagService.search`(聊天主链路 loadKnowledgeContext 每轮都调)永远召不回,
 * 等于一堆死文字。本路由补这条缺口。
 *
 * 形态选型:**(b) 显式按钮**(导入结果区每个会话一个「加入知识库」),不选 (a) 导入完成自动入库。
 * 理由:知识库入库要走 embedding,每条 chunk 都是真金白银的 API 调用与向量存储;
 * 群聊记录里大量是寒暄/表情/无关闲聊,用户并不一定想让整批进知识库。让用户逐条显式选择,
 * 是对成本与检索噪声都诚实的做法。服务端只提供能力与留痕,不替用户做这个决定。
 *
 * 端点(注册前缀 /api/user):
 *   - POST /conversation-import/to-knowledge   单个会话入库(主出口,幂等)
 *   - GET  /conversation-import/knowledge-status  查询会话的入库状态(可查/可重试)
 *
 * 失败诚实:入库失败**必写 conversation_imports 留痕**(status='failed' + errorMessage),
 * 且响应非 200。理由与 /commit 同源 —— status 三态若只有 success 可达,前端失败徽标
 * 就是死 UI,而"点了按钮不知道成没成"比"明确失败"更糟。
 * 幂等:靠 knowledge_doc.content_hash 查重(该列无唯一索引,须显式先查后写),
 * 重复点同一会话返回既有 doc 且 deduped=true,不产生第二批重复 chunk。
 *
 * 既有端点契约零改动:本文件是**新增路由文件**,conversation-import.ts 的
 * parse / commit / history 三端点一字未动。
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { chatConversations, chatMessages, conversationImports } from '@ihui/database'

import { db } from '../db/index.js'
import { authenticate } from '../plugins/auth.js'
import { knowledgeRagService } from '../services/knowledge-rag-service.js'
import { success, error } from '../utils/response.js'

// =============================================================================
// Schemas
// =============================================================================

const toKnowledgeSchema = z.object({
  // chat_conversations.id / chat_messages.conversation_id 都是 uuid 列：本路由下面两处
  // eq() 直接吃这个值,非 uuid 串让 Postgres 抛 22P02 ⇒ 500。原只校验 min(1).max(64),漏掉格式。
  conversationId: z.uuid({ error: 'conversationId 格式不正确' }),
  /** 可选知识库集合名,默认 default(与 /api/knowledge 各端点同口径) */
  collectionName: z.string().min(1).max(100).default('default'),
})

// =============================================================================
// Route
// =============================================================================

export const conversationKnowledgeRoutes: FastifyPluginAsync = async (server) => {
  // 与 conversation-import 同款:所有路由要求登录
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      return reply.status(statusCode).send(error(statusCode, (e as Error).message || '需要登录'))
    }
  })

  // -------------------------------------------------------------------------
  // POST /conversation-import/to-knowledge — 单会话入库(幂等)
  // -------------------------------------------------------------------------
  server.post('/conversation-import/to-knowledge', async (request, reply) => {
    const userId = request.userId!
    const parsed = toKnowledgeSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { conversationId, collectionName } = parsed.data

    // 属主校验:只允许把**自己**的会话入库。
    // 不校验就是 IDOR —— 任何人拿别人的 conversationId 就能把别人的私聊/群聊
    // 灌进自己的知识库,再经 RAG 检索把内容读出来。
    const convRows = await db
      .select({
        id: chatConversations.id,
        title: chatConversations.title,
        userId: chatConversations.userId,
        metadata: chatConversations.metadata,
      })
      .from(chatConversations)
      .where(eq(chatConversations.id, conversationId))
      .limit(1)
    const conv = convRows[0]
    if (!conv || conv.userId !== userId) {
      return reply.status(404).send(error(404, '会话不存在或无权访问'))
    }

    // 取消息(按时间升序;turn_ordinal 为 D35 补的轮次序号,created_at 同毫秒时用它定序)
    const messages = await db
      .select({
        role: chatMessages.role,
        content: chatMessages.content,
        createdAt: chatMessages.createdAt,
        turnOrdinal: chatMessages.turnOrdinal,
      })
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .orderBy(chatMessages.createdAt, chatMessages.turnOrdinal)

    if (messages.length === 0) {
      return reply.status(400).send(error(400, '该会话没有可入库的消息'))
    }

    // 从会话 metadata 取原始导入来源(拿不到就标 unknown,不影响入库)
    const meta = (conv.metadata ?? {}) as Record<string, unknown>
    const source = typeof meta.importedFrom === 'string' ? meta.importedFrom : 'unknown'

    try {
      const result = await knowledgeRagService.ingestConversation({
        ownerUuid: userId,
        conversationId,
        title: conv.title?.trim() || '导入会话',
        source,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        })),
        collectionName,
      })

      if (result.chunkCount === 0) {
        // 消息全空(理论上前面已挡 messages.length===0,这里是转录后为空的兜底)
        return reply.status(400).send(error(400, '会话内容为空,无法入库'))
      }

      // 留痕:成功也写一条批次记录,让「这个会话进没进知识库」在导入历史里查得到。
      // source 用 'knowledge_ingest' 与五种导入来源区分(varchar(32) 容得下,无需迁移)。
      try {
        await db.insert(conversationImports).values({
          id: crypto.randomUUID(),
          ownerUuid: userId,
          source: 'knowledge_ingest',
          conversationId,
          fileName: null,
          parsedCount: messages.length,
          importedCount: result.chunkCount,
          failedCount: 0,
          status: 'success',
          errorMessage: null,
        })
      } catch (err) {
        // 留痕失败不阻塞交付(与 /commit 同语义):知识已经入库了,
        // 查不到历史不该让用户以为入库失败而反复重试(重试是幂等的,但徒增 embedding 成本)
        request.log.error({ err, conversationId }, '[conversation-knowledge] ingest trail failed')
      }

      request.log.info(
        {
          userId,
          conversationId,
          docId: result.docId,
          chunkCount: result.chunkCount,
          deduped: result.deduped,
        },
        '[conversation-knowledge] ingest done',
      )
      return reply.send(
        success({
          conversationId,
          docId: result.docId,
          chunkCount: result.chunkCount,
          deduped: result.deduped,
        }),
      )
    } catch (err) {
      request.log.error({ err, userId, conversationId }, '[conversation-knowledge] ingest failed')
      // 失败必须留痕:否则用户点了按钮、页面报错、导入历史里查不到任何痕迹,
      // status 的 failed 态永不可达 —— 这正是"静默失败"的形态。
      try {
        await db.insert(conversationImports).values({
          id: crypto.randomUUID(),
          ownerUuid: userId,
          source: 'knowledge_ingest',
          conversationId,
          fileName: null,
          parsedCount: messages.length,
          importedCount: 0,
          failedCount: messages.length,
          status: 'failed',
          errorMessage: `${(err as Error).message}`.slice(0, 500),
        })
      } catch (trailErr) {
        request.log.error(
          { err: trailErr, conversationId },
          '[conversation-knowledge] failed to write failure trail',
        )
      }
      return reply.status(500).send(error(500, `加入知识库失败: ${(err as Error).message}`))
    }
  })

  // -------------------------------------------------------------------------
  // GET /conversation-import/knowledge-status — 查入库状态(可查/可重试的凭据)
  // -------------------------------------------------------------------------
  server.get('/conversation-import/knowledge-status', async (request, reply) => {
    const userId = request.userId!
    const q = (request.query as { conversationId?: string }) ?? {}
    const conversationId = q.conversationId ?? ''
    if (!conversationId) {
      return reply.status(400).send(error(400, '缺少 conversationId'))
    }

    // 属主校验同 POST:状态也是私有信息,不能让他人探知
    const convRows = await db
      .select({ id: chatConversations.id, userId: chatConversations.userId })
      .from(chatConversations)
      .where(eq(chatConversations.id, conversationId))
      .limit(1)
    if (!convRows[0] || convRows[0].userId !== userId) {
      return reply.status(404).send(error(404, '会话不存在或无权访问'))
    }

    // 找该会话最近一次入库留痕(success 优先,否则取最近一条,含失败)
    const trails = await db
      .select({
        id: conversationImports.id,
        status: conversationImports.status,
        errorMessage: conversationImports.errorMessage,
        importedCount: conversationImports.importedCount,
        importedAt: conversationImports.importedAt,
      })
      .from(conversationImports)
      .where(
        and(
          eq(conversationImports.ownerUuid, userId),
          eq(conversationImports.conversationId, conversationId),
          eq(conversationImports.source, 'knowledge_ingest'),
        ),
      )
      .orderBy(conversationImports.importedAt)

    const latest = trails[trails.length - 1] ?? null
    return reply.send(
      success({
        conversationId,
        ingested: latest?.status === 'success',
        status: latest?.status ?? 'none',
        chunkCount: latest?.importedCount ?? 0,
        errorMessage: latest?.errorMessage ?? null,
        importedAt: latest ? latest.importedAt.toISOString() : null,
      }),
    )
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
