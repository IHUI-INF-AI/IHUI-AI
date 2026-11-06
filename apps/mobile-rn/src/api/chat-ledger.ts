// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 批次 3 账本查询面在 RN 端的唯一请求出口(2026-11-06)。
 *
 * 三个端点(`/ai/chat/conversations/:id/{budget-stops,context-ledger,compaction-boundaries}`)
 * 的响应都是 `{ items: [...] }`,且行形状是**事后账本**而不是 SSE 帧:
 *  - 这里逐行做结构收窄,不合格的行整行丢弃 —— 查询面失败/旧库缺列时静默回退到现有本地
 *    估算,不拿半截数据上屏;
 *  - 只在服务端已排序的列表里按 `createdAt` 取最新一条,不在端内猜"数组第 0 条最新";
 *  - 请求封装统一走 api-client 的 `fetchApi`(它负责 baseURL/`/api` 前缀/鉴权/401 续期)。
 */
import { fetchApi, type BudgetEvent } from '@ihui/api-client'
import type {
  CompactBoundary,
  ContextLedger,
  ContextLedgerCategory,
  ContextLedgerCategoryUsage,
  PreservedSegmentAnchor,
} from '@ihui/shared'
import { CONTEXT_LEDGER_ORDER, orderContextLedgerCategories } from '../utils/context-ledger'

/** 查询上限;三个端点都按 docs 的默认档取一页足够回看最新一条。 */
const LEDGER_QUERY_LIMIT = 20

export interface ChatBudgetStopRow {
  level: BudgetEvent['level']
  reasonCode: string | null
  usedTokens: number | null
  limitTokens: number | null
  usagePercent: number | null
  remainingTokens: number | null
  stoppedAtIteration: number | null
  createdAt: string
}

export interface ChatContextLedgerRow {
  turnIndex: number
  ledger: ContextLedger
  createdAt: string
}

export interface ChatCompactionBoundaryRow {
  tokensBefore: number
  tokensAfter: number
  messagesSummarized: number
  boundary: CompactBoundary
  createdAt: string
}

interface LedgerListResponse {
  items?: unknown[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isInteger(value: unknown, min: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

function integerOrNull(value: unknown): number | null {
  return isInteger(value, 0) ? value : null
}

function percentOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function isLedgerCategory(value: unknown): value is ContextLedgerCategory {
  return typeof value === 'string' && (CONTEXT_LEDGER_ORDER as readonly string[]).includes(value)
}

function parseCategories(value: unknown): ContextLedgerCategoryUsage[] | null {
  if (!Array.isArray(value) || value.length !== CONTEXT_LEDGER_ORDER.length) return null
  const parsed: ContextLedgerCategoryUsage[] = []
  for (const entry of value) {
    if (!isRecord(entry) || !isLedgerCategory(entry.category)) return null
    if (typeof entry.tokens !== 'number' || !Number.isFinite(entry.tokens) || entry.tokens < 0) {
      return null
    }
    if (typeof entry.percent !== 'number' || !Number.isFinite(entry.percent) || entry.percent < 0) {
      return null
    }
    parsed.push({ category: entry.category, tokens: entry.tokens, percent: entry.percent })
  }
  // 七类顺序由本地固定表重排;长度/去重/闭集三项校验都通过才算合格。
  return orderContextLedgerCategories(parsed) ? parsed : null
}

function parseAnchor(value: unknown): PreservedSegmentAnchor | null {
  if (value === null) return null
  if (!isRecord(value)) return null
  if (!isInteger(value.index, 0)) return null
  const role = stringOrNull(value.role)
  const excerpt = stringOrNull(value.excerpt)
  if (!role || !excerpt) return null
  return {
    index: value.index,
    role,
    excerpt,
    messageId: stringOrNull(value.messageId),
    ...(typeof value.digest === 'string' && value.digest !== '' ? { digest: value.digest } : {}),
  }
}

function parsePreservedSegment(value: unknown): CompactBoundary['preservedSegment'] | null {
  if (!isRecord(value)) return null
  const head = parseAnchor(value.head)
  const anchor = parseAnchor(value.anchor)
  const tail = parseAnchor(value.tail)
  if ((value.head !== null && head === null) || (value.anchor !== null && anchor === null)) {
    return null
  }
  if (value.tail !== null && tail === null) return null
  return { head, anchor, tail }
}

function parseRemovedRange(value: unknown): CompactBoundary['removedRange'] | null {
  if (value === null) return null
  if (!isRecord(value)) return null
  if (!isInteger(value.startIndex, 0) || !isInteger(value.endIndex, 0)) return null
  if (value.endIndex < value.startIndex) return null
  return { startIndex: value.startIndex, endIndex: value.endIndex }
}

function parseBudgetLevel(value: unknown): BudgetEvent['level'] | null {
  return value === 'warning' || value === 'critical' || value === 'stopped' ? value : null
}

function parseBudgetStopRow(raw: unknown): ChatBudgetStopRow | null {
  if (!isRecord(raw)) return null
  const level = parseBudgetLevel(raw.level)
  const createdAt = stringOrNull(raw.createdAt)
  if (!level || !createdAt) return null
  return {
    level,
    reasonCode: stringOrNull(raw.reasonCode),
    usedTokens: integerOrNull(raw.usedTokens),
    limitTokens: integerOrNull(raw.limitTokens),
    usagePercent: percentOrNull(raw.usagePercent),
    remainingTokens: integerOrNull(raw.remainingTokens),
    stoppedAtIteration: integerOrNull(raw.stoppedAtIteration),
    createdAt,
  }
}

function parseContextLedgerRow(raw: unknown): ChatContextLedgerRow | null {
  if (!isRecord(raw)) return null
  if (!isInteger(raw.contextLimit, 1)) return null
  if (!isInteger(raw.usedTokens, 0)) return null
  const percentage = percentOrNull(raw.percentage)
  if (percentage === null) return null
  if (raw.tokenizer !== 'provider_usage' && raw.tokenizer !== 'heuristic') return null
  if (typeof raw.compacted !== 'boolean') return null
  if (raw.model !== null && raw.model !== undefined && typeof raw.model !== 'string') return null
  const categories = parseCategories(raw.categories)
  if (!categories) return null
  const turnIndex = isInteger(raw.turnIndex, 0) ? raw.turnIndex : 0
  const capturedAt = stringOrNull(raw.capturedAt) ?? stringOrNull(raw.createdAt)
  if (!capturedAt) return null
  return {
    turnIndex,
    ledger: {
      model: stringOrNull(raw.model),
      contextLimit: raw.contextLimit,
      usedTokens: raw.usedTokens,
      percentage,
      categories,
      tokenizer: raw.tokenizer,
      compacted: raw.compacted,
      capturedAt,
    },
    createdAt: stringOrNull(raw.createdAt) ?? capturedAt,
  }
}

function parseCompactionBoundaryRow(raw: unknown): ChatCompactionBoundaryRow | null {
  if (!isRecord(raw)) return null
  const trigger = stringOrNull(raw.trigger)
  const createdAt = stringOrNull(raw.createdAt)
  if (!trigger || !createdAt) return null
  if (!isInteger(raw.tokensBefore, 0) || !isInteger(raw.tokensAfter, 0)) return null
  if (!isInteger(raw.messagesSummarized, 0)) return null
  const durationMs = integerOrNull(raw.durationMs)
  const preservedSegment = parsePreservedSegment(raw.preservedSegment)
  if (!preservedSegment) return null
  const removedRange = parseRemovedRange(raw.removedRange)
  return {
    tokensBefore: raw.tokensBefore,
    tokensAfter: raw.tokensAfter,
    messagesSummarized: raw.messagesSummarized,
    boundary: {
      trigger,
      tokensBefore: raw.tokensBefore,
      tokensAfter: raw.tokensAfter,
      messagesSummarized: raw.messagesSummarized,
      durationMs,
      preservedSegment,
      removedRange,
    },
    createdAt,
  }
}

function pickLatest<T extends { createdAt: string }>(rows: readonly T[]): T | null {
  let latest: T | null = null
  for (const row of rows) {
    if (!latest || row.createdAt > latest.createdAt) latest = row
  }
  return latest
}

async function fetchLedgerItems(path: string, signal?: AbortSignal): Promise<unknown[] | null> {
  const response = await fetchApi<LedgerListResponse>(path, {
    params: { limit: LEDGER_QUERY_LIMIT },
    signal,
  })
  if (!response.success) return null
  const items = response.data?.items
  return Array.isArray(items) ? items : null
}

/** 最新一条硬停止记录;只要 `level='stopped'` 的行,旧告警行不得被当成"已停止"。 */
export async function fetchLatestBudgetStop(
  conversationId: string,
  signal?: AbortSignal,
): Promise<ChatBudgetStopRow | null> {
  const items = await fetchLedgerItems(
    `/ai/chat/conversations/${encodeURIComponent(conversationId)}/budget-stops`,
    signal,
  )
  if (!items) return null
  const stops: ChatBudgetStopRow[] = []
  for (const item of items) {
    const row = parseBudgetStopRow(item)
    if (row && row.level === 'stopped') stops.push(row)
  }
  return pickLatest(stops)
}

/** 最新一轮七类账本;行结构不合格返回 null,调用方保留现有本地估算。 */
export async function fetchLatestContextLedger(
  conversationId: string,
  signal?: AbortSignal,
): Promise<ChatContextLedgerRow | null> {
  const items = await fetchLedgerItems(
    `/ai/chat/conversations/${encodeURIComponent(conversationId)}/context-ledger`,
    signal,
  )
  if (!items) return null
  const rows: ChatContextLedgerRow[] = []
  for (const item of items) {
    const row = parseContextLedgerRow(item)
    if (row) rows.push(row)
  }
  return pickLatest(rows)
}

/** 最新一条压缩边界;刷新/换端后仍能回看 head/anchor/tail。 */
export async function fetchLatestCompactionBoundary(
  conversationId: string,
  signal?: AbortSignal,
): Promise<ChatCompactionBoundaryRow | null> {
  const items = await fetchLedgerItems(
    `/ai/chat/conversations/${encodeURIComponent(conversationId)}/compaction-boundaries`,
    signal,
  )
  if (!items) return null
  const rows: ChatCompactionBoundaryRow[] = []
  for (const item of items) {
    const row = parseCompactionBoundaryRow(item)
    if (row) rows.push(row)
  }
  return pickLatest(rows)
}
