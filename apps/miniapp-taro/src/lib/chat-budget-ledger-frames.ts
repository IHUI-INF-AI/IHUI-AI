// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:批次 3 小程序端预算停止/七类账本/压缩边界的帧认领层(仅端内消费)。

/**
 * 批次 3(2026-11-06):预算硬停止 / 七类上下文账本 / 压缩边界的端内认领层。
 *
 * 为什么需要这一层:
 *  ① `budget` 的 stopped 档已由共享 sse-parse 认领(字段可直接从 dispatch 取);
 *  ② `usage` 帧的 `contextLedger` 与 `compaction` 帧的 `boundary` 共享解析面
 *     目前只折出旧字段(七类与保留段会被静默丢掉),而共享解析面不在本票可改面内
 *     ⇒ 这两维在本端**原始行旁路**认领,形状不认整帧丢弃(不猜、不补 0)。
 *
 * 三条纪律与既有 usage 三态同源:
 *  · 缺字段 = 未知,不折成 0;
 *  · 七类必须齐全且不重复,顺序一律按 `CONTEXT_LEDGER_CATEGORIES` 重排;
 *  · 边界锚点允许 null,但存在时必须形状完整(不造空摘录)。
 */
import {
  BUDGET_STOP_SCOPES,
  CONTEXT_LEDGER_CATEGORIES,
  type BudgetStopScope,
  type CompactBoundary,
  type ContextLedger,
  type ContextLedgerCategory,
  type ContextLedgerCategoryUsage,
  type PreservedSegmentAnchor,
} from '@ihui/shared'
import { dataPayloadOfLine } from './tool-approval-frame'

/** 预算硬停止视图(stopped 帧 / `/budget-stops` 查询行共用)。 */
export interface BudgetStopView {
  /** 原样保留原因码(未知码仍可交给 shared 文案出口回落通用句) */
  reasonCode: string | null
  scope: BudgetStopScope | null
  pillar: string | null
  usagePercent: number | null
  remainingTokens: number | null
  stoppedAtIteration: number | null
  percent: number | null
  usedTokens: number | null
  limitTokens: number | null
  tier: string | null
  resetAt: string | null
  /** 停止时间(查询行可能有 createdAt/stoppedAt,流内帧一般没有) */
  stoppedAt: string | null
}

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value as JsonRecord
}

function finiteNonNegative(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  return value
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

function isBudgetStopScope(value: unknown): value is BudgetStopScope {
  return typeof value === 'string' && (BUDGET_STOP_SCOPES as readonly string[]).includes(value)
}

/**
 * 解析预算停止载荷。`requireStopped=true` 用于流内 budget 帧(只认 stopped 终态);
 * 查询接口的落库行没有 level,传 false。
 * 任一数值非法 ⇒ 该维读作 null(丢弃),不让 NaN/负值上屏。
 */
export function parseBudgetStopData(raw: unknown, requireStopped: boolean): BudgetStopView | null {
  const record = asRecord(raw)
  if (!record) return null
  if (requireStopped && record.level !== 'stopped') return null
  return {
    reasonCode: textOrNull(record.reasonCode) ?? textOrNull(record.reason_code),
    scope: isBudgetStopScope(record.scope) ? record.scope : null,
    pillar: textOrNull(record.pillar),
    usagePercent: finiteNonNegative(record.usagePercent ?? record.usage_percent),
    remainingTokens: finiteNonNegative(record.remainingTokens ?? record.remaining_tokens),
    stoppedAtIteration: finiteNonNegative(record.stoppedAtIteration ?? record.stopped_at_iteration),
    percent: finiteNonNegative(record.percent),
    usedTokens: finiteNonNegative(record.usedTokens ?? record.used_tokens),
    limitTokens: finiteNonNegative(record.limitTokens ?? record.limit_tokens),
    tier: textOrNull(record.tier),
    resetAt: textOrNull(record.resetAt ?? record.reset_at),
    stoppedAt: textOrNull(
      record.stoppedAt ?? record.stopped_at ?? record.createdAt ?? record.created_at,
    ),
  }
}

/**
 * 预算帧 → 终态 state 的唯一更新入口。
 * `stopped` 是终态:后续 warning/critical 帧不满足 requireStopped ⇒ 保留原停止视图,
 * 不允许任何"降级"把停止提示冲掉;新一轮开始时由页面显式 setBudgetStop(null) 清理。
 */
export function applyBudgetStopEvent(
  current: BudgetStopView | null,
  raw: unknown,
): BudgetStopView | null {
  const next = parseBudgetStopData(raw, true)
  return next ?? current
}

const LEDGER_CATEGORY_SET: ReadonlySet<string> = new Set(CONTEXT_LEDGER_CATEGORIES)

function parseLedgerCategoryUsage(raw: unknown): ContextLedgerCategoryUsage | null {
  const record = asRecord(raw)
  if (!record) return null
  if (typeof record.category !== 'string' || !LEDGER_CATEGORY_SET.has(record.category)) return null
  const tokens = finiteNonNegative(record.tokens)
  const percent = finiteNonNegative(record.percent)
  if (tokens === null || percent === null) return null
  return { category: record.category as ContextLedgerCategory, tokens, percent }
}

/**
 * 七类上下文账本。严格形状:
 *  · contextLimit≥0(0=窗口未知,合法)、七类恰 7 条、类别在封闭集且不重复、
 *    tokens/percent 非法即整帧丢弃;
 *  · 返回对象按固定顺序重排(`categories` 顺序即 UI 渲染顺序)。
 */
export function parseContextLedger(raw: unknown): ContextLedger | null {
  const record = asRecord(raw)
  if (!record) return null
  // contextLimit=0 是"窗口未知"的合法账本(ai-service 明确约定),不是缺字段;
  // 因此这里只要求非负有限值,页内在 0 时改显示"窗口未知",不做任何除法。
  const contextLimit = finiteNonNegative(record.contextLimit)
  const usedTokens = finiteNonNegative(record.usedTokens)
  const percentage = finiteNonNegative(record.percentage)
  if (contextLimit === null || usedTokens === null || percentage === null) return null
  if (record.tokenizer !== 'provider_usage' && record.tokenizer !== 'heuristic') return null
  const tokenizer = record.tokenizer
  // 流内帧字段叫 capturedAt;网关查询行沿库表列名回放 createdAt,两者都接受。
  const capturedAt = textOrNull(record.capturedAt ?? record.createdAt ?? record.captured_at)
  if (!capturedAt) return null
  if (!Array.isArray(record.categories)) return null
  const rawCategories = record.categories as unknown[]
  if (rawCategories.length !== CONTEXT_LEDGER_CATEGORIES.length) return null

  const byCategory = new Map<ContextLedgerCategory, ContextLedgerCategoryUsage>()
  for (const item of rawCategories) {
    const usage = parseLedgerCategoryUsage(item)
    if (!usage || byCategory.has(usage.category)) return null
    byCategory.set(usage.category, usage)
  }
  const ordered = CONTEXT_LEDGER_CATEGORIES.map((category) => byCategory.get(category))
  if (ordered.some((item) => item === undefined)) return null

  return {
    model: typeof record.model === 'string' ? record.model : null,
    contextLimit,
    usedTokens,
    percentage,
    categories: ordered.filter((item): item is ContextLedgerCategoryUsage => item !== undefined),
    tokenizer,
    compacted: record.compacted === true,
    capturedAt,
  }
}

/** 查询行:账本 + 审计轮次(turnIndex 随行回放,流内帧没有该字段)。 */
export interface ContextLedgerEntry {
  ledger: ContextLedger
  turnIndex: number | null
}

/** `/context-ledger` 单行:形状合法才返回;turnIndex 非法视作未知(null)。 */
export function parseContextLedgerRow(raw: unknown): ContextLedgerEntry | null {
  const ledger = parseContextLedger(raw)
  if (!ledger) return null
  const record = asRecord(raw)
  const turnIndex = record ? finiteNonNegative(record.turnIndex ?? record.turn_index) : null
  return { ledger, turnIndex }
}

function parsePreservedAnchor(raw: unknown): PreservedSegmentAnchor | null | undefined {
  if (raw === undefined || raw === null) return null
  const record = asRecord(raw)
  if (!record) return undefined
  const index = finiteNonNegative(record.index)
  if (index === null || typeof record.role !== 'string' || typeof record.excerpt !== 'string') {
    return undefined
  }
  const anchor: PreservedSegmentAnchor = { index, role: record.role, excerpt: record.excerpt }
  if (typeof record.messageId === 'string') anchor.messageId = record.messageId
  if (typeof record.digest === 'string') anchor.digest = record.digest
  return anchor
}

/** 压缩边界 + 保留段(头部/锚点/尾部)。形状不认 ⇒ null;锚点存在但残缺 ⇒ 整帧不认。 */
export function parseCompactBoundary(raw: unknown): CompactBoundary | null {
  const record = asRecord(raw)
  if (!record) return null
  const trigger = textOrNull(record.trigger)
  const tokensBefore = finiteNonNegative(record.tokensBefore)
  const tokensAfter = finiteNonNegative(record.tokensAfter)
  const messagesSummarized = finiteNonNegative(record.messagesSummarized)
  if (trigger === null || tokensBefore === null || tokensAfter === null) return null
  if (messagesSummarized === null) return null
  let durationMs: number | null = null
  if (typeof record.durationMs === 'number') {
    const n = finiteNonNegative(record.durationMs)
    if (n === null) return null
    durationMs = n
  }

  const segment = asRecord(record.preservedSegment)
  if (!segment) return null
  const head = parsePreservedAnchor(segment.head)
  const anchor = parsePreservedAnchor(segment.anchor)
  const tail = parsePreservedAnchor(segment.tail)
  if (head === undefined || anchor === undefined || tail === undefined) return null

  let removedRange: CompactBoundary['removedRange'] = null
  if (record.removedRange !== undefined && record.removedRange !== null) {
    const range = asRecord(record.removedRange)
    if (!range) return null
    const startIndex = finiteNonNegative(range.startIndex)
    const endIndex = finiteNonNegative(range.endIndex)
    if (startIndex === null || endIndex === null || endIndex < startIndex) return null
    removedRange = { startIndex, endIndex }
  }

  return {
    trigger,
    tokensBefore,
    tokensAfter,
    messagesSummarized,
    durationMs,
    preservedSegment: { head, anchor, tail },
    removedRange,
  }
}

/** 原始 SSE 行 → usage 帧的 contextLedger;非本帧/形状不认 ⇒ null。 */
export function parseUsageContextLedgerLine(line: string): ContextLedger | null {
  const payload = dataPayloadOfLine(line)
  if (!payload || !payload.includes('"contextLedger"')) return null
  let json: JsonRecord
  try {
    const parsed = JSON.parse(payload) as unknown
    const record = asRecord(parsed)
    if (!record) return null
    json = record
  } catch {
    return null
  }
  if (json.type !== 'usage') return null
  return parseContextLedger(json.contextLedger)
}

/** 原始 SSE 行 → compaction 帧的 boundary;兼容 compaction 嵌套与平铺两种线形。 */
export function parseCompactionBoundaryLine(line: string): CompactBoundary | null {
  const payload = dataPayloadOfLine(line)
  if (!payload || !payload.includes('"boundary"')) return null
  let json: JsonRecord
  try {
    const parsed = JSON.parse(payload) as unknown
    const record = asRecord(parsed)
    if (!record) return null
    json = record
  } catch {
    return null
  }
  const compaction = asRecord(json.compaction)
  if (compaction) {
    if (compaction.triggered !== true) return null
    return parseCompactBoundary(compaction.boundary)
  }
  if (json.type !== 'compaction') return null
  return parseCompactBoundary(json.boundary)
}
