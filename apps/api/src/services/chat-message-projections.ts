// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 流式消息投影(批次 4,2026-11-06 立)。
 *
 * 为什么需要第二份表:assistant 正文在流结束后才由 ai-callback worker 写入
 * `chat_messages`;进程崩溃 / 断线时,已经吐给用户的半截正文没有任何服务端证据,
 * 重连只能靠客户端把 prefix 再传回来。投影表按 `pending → materializing → committed`
 * 记录网关**实际观测到**的流式正文,给"断线前到底生成了什么"一个服务端事实来源。
 *
 * 状态迁移全部写成带谓词的 SQL,而不是"先读再判再写":网关进程与 worker 是
 * 两个并发的写入方,读后写会在两者之间开一个必输窗口 —— 典型坏形态是 worker 已
 * `committed`,网关的 partial 写又把行改回 materializing(投影被重放污染)。
 *
 * 与输入 receipt 同样接受最小 `Queryable` 端口:网关主池与单测假表共用一份判据。
 */

import type { Queryable } from './chat-input-receipts.js'

export interface ProjectionIdentity {
  conversationId: string
  userId: string
  clientMessageId: string
}

/** 投影正文分片(全部可选:只写本次真正累积到的字段)。 */
export interface ProjectionPart {
  content?: string | null
  reasoning?: string | null
  tokens?: number | null
  metadata?: Record<string, unknown> | null
}

/** openProjection 的两档结果:已打开的 attempt,或"这个 turn 已 committed,不得重开"。 */
export type OpenProjectionResult =
  { kind: 'opened'; attempt: number } | { kind: 'committed'; attempt: number }

/** 对外暴露的投影行(列名转成 camelCase,值逐个验型)。 */
export interface ChatMessageProjectionRow {
  conversationId: string
  userId: string
  clientMessageId: string
  state: 'pending' | 'materializing' | 'committed' | 'failed'
  attempt: number
  content: string | null
  reasoning: string | null
  tokens: number | null
  committedMessageId: string | null
  errorCode: string | null
  lastActivityAt: string | null
}

function asNumber(value: unknown): number | null {
  const num = typeof value === 'string' ? Number.parseInt(value, 10) : value
  return typeof num === 'number' && Number.isFinite(num) ? num : null
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

/**
 * 行 → 窄化结构。state 不在闭集内(脏数据)一律 null:调用方不得把未知状态当成任一已知档。
 */
function readProjectionRow(row: unknown): ChatMessageProjectionRow | null {
  if (row === null || typeof row !== 'object') return null
  const rec = row as Record<string, unknown>
  const state = rec.state
  if (
    state !== 'pending' &&
    state !== 'materializing' &&
    state !== 'committed' &&
    state !== 'failed'
  ) {
    return null
  }
  const attempt = asNumber(rec.attempt_count)
  if (attempt === null) return null
  const lastActivityRaw = rec.last_activity_at
  return {
    conversationId: typeof rec.conversation_id === 'string' ? rec.conversation_id : '',
    userId: typeof rec.user_id === 'string' ? rec.user_id : '',
    clientMessageId: typeof rec.client_message_id === 'string' ? rec.client_message_id : '',
    state,
    attempt,
    content: asNullableString(rec.content),
    reasoning: asNullableString(rec.reasoning),
    tokens: asNumber(rec.tokens),
    committedMessageId: asNullableString(rec.committed_message_id),
    errorCode: asNullableString(rec.error_code),
    lastActivityAt:
      typeof lastActivityRaw === 'string'
        ? lastActivityRaw
        : lastActivityRaw instanceof Date
          ? lastActivityRaw.toISOString()
          : null,
  }
}

/**
 * 打开(或重开)一轮投影。
 *
 * `ON CONFLICT ... WHERE state <> 'committed'` 是这里的核心判据:同一占位消息的重试
 * 可以把 pending/materializing/failed 重开(attempt+1,清空上一次的半截正文),
 * 但**已 committed 的 turn 不得重开** —— 那是 worker 已经落库的事实,重开会把
 * "历史已存在"改写成"还在生成",前端随后会看到一条重复回复。
 */
export async function openProjection(
  queryable: Queryable,
  identity: ProjectionIdentity,
): Promise<OpenProjectionResult> {
  const { conversationId, userId, clientMessageId } = identity
  const rows = await queryable.query(
    `INSERT INTO chat_message_projections
       (conversation_id, user_id, client_message_id, state, attempt_count)
     VALUES ($1, $2, $3, 'pending', 1)
     ON CONFLICT (conversation_id, client_message_id) DO UPDATE
       SET state = 'pending',
           content = NULL,
           reasoning = NULL,
           tokens = NULL,
           metadata = NULL,
           error_code = NULL,
           attempt_count = chat_message_projections.attempt_count + 1,
           last_activity_at = now(),
           updated_at = now()
       WHERE chat_message_projections.state <> 'committed'
     RETURNING attempt_count`,
    [conversationId, userId, clientMessageId],
  )
  const attempt = asNumber((rows.rows[0] as Record<string, unknown> | undefined)?.attempt_count)
  if (attempt !== null) return { kind: 'opened', attempt }

  // 无 RETURNING 行 ⇒ 冲突且被 WHERE 拦下(唯一可能是已 committed)。再查一次拿真实 attempt,
  // 让调用方能区分"这个 turn 已由 worker 落库"与"刚打开"。
  const existing = await getProjection(queryable, { conversationId, clientMessageId })
  if (existing?.state === 'committed') return { kind: 'committed', attempt: existing.attempt }
  return { kind: 'opened', attempt: existing?.attempt ?? 1 }
}

/**
 * 写 partial(内容增长期间调用)。只允许 pending/materializing:
 * worker 若已 committed,本条 UPDATE 影响 0 行 —— 网关绝不把已落库的回复改回生成中。
 */
export async function markMaterializing(
  queryable: Queryable,
  identity: Pick<ProjectionIdentity, 'conversationId' | 'clientMessageId'>,
  part: ProjectionPart,
): Promise<boolean> {
  const { conversationId, clientMessageId } = identity
  const rows = await queryable.query(
    `UPDATE chat_message_projections
        SET state = 'materializing',
            content = $3,
            reasoning = $4,
            tokens = COALESCE($5, tokens),
            metadata = COALESCE($6::jsonb, metadata),
            last_activity_at = now(),
            updated_at = now()
      WHERE conversation_id = $1 AND client_message_id = $2
        AND state IN ('pending', 'materializing')
      RETURNING state`,
    [
      conversationId,
      clientMessageId,
      part.content ?? null,
      part.reasoning ?? null,
      part.tokens ?? null,
      part.metadata ? JSON.stringify(part.metadata) : null,
    ],
  )
  return rows.rows.length > 0
}

/**
 * 提交投影(worker 落库后调用/或 worker 侧复用)。允许 committed 再提交(幂等),
 * 但 committed_message_id 与正文只补不覆盖(COALESCE),防一次重试把终稿改回半截。
 */
export async function commitProjection(
  queryable: Queryable,
  identity: Pick<ProjectionIdentity, 'conversationId' | 'clientMessageId'>,
  part: ProjectionPart & { committedMessageId?: string | null },
): Promise<boolean> {
  const { conversationId, clientMessageId } = identity
  const rows = await queryable.query(
    `UPDATE chat_message_projections
        SET state = 'committed',
            committed_message_id = COALESCE($3::uuid, committed_message_id),
            content = COALESCE($4, content),
            reasoning = COALESCE($5, reasoning),
            tokens = COALESCE($6, tokens),
            metadata = COALESCE($7::jsonb, metadata),
            error_code = NULL,
            last_activity_at = now(),
            updated_at = now()
      WHERE conversation_id = $1 AND client_message_id = $2
        AND state IN ('pending', 'materializing', 'committed')
      RETURNING state`,
    [
      conversationId,
      clientMessageId,
      part.committedMessageId ?? null,
      part.content ?? null,
      part.reasoning ?? null,
      part.tokens ?? null,
      part.metadata ? JSON.stringify(part.metadata) : null,
    ],
  )
  return rows.rows.length > 0
}

/**
 * 标记失败。`state <> 'committed'` 的守卫与 markMaterializing 方向相反:
 * 已落库的 turn 没有"失败"可言,一次迟到的上游错误不得把它标成 failed。
 */
export async function failProjection(
  queryable: Queryable,
  identity: Pick<ProjectionIdentity, 'conversationId' | 'clientMessageId'>,
  errorCode: string,
): Promise<boolean> {
  const { conversationId, clientMessageId } = identity
  const rows = await queryable.query(
    `UPDATE chat_message_projections
        SET state = 'failed',
            error_code = $3,
            last_activity_at = now(),
            updated_at = now()
      WHERE conversation_id = $1 AND client_message_id = $2
        AND state <> 'committed'
      RETURNING state`,
    [conversationId, clientMessageId, errorCode],
  )
  return rows.rows.length > 0
}

/** 读投影(resume 的 partial 读取与测试用)。无行 ⇒ null(不是错误,是"没有这一轮")。 */
export async function getProjection(
  queryable: Queryable,
  identity: Pick<ProjectionIdentity, 'conversationId' | 'clientMessageId'>,
): Promise<ChatMessageProjectionRow | null> {
  const { conversationId, clientMessageId } = identity
  const rows = await queryable.query(
    `SELECT conversation_id, user_id, client_message_id, state, attempt_count,
            content, reasoning, tokens, committed_message_id, error_code, last_activity_at
       FROM chat_message_projections
      WHERE conversation_id = $1 AND client_message_id = $2`,
    [conversationId, clientMessageId],
  )
  return readProjectionRow(rows.rows[0])
}
