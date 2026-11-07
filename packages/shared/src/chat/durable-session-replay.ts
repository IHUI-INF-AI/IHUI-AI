// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 持久会话回放 — 存储投影，不重放工具。
 *
 * 观察（WorkBuddy @genie/agent-harness 0.2.0-beta.15，安装位
 * G:/workbuddy/resources/app.asar.unpacked，2026-11-07 本机字节）：
 * 会话恢复若带轮次游标，只把已落库的转录切成一页再投影成更新；
 * 不启动执行器。游标类型在对照里是厂商私有串；历史条目上限 20000；
 * 插话必须挂在上一根用户轮的 requestId 上，否则整段拒绝；
 * `before` 是排他上界；`after` 在回放页上被拒绝，在回退边界上却与 before 互斥。
 * 回退后没有存活头消息时，对照把转录换成空数组，调用方分不清「本来就空」和「已被回退」。
 * 超限与转录损坏共用 invalid_history。
 *
 * 本模块复现的是这套行为，类型名与错误码是我们自己的。
 * 超越：
 * 1. 超限单独为 history_too_large，损坏仍是 invalid_history。
 * 2. 回退后无头消息给出 reason=reverted-without-head，不再与空会话混成同一页。
 * 3. 插话失配的 messageId 留在失败体里。
 * 4. 回放游标在同一函数里拒绝未知字段和 after，避免对照里校验层与解析层各认一半。
 */

export const DURABLE_REPLAY_HISTORY_CAP = 20_000

/** 本仓回放游标类型。不沿用对照的厂商私有类型串。 */
export const DURABLE_REPLAY_CURSOR_TYPE = 'ihui.replay/turn' as const

export type DurableReplayCode =
  | 'history_too_large'
  | 'invalid_replay'
  | 'invalid_history'
  | 'cursor_not_found'
  | 'invalid_boundary'

export interface DurableReplayFailure {
  readonly ok: false
  readonly code: DurableReplayCode
  readonly message: string
  readonly cursor?: string
  readonly messageId?: string
}

export type DurableTranscriptKind =
  'user' | 'steer' | 'assistant' | 'tool' | 'custom' | 'terminal' | 'other'

export interface DurableTranscriptItem {
  readonly id: string
  readonly kind: DurableTranscriptKind
  readonly requestId?: string
  readonly rootRequestId?: string
  readonly modelId?: string
  /** 调用方已合计的输入 token。缺省或非法时不产出用量帧。 */
  readonly usedTokens?: number
}

export interface DurableReplayCursor {
  readonly type: typeof DURABLE_REPLAY_CURSOR_TYPE
  readonly last: number
  readonly before?: string
  readonly meta?: Readonly<Record<string, unknown>> | null
}

export interface CanonicalTurn {
  readonly cursor: string
  readonly index: number
  readonly requestId?: string
}

export interface TurnBoundary {
  readonly before?: string
  readonly after?: string
}

export interface RewindHead {
  readonly ok: true
  readonly headMessageId: string | null
  readonly history: readonly DurableTranscriptItem[]
}

export type DurableReplayUpdate =
  | { readonly kind: 'session_info'; readonly title: string }
  | { readonly kind: 'item'; readonly messageId: string }
  | { readonly kind: 'terminal'; readonly messageId: string }
  | {
      readonly kind: 'usage'
      readonly messageId: string
      readonly used: number
      readonly size: number
      readonly requestId: string
      readonly rootRequestId: string
      readonly modelId?: string
    }

export interface DurableReplayWindow {
  readonly ok: true
  readonly kind: 'window'
  readonly history: readonly DurableTranscriptItem[]
  readonly startCursor: string | null
  readonly endCursor: string | null
  readonly hasPreviousPage: boolean
  readonly hasNextPage: boolean
  readonly updates: readonly DurableReplayUpdate[]
}

export interface DurableReplaySkip {
  readonly ok: true
  readonly kind: 'skip'
  readonly reason: 'no-cursor'
}

export interface DurableReplayEmpty {
  readonly ok: true
  readonly kind: 'empty'
  readonly reason: 'reverted-without-head'
  readonly updates: readonly DurableReplayUpdate[]
}

export type DurableReplayPlan =
  DurableReplaySkip | DurableReplayEmpty | DurableReplayWindow | DurableReplayFailure

export interface DurableReplayRequest {
  readonly items: readonly DurableTranscriptItem[]
  readonly replayFrom?: unknown
  readonly conversationReverted?: boolean
  readonly lastMessageId?: string
  readonly title?: string
  readonly contextSize?: (modelId: string | undefined) => number | undefined
}

export interface ChatMessageReplaySource {
  readonly id: string
  readonly role: string
  readonly tokens: number | null
  readonly metadata: Readonly<Record<string, unknown>> | null
}

const CURSOR_KEYS = new Set(['type', 'last', 'before', 'meta'])

function fail(
  code: DurableReplayCode,
  message: string,
  extra?: { readonly cursor?: string; readonly messageId?: string },
): DurableReplayFailure {
  return { ok: false, code, message, ...extra }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isCursor(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function historyTooLarge(count: number): DurableReplayFailure {
  return fail(
    'history_too_large',
    `会话转录超过 ${DURABLE_REPLAY_HISTORY_CAP} 条（当前 ${count}），先压缩再回放`,
  )
}

function titleUpdates(title: string | undefined): DurableReplayUpdate[] {
  return isCursor(title) ? [{ kind: 'session_info', title }] : []
}

export function parseReplayCursor(
  input: unknown,
): { readonly ok: true; readonly cursor: DurableReplayCursor } | DurableReplayFailure {
  if (!isRecord(input) || input.type !== DURABLE_REPLAY_CURSOR_TYPE) {
    return fail('invalid_replay', `replayFrom.type 必须是 ${DURABLE_REPLAY_CURSOR_TYPE}`)
  }
  if (Object.hasOwn(input, 'after')) {
    return fail('invalid_replay', '回放页不接受 replayFrom.after')
  }
  const unknownField = Object.keys(input).find((key) => !CURSOR_KEYS.has(key))
  if (unknownField !== undefined) {
    return fail('invalid_replay', `replayFrom 含不支持的字段 ${unknownField}`)
  }
  if (!Number.isSafeInteger(input.last) || (input.last as number) <= 0) {
    return fail('invalid_replay', 'replayFrom.last 必须是正整数')
  }
  if (Object.hasOwn(input, 'before') && !isCursor(input.before)) {
    return fail('invalid_replay', 'replayFrom.before 必须是非空字符串')
  }
  if (Object.hasOwn(input, 'meta') && input.meta !== null && !isRecord(input.meta)) {
    return fail('invalid_replay', 'replayFrom.meta 必须是对象或 null')
  }
  const cursor: DurableReplayCursor = {
    type: DURABLE_REPLAY_CURSOR_TYPE,
    last: input.last as number,
    ...(isCursor(input.before) ? { before: input.before } : {}),
    ...(Object.hasOwn(input, 'meta')
      ? { meta: input.meta as Readonly<Record<string, unknown>> | null }
      : {}),
  }
  return { ok: true, cursor }
}

export function indexCanonicalTurns(
  items: readonly DurableTranscriptItem[],
): { readonly ok: true; readonly turns: readonly CanonicalTurn[] } | DurableReplayFailure {
  const turns: CanonicalTurn[] = []
  const seen = new Set<string>()
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    if (item === undefined) continue
    if (item.kind === 'steer') {
      const previous = turns.at(-1)?.requestId
      if (previous === undefined || item.requestId !== previous) {
        return fail('invalid_history', `插话 ${item.id} 的 requestId 与上一根用户轮不一致`, {
          messageId: item.id,
        })
      }
      continue
    }
    if (item.kind !== 'user') continue
    if (!isCursor(item.id)) {
      return fail('invalid_history', '可见用户轮缺少 messageId', { messageId: item.id })
    }
    if (seen.has(item.id)) {
      return fail('invalid_history', `用户轮 messageId 被重复使用: ${item.id}`, {
        messageId: item.id,
      })
    }
    seen.add(item.id)
    turns.push({
      cursor: item.id,
      index,
      ...(isCursor(item.requestId) ? { requestId: item.requestId } : {}),
    })
  }
  return { ok: true, turns }
}

function turnIndex(turns: readonly CanonicalTurn[], cursor: string): number | DurableReplayFailure {
  const found = turns.findIndex((turn) => turn.cursor === cursor)
  if (found < 0) {
    return fail('cursor_not_found', `活动会话里找不到用户轮 ${cursor}`, { cursor })
  }
  return found
}

export function selectRewindHead(
  items: readonly DurableTranscriptItem[],
  boundary?: TurnBoundary | null,
): RewindHead | DurableReplayFailure {
  if (items.length > DURABLE_REPLAY_HISTORY_CAP) return historyTooLarge(items.length)
  if (boundary !== null && boundary !== undefined) {
    const hasBefore = isCursor(boundary.before)
    const hasAfter = isCursor(boundary.after)
    if (hasBefore === hasAfter) {
      return fail('invalid_boundary', '回退边界必须且只能给出 before 或 after 其中一个')
    }
  }
  const indexed = indexCanonicalTurns(items)
  if (!indexed.ok) return indexed
  let cut = items.length
  if (boundary !== null && boundary !== undefined) {
    if (isCursor(boundary.before)) {
      const at = turnIndex(indexed.turns, boundary.before)
      if (typeof at !== 'number') return at
      cut = indexed.turns[at]?.index ?? items.length
    } else if (isCursor(boundary.after)) {
      const at = turnIndex(indexed.turns, boundary.after)
      if (typeof at !== 'number') return at
      cut = indexed.turns[at + 1]?.index ?? items.length
    }
  }
  const history = items.slice(0, cut)
  let headMessageId: string | null = null
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const item = history[index]
    if (item !== undefined && isCursor(item.id) && item.kind !== 'custom') {
      headMessageId = item.id
      break
    }
  }
  return { ok: true, headMessageId, history }
}

function pageFromTurns(
  items: readonly DurableTranscriptItem[],
  turns: readonly CanonicalTurn[],
  cursor: DurableReplayCursor,
):
  | {
      readonly history: readonly DurableTranscriptItem[]
      readonly startCursor: string | null
      readonly endCursor: string | null
      readonly hasPreviousPage: boolean
      readonly hasNextPage: boolean
    }
  | DurableReplayFailure {
  const end = isCursor(cursor.before) ? turnIndex(turns, cursor.before) : turns.length
  if (typeof end !== 'number') return end
  const startTurn = Math.max(0, end - cursor.last)
  const window = turns.slice(startTurn, end)
  if (window.length === 0) {
    return {
      history: [],
      startCursor: null,
      endCursor: null,
      hasPreviousPage: false,
      hasNextPage: end < turns.length,
    }
  }
  const startIndex = window[0]?.index ?? 0
  const endIndex = turns[end]?.index ?? items.length
  const last = window[window.length - 1]
  return {
    history: items.slice(startIndex, endIndex),
    startCursor: window[0]?.cursor ?? null,
    endCursor: last?.cursor ?? null,
    hasPreviousPage: startTurn > 0,
    hasNextPage: end < turns.length,
  }
}

function projectUpdates(
  history: readonly DurableTranscriptItem[],
  contextSize: DurableReplayRequest['contextSize'],
): DurableReplayUpdate[] {
  const updates: DurableReplayUpdate[] = []
  for (const item of history) {
    if (item.kind === 'terminal') {
      updates.push({ kind: 'terminal', messageId: item.id })
      continue
    }
    updates.push({ kind: 'item', messageId: item.id })
    if (contextSize === undefined) continue
    if (
      typeof item.usedTokens !== 'number' ||
      !Number.isFinite(item.usedTokens) ||
      item.usedTokens < 0
    ) {
      continue
    }
    if (!isCursor(item.requestId)) continue
    const size = contextSize(item.modelId)
    if (typeof size !== 'number' || !Number.isFinite(size)) continue
    const rootRequestId = isCursor(item.rootRequestId) ? item.rootRequestId : item.requestId
    updates.push({
      kind: 'usage',
      messageId: item.id,
      used: item.usedTokens,
      size,
      requestId: item.requestId,
      rootRequestId,
      ...(isCursor(item.modelId) ? { modelId: item.modelId } : {}),
    })
  }
  return updates
}

export function planDurableSessionReplay(request: DurableReplayRequest): DurableReplayPlan {
  if (request.replayFrom === null || request.replayFrom === undefined) {
    return { ok: true, kind: 'skip', reason: 'no-cursor' }
  }
  if (request.items.length > DURABLE_REPLAY_HISTORY_CAP)
    return historyTooLarge(request.items.length)
  const parsed = parseReplayCursor(request.replayFrom)
  if (!parsed.ok) return parsed
  const reverted = request.conversationReverted === true && !isCursor(request.lastMessageId)
  if (reverted) {
    if (parsed.cursor.before !== undefined) {
      return fail('cursor_not_found', `回退后的会话里找不到用户轮 ${parsed.cursor.before}`, {
        cursor: parsed.cursor.before,
      })
    }
    return {
      ok: true,
      kind: 'empty',
      reason: 'reverted-without-head',
      updates: titleUpdates(request.title),
    }
  }
  const indexed = indexCanonicalTurns(request.items)
  if (!indexed.ok) return indexed
  const page = pageFromTurns(request.items, indexed.turns, parsed.cursor)
  if (!('history' in page)) return page
  return {
    ok: true,
    kind: 'window',
    history: page.history,
    startCursor: page.startCursor,
    endCursor: page.endCursor,
    hasPreviousPage: page.hasPreviousPage,
    hasNextPage: page.hasNextPage,
    updates: [...titleUpdates(request.title), ...projectUpdates(page.history, request.contextSize)],
  }
}

function metaString(
  metadata: Readonly<Record<string, unknown>> | null,
  key: string,
): string | undefined {
  const value = metadata?.[key]
  return isCursor(value) ? value : undefined
}

/** 把会话消息收成回放条目。插话 / 终态 / 自定义只认 metadata 上的布尔，猜不到就按 role。 */
export function chatMessageToDurableItem(message: ChatMessageReplaySource): DurableTranscriptItem {
  const metadata = message.metadata
  const steer = message.role === 'user' && metadata?.steer === true
  const terminal = metadata?.terminal === true
  const custom = metadata?.custom === true
  let kind: DurableTranscriptKind = 'other'
  if (terminal) kind = 'terminal'
  else if (custom) kind = 'custom'
  else if (steer) kind = 'steer'
  else if (message.role === 'user') kind = 'user'
  else if (message.role === 'assistant') kind = 'assistant'
  else if (message.role === 'tool') kind = 'tool'
  const used =
    typeof message.tokens === 'number' && Number.isFinite(message.tokens) && message.tokens >= 0
      ? message.tokens
      : undefined
  const requestId = metaString(metadata, 'requestId')
  const rootRequestId = metaString(metadata, 'rootRequestId')
  const modelId = metaString(metadata, 'modelId')
  return {
    id: message.id,
    kind,
    ...(requestId !== undefined ? { requestId } : {}),
    ...(rootRequestId !== undefined ? { rootRequestId } : {}),
    ...(modelId !== undefined ? { modelId } : {}),
    ...(used !== undefined ? { usedTokens: used } : {}),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
