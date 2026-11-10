// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 批次 3 账本落库出口(2026-11-06):上下文七类账本 / 预算硬停止 / 压缩边界。
 *
 * 纪律(与流式链路同一条,不可放宽):
 *  1. **绝不阻断流**。本文件每个写入函数都自己 try/catch 并只记日志,返回 boolean 供调用方
 *     决定是否补一条 debug;网关与移动端转发循环都不 await 到"写成功"才继续转发。
 *  2. **写入前按契约校验**,不把垃圾写进库:七类 categories 必须恰好 7 项、名字落在闭集、
 *     contextLimit>0;reasonCode/scope 用 shared 的运行时守卫。DB 层不抄第二份 CHECK ——
 *     唯一事实源在 `packages/shared/src/sse/contract.ts`(Python 侧 `budget_reason.py` 同值)。
 *  3. **幂等锚点只有一条**:`(conversation_id, message_id)` 部分唯一索引。同一 (会话, 消息)
 *     重连重放/重发只更新不新增;message_id 为空(降级流)时走普通 insert,不参与冲突。
 *  4. 会话坐标缺失时**不落**账本(三张表的 conversation_id 都以 chat_conversations 为外键):
 *     移动端 Agent 流用的是 agent_runtime_sessions 平面,没有 chat 会话坐标,调用方会得到
 *     false + debug,这是"坐标不存在",不是"写失败"。
 */

import { desc, eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  chatBudgetStops,
  chatCompactionBoundaries,
  chatContextLedgers,
  type ChatBudgetStop,
  type ChatCompactionBoundary,
  type ChatContextLedger,
} from '@ihui/database'
import {
  BUDGET_STOP_SCOPES,
  CONTEXT_LEDGER_CATEGORIES,
  isBudgetStopReason,
  type BudgetStopScope,
  type CompactBoundary,
  type ContextLedger,
} from '@ihui/shared'

/** 只依赖 debug/warn 两个方法:Fastify request.log 与单测假 logger 都直接可用。 */
export interface LedgerLogger {
  debug: (obj: unknown, msg?: string) => void
  warn: (obj: unknown, msg?: string) => void
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 只接受真 UUID;占位 id(`msg_…` / 前端临时串)一律折成 null,避免 PG 22P02 打断写入。 */
function uuidOrNull(value: unknown): string | null {
  return typeof value === 'string' && UUID_RE.test(value) ? value : null
}

function debug(log: LedgerLogger | undefined, obj: unknown, msg: string): void {
  try {
    log?.debug(obj, msg)
  } catch {
    // 日志适配器自身异常也不许冒泡到流。
  }
}

function warn(log: LedgerLogger | undefined, obj: unknown, msg: string): void {
  try {
    log?.warn(obj, msg)
  } catch {
    // 同上。
  }
}

const CATEGORY_SET = new Set<string>(CONTEXT_LEDGER_CATEGORIES)
const SCOPE_SET = new Set<string>(BUDGET_STOP_SCOPES)

/**
 * 七类账本形状校验(写入前置)。
 *
 * 口径逐条对齐 contract.ts:
 *  - categories 长度必须 =7,七类名字必须**恰好各出现一次**(固定顺序由渲染端保证,这里只钉
 *    封闭集与齐全性;乱序也无信息损失,不做额外拒绝)。
 *  - contextLimit > 0、usedTokens >= 0、percentage 有限且非负。
 *  - tokenizer 只认 `provider_usage` / `heuristic`。
 *  - compacted 必须是 boolean(缺键的旧帧不写)。
 */
export function isValidContextLedger(value: unknown): value is ContextLedger {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (!Number.isInteger(v.contextLimit) || (v.contextLimit as number) <= 0) return false
  if (!Number.isInteger(v.usedTokens) || (v.usedTokens as number) < 0) return false
  if (typeof v.percentage !== 'number' || !Number.isFinite(v.percentage) || v.percentage < 0) {
    return false
  }
  if (v.tokenizer !== 'provider_usage' && v.tokenizer !== 'heuristic') return false
  if (typeof v.compacted !== 'boolean') return false
  if (v.model !== null && typeof v.model !== 'string') return false
  const categories = v.categories
  if (!Array.isArray(categories) || categories.length !== CONTEXT_LEDGER_CATEGORIES.length) {
    return false
  }
  const seen = new Set<string>()
  for (const entry of categories) {
    if (!entry || typeof entry !== 'object') return false
    const item = entry as Record<string, unknown>
    if (typeof item.category !== 'string' || !CATEGORY_SET.has(item.category)) return false
    if (seen.has(item.category)) return false
    seen.add(item.category)
    if (typeof item.tokens !== 'number' || !Number.isFinite(item.tokens) || item.tokens < 0) {
      return false
    }
    if (typeof item.percent !== 'number' || !Number.isFinite(item.percent) || item.percent < 0) {
      return false
    }
  }
  return seen.size === CONTEXT_LEDGER_CATEGORIES.length
}

function isValidCompactBoundary(value: unknown): value is CompactBoundary {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (typeof v.trigger !== 'string' || v.trigger === '') return false
  if (!Number.isInteger(v.tokensBefore) || (v.tokensBefore as number) < 0) return false
  if (!Number.isInteger(v.tokensAfter) || (v.tokensAfter as number) < 0) return false
  if (!Number.isInteger(v.messagesSummarized) || (v.messagesSummarized as number) < 0) return false
  if (v.durationMs !== null && !Number.isInteger(v.durationMs)) return false
  if (!v.preservedSegment || typeof v.preservedSegment !== 'object') return false
  const removed = v.removedRange
  if (removed !== null) {
    if (!removed || typeof removed !== 'object') return false
    const r = removed as Record<string, unknown>
    if (!Number.isInteger(r.startIndex) || !Number.isInteger(r.endIndex)) return false
  }
  return true
}

export interface LedgerContext {
  userId: string
  conversationId?: string | null
  messageId?: string | null
}

export interface RecordContextLedgerInput extends LedgerContext {
  ledger: ContextLedger
  /** 帧未携带轮次时写 0(default 已在 DDL 里,这里显式传保持一致) */
  turnIndex?: number | null
}

/**
 * 落一行上下文账本。messageId 可空:
 *  - 非空 ⇒ `(conversation_id, message_id)` 命中部分唯一索引时**更新**同一行(幂等);
 *  - 空 ⇒ 普通 insert(降级流没有消息坐标,每轮都是一条独立观测)。
 */
export async function recordContextLedger(
  input: RecordContextLedgerInput,
  log?: LedgerLogger,
): Promise<boolean> {
  try {
    const conversationId = uuidOrNull(input.conversationId)
    if (!conversationId) {
      debug(
        log,
        { conversationId: input.conversationId },
        '[chat-ledger] skip context ledger: no chat conversation coordinate',
      )
      return false
    }
    if (!isValidContextLedger(input.ledger)) {
      debug(
        log,
        { conversationId, messageId: input.messageId },
        '[chat-ledger] drop invalid contextLedger payload',
      )
      return false
    }
    const ledger = input.ledger
    const messageId = uuidOrNull(input.messageId)
    const turnIndex = Number.isInteger(input.turnIndex) ? (input.turnIndex as number) : 0
    const values = {
      userId: input.userId,
      conversationId,
      messageId,
      turnIndex,
      model: typeof ledger.model === 'string' ? ledger.model : null,
      contextLimit: ledger.contextLimit,
      usedTokens: ledger.usedTokens,
      percentage: ledger.percentage.toFixed(1),
      categories: ledger.categories,
      tokenizer: ledger.tokenizer,
      compacted: ledger.compacted,
    }
    if (messageId) {
      await db
        .insert(chatContextLedgers)
        .values(values)
        .onConflictDoUpdate({
          target: [chatContextLedgers.conversationId, chatContextLedgers.messageId],
          targetWhere: sql`${chatContextLedgers.messageId} is not null`,
          set: {
            userId: values.userId,
            turnIndex: values.turnIndex,
            model: values.model,
            contextLimit: values.contextLimit,
            usedTokens: values.usedTokens,
            percentage: values.percentage,
            categories: values.categories,
            tokenizer: values.tokenizer,
            compacted: values.compacted,
            createdAt: new Date(),
          },
        })
    } else {
      await db.insert(chatContextLedgers).values(values)
    }
    return true
  } catch (err) {
    warn(
      log,
      { err, conversationId: input.conversationId },
      '[chat-ledger] context ledger write failed (stream kept alive)',
    )
    return false
  }
}

export interface RecordBudgetStopInput extends LedgerContext {
  level: string
  reasonCode: string
  scope: string
  pillar?: string | null
  usedTokens?: number | null
  limitTokens?: number | null
  usagePercent?: number | null
  remainingTokens?: number | null
  stoppedAtIteration?: number | null
}

/**
 * 落一条预算停止证据。只在 level='stopped' 时调用(429 与流内 agent 中途超限同表)。
 * conversationId 可空(移动端 agent 会话无 chat 坐标;429 也可能在会话归属校验之前发生)。
 */
export async function recordBudgetStop(
  input: RecordBudgetStopInput,
  log?: LedgerLogger,
): Promise<boolean> {
  try {
    if (input.level !== 'stopped') {
      debug(log, { level: input.level }, '[chat-ledger] budget stop skipped: level is not stopped')
      return false
    }
    if (!isBudgetStopReason(input.reasonCode)) {
      debug(
        log,
        { reasonCode: input.reasonCode },
        '[chat-ledger] budget stop rejected: unknown reasonCode',
      )
      return false
    }
    if (!SCOPE_SET.has(input.scope)) {
      debug(log, { scope: input.scope }, '[chat-ledger] budget stop rejected: unknown scope')
      return false
    }
    const conversationId = uuidOrNull(input.conversationId)
    await db.insert(chatBudgetStops).values({
      userId: input.userId,
      conversationId,
      messageId: uuidOrNull(input.messageId),
      level: input.level,
      reasonCode: input.reasonCode,
      scope: input.scope as BudgetStopScope,
      pillar: input.pillar ?? null,
      usedTokens: input.usedTokens ?? null,
      limitTokens: input.limitTokens ?? null,
      usagePercent:
        typeof input.usagePercent === 'number' && Number.isFinite(input.usagePercent)
          ? input.usagePercent.toFixed(1)
          : null,
      remainingTokens: input.remainingTokens ?? null,
      stoppedAtIteration: input.stoppedAtIteration ?? null,
    })
    return true
  } catch (err) {
    warn(
      log,
      { err, conversationId: input.conversationId },
      '[chat-ledger] budget stop write failed (stream kept alive)',
    )
    return false
  }
}

export interface RecordCompactionBoundaryInput extends LedgerContext {
  boundary: CompactBoundary
}

/** 落一条压缩边界。无 chat 会话坐标或 boundary 形状不合契约时整笔不落(只记 debug)。 */
export async function recordCompactionBoundary(
  input: RecordCompactionBoundaryInput,
  log?: LedgerLogger,
): Promise<boolean> {
  try {
    const conversationId = uuidOrNull(input.conversationId)
    if (!conversationId) {
      debug(
        log,
        { conversationId: input.conversationId },
        '[chat-ledger] skip compaction boundary: no chat conversation coordinate',
      )
      return false
    }
    if (!isValidCompactBoundary(input.boundary)) {
      debug(log, { conversationId }, '[chat-ledger] drop invalid compaction boundary payload')
      return false
    }
    const b = input.boundary
    await db.insert(chatCompactionBoundaries).values({
      conversationId,
      messageId: uuidOrNull(input.messageId),
      trigger: b.trigger,
      tokensBefore: b.tokensBefore,
      tokensAfter: b.tokensAfter,
      messagesSummarized: b.messagesSummarized,
      durationMs: b.durationMs,
      preservedSegment: b.preservedSegment,
      removedRange: b.removedRange,
    })
    return true
  } catch (err) {
    warn(
      log,
      { err, conversationId: input.conversationId },
      '[chat-ledger] compaction boundary write failed (stream kept alive)',
    )
    return false
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 查询出口(三个 GET 端点共用)。按 created_at DESC,limit 由调用方压到 ≤50。
// ─────────────────────────────────────────────────────────────────────────────

export async function listContextLedgers(
  conversationId: string,
  limit: number,
): Promise<ChatContextLedger[]> {
  return db
    .select()
    .from(chatContextLedgers)
    .where(eq(chatContextLedgers.conversationId, conversationId))
    .orderBy(desc(chatContextLedgers.createdAt))
    .limit(limit)
}

export async function listBudgetStops(
  conversationId: string,
  limit: number,
): Promise<ChatBudgetStop[]> {
  return db
    .select()
    .from(chatBudgetStops)
    .where(eq(chatBudgetStops.conversationId, conversationId))
    .orderBy(desc(chatBudgetStops.createdAt))
    .limit(limit)
}

export async function listCompactionBoundaries(
  conversationId: string,
  limit: number,
): Promise<ChatCompactionBoundary[]> {
  return db
    .select()
    .from(chatCompactionBoundaries)
    .where(eq(chatCompactionBoundaries.conversationId, conversationId))
    .orderBy(desc(chatCompactionBoundaries.createdAt))
    .limit(limit)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
