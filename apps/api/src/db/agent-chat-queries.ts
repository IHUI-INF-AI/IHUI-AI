// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * agent 会话写路径(B1,2026-11-02)。
 *
 * 病灶:`POST /agents/:id/messages` 曾把 `[...history, user, assistant]` 整列回写,
 * 而 `history` 是 `.slice(-20)` 的上下文窗口 —— 每轮覆盖后会话永远 ≤22 条,
 * 30 轮之后早期消息全部不可见。上下文窗口是给 LLM 的,不是落库真相。
 *
 * 判据:
 *  ① 读面(LLM 上下文 / GET 历史)取**完整** messages,窗口只由调用方施加;
 *  ② 写面只追加:`messages = messages || $jsonb`,不整列覆盖 ⇒ 并发两个 POST 各追加
 *     两条,谁也不会把对方刚写的两条吃掉;
 *  ③ 会话查找 / 新建在同一事务内,`pg_advisory_xact_lock` + `SELECT ... FOR UPDATE`
 *     串行化 —— 否则两个并发首个 POST 都可能查不到行,各插一条会话(双会话分叉);
 *  ④ `seq` 是落库可选字段:旧行按下标惰性回填后再算 `max(seq)+1`,不改表结构。
 */
import { and, desc, eq, sql } from 'drizzle-orm'
import { agentRuntimeSessions, type AgentRuntimeSessionMessage } from '@ihui/database'
import { db, dbRead } from './index.js'

type SessionRow = typeof agentRuntimeSessions.$inferSelect

/** 全部消息都已带合法 `seq`(空数组不算 —— 没有旧消息要回填)。 */
function hasAllSeq(messages: readonly AgentRuntimeSessionMessage[]): boolean {
  return (
    messages.length > 0 &&
    messages.every((m) => typeof m.seq === 'number' && Number.isFinite(m.seq))
  )
}

/**
 * 旧数据无 `seq` ⇒ 按数组下标惰性回填 1..n。
 *
 * 只要有一条缺,整组统一按下标 —— 不逐条混用「已存 seq + 回填下标」,
 * 否则新旧混合时会同时出现 0 起与 1 起的两种序号,游标不再单调。
 * 本函数只用于本次计算,读路径不因此写库;真正回填发生在 appendMessages 的写回。
 */
function withSeqFallback(
  messages: readonly AgentRuntimeSessionMessage[],
): AgentRuntimeSessionMessage[] {
  const allPresent = hasAllSeq(messages)
  return messages.map((m, index) => ({ ...m, seq: allPresent ? m.seq! : index + 1 }))
}

/** 下一条的起始 seq = 已归档消息的 max(seq)+1(空会话从 0 开始)。 */
function nextSeqOf(messages: readonly AgentRuntimeSessionMessage[]): number {
  let max = -1
  for (const m of withSeqFallback(messages)) {
    if (m.seq! > max) max = m.seq!
  }
  return max + 1
}

function latestSessionWhere(agentId: string, userId: string) {
  return and(
    eq(agentRuntimeSessions.botId, agentId),
    eq(agentRuntimeSessions.userId, userId),
    eq(agentRuntimeSessions.status, 'active'),
  )
}

/**
 * 读面:最近一个 active 会话(GET 历史 / 取 LLM 上下文)。
 * 只读、不加锁、不建会话 —— GET 是读请求,不能因为看了一眼就多出一行。
 * `ORDER BY updated_at DESC, id DESC`:同一时间戳下按 id 决胜,结果可复现。
 */
export async function readLatestSession(
  agentId: string,
  userId: string,
): Promise<SessionRow | null> {
  const [row] = await dbRead
    .select()
    .from(agentRuntimeSessions)
    .where(latestSessionWhere(agentId, userId))
    .orderBy(desc(agentRuntimeSessions.updatedAt), desc(agentRuntimeSessions.id))
    .limit(1)
  return row ?? null
}

/**
 * 写面:事务内找最近 active 会话,没有就建。
 *
 * 锁序:先 `pg_advisory_xact_lock(agent+user)`,再 `SELECT ... FOR UPDATE`。
 * 只做 find 不建会话,并发双建仍然可能;只建不看锁,同样可能 —— 两者必须同事务。
 * 调用方在 LLM 成功之后才调本函数,失败路径不会留下空会话行。
 */
export async function findLatestSession(agentId: string, userId: string): Promise<SessionRow> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`agent_chat:${agentId}:${userId}`}))`,
    )
    const [row] = await tx
      .select()
      .from(agentRuntimeSessions)
      .where(latestSessionWhere(agentId, userId))
      .orderBy(desc(agentRuntimeSessions.updatedAt), desc(agentRuntimeSessions.id))
      .limit(1)
      .for('update')
    if (row) return row
    const [created] = await tx
      .insert(agentRuntimeSessions)
      .values({
        id: `sess_${crypto.randomUUID()}`,
        botId: agentId,
        userId,
        status: 'active',
        messages: [],
      })
      .returning()
    if (!created) throw new Error('findLatestSession: 会话创建失败')
    return created
  })
}

/**
 * 原子追加:锁内算 `max(seq)+1`,再以 `messages || $jsonb` 只追加新消息。
 *
 * 为什么不整列回写:回写用的是事务开始前的快照,两个并发请求会把其中一个的
 * 追加覆盖掉。`||` 由行锁串行化,后到者读到的是前者已提交的数组。
 *
 * 返回落库形状的新消息(含 seq),调用方的响应投影不因此多字段。
 */
export async function appendMessages(
  sessionId: string,
  messages: readonly AgentRuntimeSessionMessage[],
): Promise<AgentRuntimeSessionMessage[]> {
  if (messages.length === 0) return []
  return db.transaction(async (tx) => {
    // 同一会话的追加必须串行:seq 是锁内从库面算出来的,不是请求侧拍的。
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`agent_chat_msg:${sessionId}`}))`)
    const [row] = await tx
      .select()
      .from(agentRuntimeSessions)
      .where(eq(agentRuntimeSessions.id, sessionId))
      .for('update')
    if (!row) throw new Error('appendMessages: 会话不存在')

    const existing = Array.isArray(row.messages) ? row.messages : []
    const startSeq = nextSeqOf(existing)
    const appended = messages.map((m, index) => ({ ...m, seq: startSeq + index }))
    // 旧行没有 seq 时,首写顺带把旧消息按下标回填(1..n)并与新消息一起写回;
    // 已有 seq 的会话保持纯 `||` 追加,不回写旧数组(那会吃掉并发追加)。
    const needsBackfill = existing.length > 0 && !hasAllSeq(existing)
    const payload = JSON.stringify(
      needsBackfill ? [...withSeqFallback(existing), ...appended] : appended,
    )
    // 写策略(messages 列):只追加 —— 不把读到的旧数组整列写回(那会吃掉并发追加)。
    const changed = needsBackfill
      ? { messages: [...withSeqFallback(existing), ...appended] }
      : { messages: sql`${agentRuntimeSessions.messages} || ${payload}::jsonb` }
    // 归属列进 where(与读到的行同源):会话 id 之外再钉 bot+user,不按裸 id 写。
    const updated = await tx
      .update(agentRuntimeSessions)
      .set({ ...changed, updatedAt: new Date() })
      .where(
        and(
          eq(agentRuntimeSessions.id, sessionId),
          eq(agentRuntimeSessions.botId, row.botId),
          eq(agentRuntimeSessions.userId, row.userId),
        ),
      )
      .returning({ id: agentRuntimeSessions.id })
    if (updated.length === 0) throw new Error('appendMessages: 会话写入失败')
    return appended
  })
}

/** v2 分页信封:`items` 为时间正序的一页,`total` 为全量条数(不含 system)。 */
export interface AgentMessagesPage {
  items: Array<Pick<AgentRuntimeSessionMessage, 'id' | 'role' | 'content'>>
  total: number
  hasMoreOlder: boolean
  nextCursor: number | null
}

export type AgentMessagesPageResult =
  { ok: true; page: AgentMessagesPage } | { ok: false; reason: 'cursor-out-of-range' }

/**
 * 分页读(B2):`seq` 越大越新,`cursor` 指向"上一页最旧那条"的 seq。
 *
 * - 无 cursor:取最新 `limit` 条;
 * - 有 cursor:先按 seq 定位,再取它之前(更旧)的 `limit` 条;
 * - cursor 不在本次有效 seq 集合里(超过末尾 / 小于起点 / 空会话)⇒ 越界。
 *
 * 旧消息缺 seq 时由 withSeqFallback 按下标补 1..n —— 只算不写库。
 */
export function pageAgentMessages(
  messages: readonly AgentRuntimeSessionMessage[],
  options: { limit: number; cursor?: number | null },
): AgentMessagesPageResult {
  const visible = messages.filter((m) => m.role === 'user' || m.role === 'assistant')
  const normalized = withSeqFallback(visible)
  const total = normalized.length
  const limit = options.limit

  let older: readonly AgentRuntimeSessionMessage[]
  if (options.cursor === undefined || options.cursor === null) {
    older = normalized
  } else {
    const index = normalized.findIndex((m) => m.seq === options.cursor)
    if (index < 0) return { ok: false, reason: 'cursor-out-of-range' }
    older = normalized.slice(0, index)
  }

  const page = older.slice(-limit)
  const hasMoreOlder = older.length > limit
  return {
    ok: true,
    page: {
      items: page.map((m) => ({ id: m.id, role: m.role, content: m.content })),
      total,
      hasMoreOlder,
      nextCursor: hasMoreOlder ? page[0]!.seq! : null,
    },
  }
}
