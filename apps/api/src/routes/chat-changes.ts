// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 按轮变更集 / 流式投影读面(批次 4,2026-11-06 立)。
 *
 * 为什么单独开一个路由文件而不是塞进 chat.ts:chat.ts 是并行工作流面(多端同步/协作都在改),
 * 变更集是**与对话正文正交**的一张台账 —— 独立文件把冲突面降到零,注册点与 chat-resume 同族。
 *
 * 为什么列表/明细走 `dbRead`、投影与归属判据走主池 `db`:前两者是历史台账,可容忍副本延迟
 * (大量重试/续流会反复读,走副本可卸主库压力);后两者要回答"刚刚这一轮",副本滞后会把
 * "刚写完"误报成"不存在/还没结束",属于判据面,不能用副本。
 *
 * 为什么回滚只做代理、不在网关落盘:回滚要校验"文件还停在这一轮结束时的样子"(sha256),
 * 并在文件系统上做 resolve + 越界拒绝 —— 这两个前提只有 ai-service(持有 workspace_root
 * 与快照)能判定。网关先做**会话归属**再转发,是为了不把别人的 changeSet id 透给上游去试。
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { and, desc, eq } from 'drizzle-orm'
import {
  chatConversations,
  chatMessageProjections,
  chatTurnChangeFiles,
  chatTurnChangeSets,
} from '@ihui/database'
import { checkAuth } from '../plugins/auth.js'
import { db, dbRead } from '../db/index.js'
import { aiServiceFetch } from '../utils/ai-service-fetch.js'
import { error, success } from '../utils/response.js'
import { isUuidString } from '../utils/uuid.js'

/** 变更集列表/详情的对外形态(与 web/mobile 共用的 wire 契约,字段名保持 camel) */
interface ChangeSetWire {
  id: string
  conversationId: string
  turnId: string
  status: string
  fileCount: number
  additions: number
  deletions: number
  rewindStatus: string
  createdAt: Date
  updatedAt: Date
}

function serializeChangeSet(row: {
  id: string
  conversationId: string
  turnId: string
  status: string
  fileCount: number
  additions: number
  deletions: number
  rewindStatus: string
  createdAt: Date
  updatedAt: Date
}): ChangeSetWire {
  return {
    id: row.id,
    conversationId: row.conversationId,
    turnId: row.turnId,
    status: row.status,
    fileCount: row.fileCount,
    additions: row.additions,
    deletions: row.deletions,
    rewindStatus: row.rewindStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/**
 * 归属判据:change set 必须属于「当前用户名下的会话」。
 *
 * 为什么同时比 `chat_conversations.user_id` 与 `chat_turn_change_sets.user_id`:
 * 后者是写入时落的口径(理论上与前者一致),但两列是独立写入的;B 端只信其中一列,
 * 一旦某一列被历史脚本写偏,就会变成越权读。两列同时成立才放行,是这条读面**唯一**的
 * 放行条件 —— 任一不成立一律 404(不区分"不存在"与"不是你的",避免 id 枚举)。
 */
async function findOwnedChangeSet(
  userId: string,
  changeSetId: string,
): Promise<ChangeSetWire | null> {
  // 归属判据走主池(不是只读副本):回滚是"刚结束的这一轮"之后的动作,
  // 变更集行可能还在复制延迟窗口里;在副本上判"不存在"会让用户刚看到 diff 就 404。
  const rows = await db
    .select({
      id: chatTurnChangeSets.id,
      conversationId: chatTurnChangeSets.conversationId,
      turnId: chatTurnChangeSets.turnId,
      status: chatTurnChangeSets.status,
      fileCount: chatTurnChangeSets.fileCount,
      additions: chatTurnChangeSets.additions,
      deletions: chatTurnChangeSets.deletions,
      rewindStatus: chatTurnChangeSets.rewindStatus,
      createdAt: chatTurnChangeSets.createdAt,
      updatedAt: chatTurnChangeSets.updatedAt,
    })
    .from(chatTurnChangeSets)
    .innerJoin(chatConversations, eq(chatConversations.id, chatTurnChangeSets.conversationId))
    .where(
      and(
        eq(chatTurnChangeSets.id, changeSetId),
        eq(chatTurnChangeSets.userId, userId),
        eq(chatConversations.userId, userId),
      ),
    )
    .limit(1)
  const row = rows[0]
  return row ? serializeChangeSet(row) : null
}

const listQuerySchema = z.object({
  conversationId: z.string().min(1),
  turnId: z.string().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

const changeSetParamsSchema = z.object({
  changeSetId: z.string().min(1),
})

const rewindBodySchema = z.object({
  dryRun: z.boolean(),
})

const projectionQuerySchema = z.object({
  conversationId: z.string().min(1),
  messageId: z.string().min(1).max(64),
})

export const chatChangesRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
  })

  // GET /api/chat/changes?conversationId=&turnId=&limit=
  server.get('/changes', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { conversationId, turnId, limit } = parsed.data
    // 形状闸放在进 SQL 之前:uuid 列收到非 uuid 串会抛 22P02,那会把"不存在"变成 500。
    if (!isUuidString(conversationId)) {
      return reply.status(400).send(error(400, '无效的对话 ID'))
    }

    // 归属校验与列表查询合成一条 JOIN:非本人会话 join 不出行 ⇒ 空列表,
    // 不做"先判归属再查"的两步,以免两次查询之间会话被删/转移时给出一份越权结果。
    const rows = await dbRead
      .select({
        id: chatTurnChangeSets.id,
        conversationId: chatTurnChangeSets.conversationId,
        turnId: chatTurnChangeSets.turnId,
        status: chatTurnChangeSets.status,
        fileCount: chatTurnChangeSets.fileCount,
        additions: chatTurnChangeSets.additions,
        deletions: chatTurnChangeSets.deletions,
        rewindStatus: chatTurnChangeSets.rewindStatus,
        createdAt: chatTurnChangeSets.createdAt,
        updatedAt: chatTurnChangeSets.updatedAt,
      })
      .from(chatTurnChangeSets)
      .innerJoin(chatConversations, eq(chatConversations.id, chatTurnChangeSets.conversationId))
      .where(
        and(
          eq(chatTurnChangeSets.conversationId, conversationId),
          eq(chatTurnChangeSets.userId, request.userId!),
          eq(chatConversations.userId, request.userId!),
          ...(turnId ? [eq(chatTurnChangeSets.turnId, turnId)] : []),
        ),
      )
      .orderBy(desc(chatTurnChangeSets.createdAt))
      .limit(limit)

    return reply.send(success({ items: rows.map(serializeChangeSet) }))
  })

  // GET /api/chat/changes/projections?conversationId=&messageId=
  // 断线/崩溃后客户端据此恢复服务端已观测到的部分正文(投影是网关侧事实,不等于已落库)。
  // 注意:必须注册在 /changes/:changeSetId 之前语义上无冲突(find-my-way 静态段优先),
  // 但代码顺序也按静态段在前,免得未来替换路由实现时踩坑。
  server.get('/changes/projections', async (request, reply) => {
    const parsed = projectionQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { conversationId, messageId } = parsed.data
    if (!isUuidString(conversationId)) {
      return reply.status(400).send(error(400, '无效的对话 ID'))
    }

    // 投影读走主池:崩溃/断线后的第一次读取要拿"刚刚写进去"的最后一帧,
    // 副本滞后会把 state 停在 materializing(客户端据此误判"还没结束")。
    const rows = await db
      .select({
        conversationId: chatMessageProjections.conversationId,
        clientMessageId: chatMessageProjections.clientMessageId,
        state: chatMessageProjections.state,
        content: chatMessageProjections.content,
        reasoning: chatMessageProjections.reasoning,
        tokens: chatMessageProjections.tokens,
        attemptCount: chatMessageProjections.attemptCount,
        committedMessageId: chatMessageProjections.committedMessageId,
        errorCode: chatMessageProjections.errorCode,
        lastActivityAt: chatMessageProjections.lastActivityAt,
        updatedAt: chatMessageProjections.updatedAt,
      })
      .from(chatMessageProjections)
      .innerJoin(chatConversations, eq(chatConversations.id, chatMessageProjections.conversationId))
      .where(
        and(
          eq(chatMessageProjections.conversationId, conversationId),
          eq(chatMessageProjections.clientMessageId, messageId),
          eq(chatMessageProjections.userId, request.userId!),
          eq(chatConversations.userId, request.userId!),
        ),
      )
      .limit(1)

    const row = rows[0]
    if (!row) return reply.status(404).send(error(404, '投影不存在'))
    return reply.send(success({ projection: row }))
  })

  // GET /api/chat/changes/:changeSetId
  server.get('/changes/:changeSetId', async (request, reply) => {
    const parsed = changeSetParamsSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const changeSetId = parsed.data.changeSetId
    if (!isUuidString(changeSetId)) {
      return reply.status(400).send(error(400, '无效的变更集 ID'))
    }

    const changeSet = await findOwnedChangeSet(request.userId!, changeSetId)
    if (!changeSet) {
      return reply.status(404).send(error(404, '变更集不存在或无权限'))
    }

    const files = await dbRead
      .select({
        path: chatTurnChangeFiles.path,
        operation: chatTurnChangeFiles.operation,
        beforeSha256: chatTurnChangeFiles.beforeSha256,
        afterSha256: chatTurnChangeFiles.afterSha256,
        additions: chatTurnChangeFiles.additions,
        deletions: chatTurnChangeFiles.deletions,
        unifiedDiff: chatTurnChangeFiles.unifiedDiff,
        rewindTracked: chatTurnChangeFiles.rewindTracked,
        contentTruncated: chatTurnChangeFiles.contentTruncated,
        rewindAppliedAt: chatTurnChangeFiles.rewindAppliedAt,
      })
      .from(chatTurnChangeFiles)
      .where(eq(chatTurnChangeFiles.changeSetId, changeSetId))
      // 刻意不返回 before_content:回滚由 ai-service 用库内正文完成,
      // 客户端不需要(也不该)拿到整份改前文件正文 —— 那是把服务端磁盘内容整段外泄。
      .orderBy(chatTurnChangeFiles.path)

    return reply.send(success({ changeSet, files }))
  })

  // POST /api/chat/changes/:changeSetId/rewind {dryRun}
  server.post(
    '/changes/:changeSetId/rewind',
    {
      config: {
        // 回滚会碰文件系统,给一条独立限流,避免被脚本当免费探针刷出大量 stat/写盘。
        rateLimit: { max: 20, timeWindow: '1 minute', keyGenerator: (req) => req.userId || req.ip },
      },
    },
    async (request, reply) => {
      const params = changeSetParamsSchema.safeParse(request.params)
      if (!params.success) {
        return reply.status(400).send(error(400, params.error.issues[0]?.message ?? '参数错误'))
      }
      const body = rewindBodySchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
      }
      const changeSetId = params.data.changeSetId
      if (!isUuidString(changeSetId)) {
        return reply.status(400).send(error(400, '无效的变更集 ID'))
      }

      // 网关只在库里判归属,不解读 rewind_status:能否真回滚是 ai-service 的判据
      // (sha256 是否仍匹配、文件是否可追踪),这里提前判会把两处口径写成一份。
      const owned = await findOwnedChangeSet(request.userId!, changeSetId)
      if (!owned) {
        return reply.status(404).send(error(404, '变更集不存在或无权限'))
      }

      let upstream: Response
      try {
        // 上游 FastAPI 以 prefix="/api" 挂载(见 ai-service/app/main.py include_router),
        // 故这里必须带 /api 段 —— 写成 /chat/changes 会稳定 404。
        upstream = await aiServiceFetch(request, `/api/chat/changes/${changeSetId}/rewind`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dryRun: body.data.dryRun }),
        })
      } catch (e) {
        server.log.warn({ err: e, changeSetId }, '[chat-changes] rewind upstream unreachable')
        return reply
          .status(502)
          .send(error(502, '回滚服务暂不可用', 'CHANGE_REWIND_UPSTREAM_FAILED'))
      }

      // 上游原样回给客户端(状态码与 JSON 都保留):回滚是三档结论(rewound/conflict/部分不可),
      // 网关重包一层只会让客户端读不懂上游的判据;只有"上游明确失败"才换成网关稳定码。
      if (!upstream.ok) {
        const detail = await upstream.text().catch(() => '')
        server.log.warn(
          { changeSetId, status: upstream.status, detail: detail.slice(0, 200) },
          '[chat-changes] rewind upstream failed',
        )
        return reply
          .status(502)
          .send(error(502, '回滚服务返回失败', 'CHANGE_REWIND_UPSTREAM_FAILED'))
      }

      const payload = (await upstream.json().catch(() => null)) as unknown
      if (payload === null) {
        return reply
          .status(502)
          .send(error(502, '回滚服务响应不可解析', 'CHANGE_REWIND_UPSTREAM_FAILED'))
      }
      return reply.send(payload)
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
