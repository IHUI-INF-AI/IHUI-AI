// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 移动端聊天收发端点(G-962 死端点簇 · 模板串三族的补后端腿)。
 *
 * RN 三屏(AgentChatScreen / LiveChatScreen / CircleChatScreen)各自声明了一套
 * `/api/{agents|live|circles}/:id/messages` 的 GET+POST 契约,而两台后端从未注册
 * (票面 L16078 〔逐条判定@2026-10-17〕:这三条模板串"只以别的资源名存在")⇒ 屏一打开
 * 加载必失败、发送必报错。按 `course-mobile-routes.ts` 同一先例("按移动端已声明的契约
 * 补齐最小读面,数据源全部复用既有表")补这一族,**不新造存储、不新造字段**:
 *
 * - `live/:id/messages` —— 数据源 `live_comment`,与 `/ws/live-chat` 同一张表同一投影口径
 *   (chat-server.ts 的 send/history 腿)。REST 与 WS 写同一张表,历史天然一致;
 *   REST 发送不做 WS 房间广播(那属于实时面持有人,见下注)。
 * - `agents/:id/messages` —— 历史取 `agent_runtime_sessions`(botId=agentId、userId 的最近
 *   会话 messages jsonb);POST 的执行腿与 v1-public.ts `POST /agents/:id/call` 完全同源:
 *   读 agents 行(status=published)→ system=agentPrompt、model=agentModel →
 *   ai-service `/api/llm/complete`,成功才把 user+assistant 两条写回会话。
 * - `circles/:id/messages` —— 圈子"群聊"的数据源就是圈子帖子流 `circle_posts`(库里没有
 *   第二张圈子消息表;票面逐条判定原文即"只以 /circles/posts/:id/comments 存在")。
 *   `title` 列 NOT NULL ⇒ 投影时标题取正文首行(≤200),不另造列;敏感词过滤与
 *   `POST /circles/:id/posts` 同一道 `sanitizeUgcInput` 闸,不新开无过滤写入口。
 *
 * REST 发送与 WS 广播的分工:LiveChatScreen 是独立的历史+发送面(从 LiveDetailScreen 的
 * 聊天入口进),它写 live_comment 即入史;正在看直播间的客户端由 WS 腿收到实时帧。
 * REST 这一腿不向 WS 房间转发 —— 要转发就得持有 LiveChatServer 单例并造"REST 写→WS 推"
 * 的第二条广播路径(两份真相),归实时面持有人按 §0.6 统一。
 */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { and, asc, desc, eq } from 'drizzle-orm'
import {
  agentRuntimeSessions,
  agents,
  circlePosts,
  liveComment,
  users,
  type AgentRuntimeSessionMessage,
} from '@ihui/database'
import { checkAuth } from '../plugins/auth.js'
import { db, dbRead } from '../db/index.js'
import { findCircleByIdOrSlug } from '../db/community-queries.js'
import { sanitizeUgcInput } from '../db/sensitive-words-queries.js'
import { aiServiceSystemFetch } from '../utils/ai-service-fetch.js'
import { isUuidString } from '../utils/uuid.js'
import { success, error } from '../utils/response.js'

const contentBodySchema = z.object({
  content: z.string().trim().min(1, 'content 不能为空').max(5000, 'content 过长'),
})

/** 历史分页:屏侧契约是"打开即全量小档",取最近 50 条正序,不发明游标。 */
const HISTORY_LIMIT = 50

/** agent 会话里喂给 llm/complete 的历史条数上限(system + 最近 N 条 + 本轮 user)。 */
const LLM_HISTORY_WINDOW = 20

function isoOrNow(value: Date | string | null | undefined): string {
  if (value instanceof Date) return value.toISOString()
  const s = String(value ?? '')
  return s || new Date().toISOString()
}

async function nicknameOf(userId: string): Promise<string> {
  const [row] = await dbRead
    .select({ nickname: users.nickname })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  return row?.nickname ?? ''
}

export const mobileChatRoutes: FastifyPluginAsync = async (server) => {
  // 三族全部登录态:历史与发送都按"当前用户"取材,不新开公开读面(与 course-mobile-routes 同档)。
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
  })

  // ---------- agents/:id/messages ----------

  async function loadPublishedAgent(rawId: string) {
    if (!isUuidString(rawId)) return { missing: true as const }
    const [agent] = await dbRead
      .select({
        agentId: agents.agentId,
        agentPrompt: agents.agentPrompt,
        agentModel: agents.agentModel,
        status: agents.status,
      })
      .from(agents)
      .where(eq(agents.agentId, rawId))
      .limit(1)
    if (!agent || agent.status !== 'published') return { missing: true as const }
    return { agent }
  }

  async function findLatestSession(agentId: string, userId: string) {
    const [row] = await dbRead
      .select()
      .from(agentRuntimeSessions)
      .where(
        and(
          eq(agentRuntimeSessions.botId, agentId),
          eq(agentRuntimeSessions.userId, userId),
          eq(agentRuntimeSessions.status, 'active'),
        ),
      )
      .orderBy(desc(agentRuntimeSessions.updatedAt))
      .limit(1)
    return row ?? null
  }

  // GET /agents/:id/messages - 与某 Agent 的历史消息(最近一个 active 会话,正序)
  server.get('/agents/:id/messages', async (request, reply) => {
    const { id } = request.params as { id: string }
    const found = await loadPublishedAgent(id)
    if ('missing' in found) return reply.status(404).send(error(404, 'Agent 不存在'))
    const session = await findLatestSession(id, request.userId!)
    const messages = Array.isArray(session?.messages) ? session.messages : []
    return reply.send(
      success(
        messages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({ id: m.id, role: m.role, content: m.content })),
      ),
    )
  })

  // POST /agents/:id/messages - 发一条并取回 Agent 回复(执行腿与 POST /v1/agents/:id/call 同源)
  server.post('/agents/:id/messages', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = contentBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const found = await loadPublishedAgent(id)
    if ('missing' in found) return reply.status(404).send(error(404, 'Agent 不存在'))

    const userId = request.userId!
    const existing = await findLatestSession(id, userId)
    const history = (Array.isArray(existing?.messages) ? existing.messages : [])
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-LLM_HISTORY_WINDOW)

    const llmMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []
    if (found.agent.agentPrompt)
      llmMessages.push({ role: 'system', content: found.agent.agentPrompt })
    for (const m of history) llmMessages.push({ role: m.role, content: m.content })
    llmMessages.push({ role: 'user', content: parsed.data.content })

    let assistantContent: string
    try {
      const resp = await aiServiceSystemFetch('/api/llm/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: llmMessages, model: found.agent.agentModel ?? undefined }),
      })
      if (!resp.ok) {
        return reply.status(503).send(error(503, `AI service unavailable (${resp.status})`))
      }
      const data = (await resp.json()) as {
        content?: string
        error?: boolean
        error_message?: string
      }
      if (data.error) {
        return reply.status(502).send(error(502, data.error_message ?? '模型调用失败'))
      }
      assistantContent = String(data.content ?? '')
    } catch {
      return reply.status(503).send(error(503, 'AI service unavailable'))
    }

    // 成功才写回会话:两条消息一起落库,失败路径不留下"发了但历史里没有"的半截态。
    const now = Date.now()
    const userMsg: AgentRuntimeSessionMessage = {
      id: `msg_${now}_u`,
      role: 'user',
      content: parsed.data.content,
      timestamp: now,
    }
    const assistantMsg: AgentRuntimeSessionMessage = {
      id: `msg_${now}_a`,
      role: 'assistant',
      content: assistantContent,
      timestamp: now,
    }
    const nextMessages = [...history, userMsg, assistantMsg]
    if (existing) {
      // 只追加库里还没有的消息:同毫秒重试/重发撞到同一 id 时不重复入库、不发 UPDATE
      const currentIds = new Set(
        (Array.isArray(existing.messages) ? existing.messages : []).map((m) => m.id),
      )
      const appended = [userMsg, assistantMsg].filter((m) => !currentIds.has(m.id))
      if (appended.length > 0) {
        const changed: { messages: AgentRuntimeSessionMessage[] } = {
          messages: [...history, ...appended],
        }
        await db
          .update(agentRuntimeSessions)
          .set({ ...changed, updatedAt: new Date() })
          .where(eq(agentRuntimeSessions.id, existing.id))
      }
    } else {
      await db.insert(agentRuntimeSessions).values({
        id: `sess_${crypto.randomUUID()}`,
        botId: id,
        userId,
        status: 'active',
        messages: nextMessages,
      })
    }

    return reply.send(
      success({ id: assistantMsg.id, role: 'assistant', content: assistantContent }),
    )
  })

  // ---------- live/:id/messages ----------

  function toLiveChatRow(row: typeof liveComment.$inferSelect) {
    return {
      id: String(row.id),
      userId: row.userId,
      nickname: row.userName ?? '',
      content: row.content,
      createdAt: isoOrNow(row.createdAt),
    }
  }

  // GET /live/:id/messages - 直播间历史消息(live_comment,与 WS history 腿同表同口径)
  server.get('/live/:id/messages', async (request, reply) => {
    const { id } = request.params as { id: string }
    const channelId = Number.parseInt(id, 10)
    if (!Number.isFinite(channelId)) {
      return reply.status(400).send(error(400, '无效的直播间 ID'))
    }
    const rows = await dbRead
      .select()
      .from(liveComment)
      .where(eq(liveComment.channelId, channelId))
      .orderBy(desc(liveComment.createdAt))
      .limit(HISTORY_LIMIT)
    return reply.send(success(rows.reverse().map(toLiveChatRow)))
  })

  // POST /live/:id/messages - 发一条弹幕/聊天消息(写 live_comment;WS 实时广播归实时面)
  server.post('/live/:id/messages', async (request, reply) => {
    const { id } = request.params as { id: string }
    const channelId = Number.parseInt(id, 10)
    if (!Number.isFinite(channelId)) {
      return reply.status(400).send(error(400, '无效的直播间 ID'))
    }
    const parsed = contentBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const nickname = await nicknameOf(request.userId!)
    const [row] = await db
      .insert(liveComment)
      .values({
        channelId,
        userId: request.userId!,
        userName: nickname || null,
        content: parsed.data.content,
        type: 1,
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '消息发送失败'))
    return reply.send(success(toLiveChatRow(row)))
  })

  // ---------- circles/:id/messages ----------

  // GET /circles/:id/messages - 圈子消息流(数据源 circle_posts,status=1 正序小档)
  server.get('/circles/:id/messages', async (request, reply) => {
    const { id } = request.params as { id: string }
    if (!isUuidString(id)) return reply.status(404).send(error(404, '圈子不存在'))
    const circle = await findCircleByIdOrSlug(id)
    if (!circle) return reply.status(404).send(error(404, '圈子不存在'))
    const rows = await dbRead
      .select({
        id: circlePosts.id,
        userId: circlePosts.userId,
        nickname: users.nickname,
        content: circlePosts.content,
        createdAt: circlePosts.createdAt,
      })
      .from(circlePosts)
      .leftJoin(users, eq(users.id, circlePosts.userId))
      .where(and(eq(circlePosts.circleId, circle.id), eq(circlePosts.status, 1)))
      .orderBy(asc(circlePosts.createdAt))
      .limit(HISTORY_LIMIT)
    return reply.send(
      success(
        rows.map((r) => ({
          id: r.id,
          userId: r.userId,
          nickname: r.nickname ?? '',
          content: r.content,
          createdAt: isoOrNow(r.createdAt),
        })),
      ),
    )
  })

  // POST /circles/:id/messages - 发一条圈子消息(落 circle_posts;敏感词与发帖腿同一道闸)
  server.post('/circles/:id/messages', async (request, reply) => {
    const { id } = request.params as { id: string }
    if (!isUuidString(id)) return reply.status(404).send(error(404, '圈子不存在'))
    const parsed = contentBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const circle = await findCircleByIdOrSlug(id)
    if (!circle) return reply.status(404).send(error(404, '圈子不存在'))

    const filtered = await sanitizeUgcInput(
      { content: parsed.data.content },
      {
        action: 'ugc.post.create',
        resourceType: 'post',
        userId: request.userId,
        ip: request.ip,
        userAgent: request.headers['user-agent'] as string | undefined,
      },
    )
    if (!filtered.ok) {
      return reply.status(400).send(error(400, '内容含违规词,发送失败'))
    }
    const content = filtered.fields.content!.text
    // title NOT NULL:取正文首行(≤200),空则落"圈子消息" —— 不另造列、不编第二份内容。
    const firstLine = content.split('\n')[0]!.trim()
    const title = (firstLine || '圈子消息').slice(0, 200)
    const [row] = await db
      .insert(circlePosts)
      .values({ circleId: circle.id, userId: request.userId!, title, content })
      .returning({ id: circlePosts.id })
    if (!row) return reply.status(500).send(error(500, '消息发送失败'))
    const nickname = await nicknameOf(request.userId!)
    return reply.send(
      success({
        id: row.id,
        userId: request.userId!,
        nickname,
        content,
        createdAt: new Date().toISOString(),
      }),
    )
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
