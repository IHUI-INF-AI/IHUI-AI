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
import { config } from '../config/index.js'
import { buildSseCorsHeaders } from '../plugins/cors-origin.js'
import {
  createSession,
  detachOnClose,
  emitEvent,
  emitUpstreamLine,
  findSession,
  finishSession,
  getReplayEvents,
  startHeartbeat,
  takeoverStream,
  waitForReplayHeadroom,
} from '../utils/sse-stream-registry.js'
import { getReplayWindowStatus, isStreamActive } from '../utils/sse-replay-buffer.js'
import {
  agents,
  circlePosts,
  liveComment,
  users,
  type AgentRuntimeSessionMessage,
} from '@ihui/database'
import { checkAuth } from '../plugins/auth.js'
import { db, dbRead } from '../db/index.js'
import {
  appendMessages,
  findLatestSession,
  pageAgentMessages,
  readLatestSession,
} from '../db/agent-chat-queries.js'
import { findCircleByIdOrSlug } from '../db/community-queries.js'
import { sanitizeUgcInput } from '../db/sensitive-words-queries.js'
import { escapeHtml } from '../websocket/chat-server.js'
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

/** B2:version 显式协商;缺省仍是 v1。非 1/2 一律 400(行为由测试固定)。 */
function parseVersion(raw: unknown): 1 | 2 | null {
  if (raw === undefined) return 1
  if (raw === '1') return 1
  if (raw === '2') return 2
  return null
}

/** v2 分页参数:limit 缺省 20,必须是 1..100 的整数。 */
function parseLimit(raw: unknown): number | null {
  if (raw === undefined) return 20
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null
  const n = Number(raw)
  return Number.isSafeInteger(n) && n >= 1 && n <= 100 ? n : null
}

/** v2 游标:缺省 null(首页);其余必须是正整数,负数/小数/非数字一律非法。 */
function parseCursor(raw: unknown): { ok: true; value: number | null } | { ok: false } {
  if (raw === undefined) return { ok: true, value: null }
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return { ok: false }
  const n = Number(raw)
  return Number.isSafeInteger(n) && n >= 1 ? { ok: true, value: n } : { ok: false }
}

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

/** Agent 流式回复的服务端兜底超时(与 /ai/chat/stream 同档,防上游卡死时连接无限挂起)。 */
const AGENT_STREAM_TIMEOUT_MS = 5 * 60_000

/** 上游帧归类:只认正文增量 / 完成 / 错误三类,其余(usage、工具帧等)一律不进本端点的事件序列。 */
type AgentStreamFrame =
  | { kind: 'delta'; content: string }
  | { kind: 'done'; finishReason?: string }
  | { kind: 'error'; message: string }
  | null

/**
 * 一行上游 `data:` 载荷 → 本端点的帧类型。
 *
 * ai-service `/api/llm/complete/stream` 的帧形如 `event: chunk` + `data: {"content": "..."}`、
 * `event: done` + `data: {...}`、`event: error` + `data: {"message": "..."}`。JSON 里带 `type`
 * 时以它为准,不带时退回同名事件名 —— 两条来源指同一件事,不各写一套判据。
 */
function parseAgentStreamFrame(payload: string, eventName: string | null): AgentStreamFrame {
  if (payload === '[DONE]') return { kind: 'done' }
  let json: {
    type?: unknown
    content?: unknown
    message?: unknown
    error_message?: unknown
    error?: unknown
    finishReason?: unknown
  }
  try {
    json = JSON.parse(payload) as typeof json
  } catch {
    return null
  }
  const type = typeof json.type === 'string' ? json.type : eventName
  if (type === 'error') {
    const msg = json.message ?? json.error_message ?? json.error
    return { kind: 'error', message: typeof msg === 'string' && msg ? msg : '上游返回错误' }
  }
  if (type === 'done' || type === 'partial_done') {
    return {
      kind: 'done',
      finishReason: typeof json.finishReason === 'string' ? json.finishReason : undefined,
    }
  }
  if (typeof json.content === 'string' && (type === 'chunk' || type === 'delta' || type === null)) {
    return { kind: 'delta', content: json.content }
  }
  return null
}

/** SSE 响应头(与 /ai/chat/stream 同一套;hijack 绕过 cors 插件,故手动按同一判据回显)。 */
function sseHeadersOf(request: FastifyRequest): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  }
  Object.assign(
    headers,
    buildSseCorsHeaders(
      request.headers.origin as string | undefined,
      config.CORS_ORIGIN,
      config.EXTENSION_IDS,
    ),
  )
  return headers
}

function abortErrorOf(): Error {
  const err = new Error('stream aborted')
  err.name = 'AbortError'
  return err
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

  // GET /agents/:id/messages - 与某 Agent 的历史消息(最近一个 active 会话,正序)
  // B2:version=2 显式协商分页;缺省/1 仍是 v1 数组形状(逐字段不变)。
  server.get('/agents/:id/messages', async (request, reply) => {
    const { id } = request.params as { id: string }
    const found = await loadPublishedAgent(id)
    if ('missing' in found) return reply.status(404).send(error(404, 'Agent 不存在'))
    const query = request.query as { version?: unknown; limit?: unknown; cursor?: unknown }
    const version = parseVersion(query.version)
    if (version === null) {
      return reply.status(400).send(error(400, 'version 只支持 1 或 2'))
    }
    const session = await readLatestSession(id, request.userId!)
    const messages = Array.isArray(session?.messages) ? session.messages : []

    if (version === 2) {
      const limit = parseLimit(query.limit)
      if (limit === null) {
        return reply.status(400).send(error(400, 'limit 必须是 1-100 的整数'))
      }
      const cursor = parseCursor(query.cursor)
      if (!cursor.ok) return reply.status(400).send(error(400, 'cursor 必须是正整数'))
      const result = pageAgentMessages(messages, { limit, cursor: cursor.value })
      if (!result.ok) return reply.status(400).send(error(400, 'cursor 越界或非法'))
      return reply.send(success(result.page))
    }

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
    // 读全文:上下文窗口只作用于喂给 LLM 的那一份,不影响落库完整性。
    const existing = await readLatestSession(id, userId)
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
    // B1:成功才写 —— 锁内取/建会话,再以 `messages || $jsonb` 原子追加到**完整**历史。
    // 不再用 [...history, user, assistant] 覆盖:history 只有 20 条窗口,覆盖会把
    // 早期消息永久截断,也会吃掉并发请求刚追加的两条。
    const session = await findLatestSession(id, userId)
    await appendMessages(session.id, [userMsg, assistantMsg])

    return reply.send(
      success({ id: assistantMsg.id, role: 'assistant', content: assistantContent }),
    )
  })

  // POST /agents/:id/messages/stream - 流式发一条并逐帧取回 Agent 回复(B3)
  //
  // 事件序列(本端点自有的最小协议,前端消费面属 B4):
  //   meta → delta* → done → data: [DONE]
  // meta/delta/done 均为编号帧(`id: <seq>`,seq 从 1 递增、只由 sse-stream-registry 产生);
  // `[DONE]` 是协议终止符,按既有 emitUpstreamLine 语义**不编号、不进回放缓冲**。
  // 15s 心跳写注释帧 `: ping`,不占 seq、不进缓冲 ⇒ 不污染事件序列。
  //
  // 连接语义(整段复用 sse-stream-registry,不新造第三套 SSE 设施):
  // - Last-Event-ID + 窗口完整 + 原流仍在飞 ⇒ 接管:先重放缺失段,再无缝接续原上游;
  // - Last-Event-ID + 原流已结束但缓冲仍在 60s 保留窗 ⇒ 仅重放缺失段后收尾;
  // - 窗口有洞/过期 ⇒ 落回重新生成(与 /ai/chat/stream 同一降级出口);
  // - 客户端断线 ⇒ 进 15s 宽限期(生成继续),超时才 abort 上游。
  //
  // 单写者语义(并发):同一 agent+user 已有在飞流时,第二个请求**接管** ——
  // 先退役旧会话(replayKey 摘除 + finished 置位,使旧流的 finally 不会释放新缓冲),
  // 再 abort 旧上游;旧流因此不落库、也不向新会话写帧。最终只有接管者落一条。
  //
  // 落库一致性:一轮对话(user + assistant)在流成功后**一次** appendMessages 原子追加
  // (B1 的 seq 由锁内算出);流失败/中断一律不落库 —— 宁可整轮缺席,也不留半条。
  // 失败本身以 `{type:'error', reason}` 帧显式告知(进回放缓冲,断线重连可见)。
  server.post('/agents/:id/messages/stream', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = contentBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const found = await loadPublishedAgent(id)
    if ('missing' in found) return reply.status(404).send(error(404, 'Agent 不存在'))

    // 握手前的读全部走既有读面;上下文窗口只作用于喂 LLM 的那一份,不改变落库完整性。
    const userId = request.userId!
    const existing = await readLatestSession(id, userId)
    const history = (Array.isArray(existing?.messages) ? existing.messages : [])
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-LLM_HISTORY_WINDOW)
    const llmMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []
    if (found.agent.agentPrompt)
      llmMessages.push({ role: 'system', content: found.agent.agentPrompt })
    for (const m of history) llmMessages.push({ role: m.role, content: m.content })
    llmMessages.push({ role: 'user', content: parsed.data.content })

    // replayKey 口径 = 「这个 Agent 与这个用户的会话」(GET/POST 取的都是最近 active 会话)。
    // 与主聊天链路的 `${conversationId}:${messageId}` 不同:Agent 会话没有前端预生成的
    // messageId,按 agent+user 定位才拦得住同会话并发双发。
    const replayKey = `agent:${id}:${userId}`
    const now = Date.now()
    const userMessageId = `msg_${now}_u`
    const assistantMessageId = `msg_${now}_a`

    reply.hijack()
    const raw = reply.raw
    raw.writeHead(200, sseHeadersOf(request))
    // 立即把头刷出去:接管分支在缺失段为空时不写任何帧,若不 flush,客户端连 fetch
    // 的响应头都要等到下一次心跳(最长 15s)才拿到 —— 表现为"重连一直没反应"。
    raw.flushHeaders()

    // ---- Last-Event-ID:接管 / 仅重放 ----
    const lastEventIdHeader = request.headers['last-event-id']
    if (typeof lastEventIdHeader === 'string' && lastEventIdHeader !== '') {
      const lastSeq = Number.parseInt(lastEventIdHeader, 10)
      if (Number.isFinite(lastSeq) && lastSeq >= 0) {
        const window = getReplayWindowStatus(replayKey, lastSeq)
        if (window.complete) {
          const live = findSession(replayKey)
          if (live && !live.finished) {
            const missed = takeoverStream(live, lastSeq, raw)
            for (const e of missed) raw.write(`id: ${e.id}\n${e.rawLine}\n\n`)
            // 新连接断开同样走宽限 detach(重复断线/重连安全)。
            // 身份复核:旧连接(本流原 raw)的 close 可能晚于本次接管才被处理,
            // 若直接 detach 会把刚换绑的新连接置空 ⇒ 必须确认当前绑定就是本新连接。
            raw.on('close', () => {
              if (live.raw === raw && findSession(replayKey) === live) detachOnClose(live)
            })
            request.log.warn(
              { replayKey, lastSeq, replayed: missed.length },
              '[AgentStream] stream takeover',
            )
            return
          }
          if (isStreamActive(replayKey)) {
            const missed = getReplayEvents(replayKey, lastSeq)
            for (const e of missed) raw.write(`id: ${e.id}\n${e.rawLine}\n\n`)
            // 原流已收尾:补协议终止符(未编号,与实时路径同形),让重连端不必靠连接关闭猜结束
            raw.write('data: [DONE]\n\n')
            request.log.warn(
              { replayKey, lastSeq, replayed: missed.length },
              '[AgentStream] replay-only (upstream gone)',
            )
            raw.end()
            return
          }
        } else {
          // 有洞 / 已过期:不许发不可辨的半截尾巴,落回下方重新生成(丢弃必须点名)
          request.log.warn(
            {
              replayKey,
              lastSeq,
              lowestBufferedId: window.lowestId,
              droppedCount: window.droppedCount,
              abandonReason: window.abandonReason,
              reason: window.abandoned
                ? 'replay-window-abandoned'
                : window.known
                  ? 'replay-window-hole'
                  : 'replay-window-expired',
            },
            '[AgentStream] 重放窗口不足以覆盖 Last-Event-ID,放弃部分重放 → 重新生成',
          )
        }
      }
    }

    // ---- 新生成:先退役同 key 在飞流(接管,保证单上游单写者) ----
    const previous = findSession(replayKey)
    if (previous && !previous.finished) {
      if (previous.graceTimer) {
        clearTimeout(previous.graceTimer)
        previous.graceTimer = null
      }
      // 摘除 replayKey 是关键:否则旧流 finally 的 finishSession 会 releaseStream(replayKey),
      // 把**新会话**的缓冲标成 disposed(同 key 换代后新表项被旧收尾误伤)。
      previous.replayKey = null
      previous.finished = true
      previous.controller.abort()
    }
    const session = createSession(raw, new AbortController(), replayKey, null)
    const controller = session.controller
    const stopHeartbeat = startHeartbeat(session)

    let timedOut = false
    const serverTimeout = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, AGENT_STREAM_TIMEOUT_MS)
    // 断线只对「当前绑定的连接」生效:接管后旧 raw 的迟到 close 不得把新连接置空。
    const onClose = () => {
      if (session.raw === raw) detachOnClose(session)
    }
    raw.on('close', onClose)

    let assistantContent = ''
    let upstreamError: string | null = null
    let sawDone = false
    let finishReason = 'stop'

    try {
      emitEvent(
        session,
        JSON.stringify({
          type: 'meta',
          agentId: id,
          messageId: assistantMessageId,
          userMessageId,
          model: found.agent.agentModel ?? null,
          ts: now,
        }),
      )

      const resp = await aiServiceSystemFetch('/api/llm/complete/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: llmMessages,
          model: found.agent.agentModel ?? undefined,
        }),
        signal: controller.signal,
      })
      if (!resp.ok || !resp.body) {
        const errText = await resp.text().catch(() => '')
        upstreamError = `AI service unavailable (${resp.status})${errText ? `: ${errText.slice(0, 200)}` : ''}`
        throw new Error(upstreamError)
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let pendingEvent: string | null = null
      for (;;) {
        if (controller.signal.aborted) throw abortErrorOf()
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let nl: number
        while ((nl = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, nl).replace(/\r$/, '')
          buffer = buffer.slice(nl + 1)
          if (line === '') {
            pendingEvent = null
            continue
          }
          if (line.startsWith('event:')) {
            pendingEvent = line.slice(6).trim()
            continue
          }
          if (!line.startsWith('data:')) continue
          const payload = line.slice(5).replace(/^\s/, '')
          if (payload === '') continue
          const frame = parseAgentStreamFrame(payload, pendingEvent)
          if (!frame) continue
          if (frame.kind === 'delta') {
            if (!frame.content) continue
            assistantContent += frame.content
            emitEvent(session, JSON.stringify({ type: 'delta', content: frame.content }))
            continue
          }
          if (frame.kind === 'error') {
            upstreamError = frame.message
            break
          }
          sawDone = true
          if (frame.finishReason) finishReason = frame.finishReason
        }
        if (upstreamError || sawDone) break
        // G-714 ④:窗口饱和即暂停 drain;被显式放弃时停止透传(客户端按全量重取恢复)。
        if ((await waitForReplayHeadroom(session)) === 'abandoned') {
          upstreamError = '重放窗口已放弃,请全量重取'
          controller.abort()
          break
        }
      }
      if (upstreamError) throw new Error(upstreamError)
      // 上游没以 done 收尾(连接中途断掉)⇒ 拒绝把半截当完整:整轮不落库。
      if (!sawDone) throw new Error('上游流未以 done 结束')

      // 成功才写回:user + assistant 一次原子追加(B1 锁内算 seq),不留半条。
      const appendTime = Date.now()
      const userMsg: AgentRuntimeSessionMessage = {
        id: userMessageId,
        role: 'user',
        content: parsed.data.content,
        timestamp: appendTime,
      }
      const assistantMsg: AgentRuntimeSessionMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: assistantContent,
        timestamp: appendTime,
      }
      const sessionRow = await findLatestSession(id, userId)
      const appended = await appendMessages(sessionRow.id, [userMsg, assistantMsg])
      emitEvent(
        session,
        JSON.stringify({
          type: 'done',
          messageId: assistantMessageId,
          seq: appended.find((m) => m.id === assistantMessageId)?.seq,
          finishReason,
        }),
      )
      emitUpstreamLine(session, 'data: [DONE]')
    } catch (e) {
      const err = e as Error
      // 被同 key 新请求退役的旧流:既不落库、也不再往旧连接写帧(收尾由 finally 完成)。
      const superseded = session.finished && findSession(replayKey) !== session
      if (!superseded) {
        const reason =
          err.name === 'AbortError'
            ? timedOut
              ? 'timeout'
              : 'aborted'
            : upstreamError
              ? 'upstream_error'
              : 'internal_error'
        emitEvent(
          session,
          JSON.stringify({ type: 'error', reason, message: upstreamError ?? err.message }),
        )
        request.log.warn(
          { replayKey, reason, message: upstreamError ?? err.message },
          '[AgentStream] 流失败,整轮不落库(不留半条)',
        )
      }
    } finally {
      raw.off('close', onClose)
      clearTimeout(serverTimeout)
      stopHeartbeat()
      finishSession(session)
      ;(session.raw ?? raw).end()
    }
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
    // 2026-10-31 安全强化第 19 批(F2 中高):REST 弹幕腿此前未转义直落库 ——
    // 同一张 live_comment 表、同一历史读取口,前端以 innerHTML 渲染;WS 腿
    // (P2 修复)落库前逐字段转义而 REST 腿原文落库 ⇒ 存储型 XSS 打直播间全员。
    // 现与 WS 腿共用同一 escapeHtml(单出口,§0.6)。
    const [row] = await db
      .insert(liveComment)
      .values({
        channelId,
        userId: request.userId!,
        userName: nickname ? escapeHtml(nickname) : null,
        content: escapeHtml(parsed.data.content),
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
