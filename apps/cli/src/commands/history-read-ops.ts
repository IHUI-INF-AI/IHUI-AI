// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * D35 long-session projection — CLI consumer (2026-09-27).
 *
 * WHAT THIS IS: the first runnable consumer of the turn-sharded history
 * endpoint. Before it, the projection layer had exactly one importer —
 * `apps/web/src/hooks/use-chat-history-projection.ts` — and that hook has no
 * mount (the web infinite-scroll landing point is still an open ticket, and
 * `MessageList.tsx` is a shared-workspace hot file). "At least one production
 * importer" was therefore satisfiable while nothing on any screen ever read a
 * projected page. This module drives the same shared functions from a command
 * that can be executed and measured today.
 *
 * NO PAGINATION ARITHMETIC LIVES HERE: cursor 编解码、limit 夹取、整轮替换、
 * 边界推导、断点存续性与投影状态种子全部来自 `@ihui/shared/chat`(AGENTS §3
 * 单一真值)。本模块只排请求顺序并累计字节 —— 在这里重写一份分页算术,正是
 * 共享层测试里"全仓只有一份投影实现"那条锁要拦的东西。
 *
 * OUTPUT IS ASCII-ONLY ON PURPOSE: `scripts/scan-hardcoded-zh.mjs` ratchets new
 * Chinese literals under apps/cli/src, and a diagnostic command is not worth a
 * five-locale word table. User-facing prose stays with the helpers sibling
 * subcommands already use (missingTokenHint / printJson / handleError).
 */

import type { ApiResult } from '@ihui/types'
import {
  getConversationHistory,
  type GetConversationHistoryParams,
  type ConversationHistoryResult,
  type ConversationMessage,
} from '@ihui/api-client'
import {
  clampHistoryLimit,
  foldHistoryPageIntoProjection,
  isHistoryCursorStale,
  isHistoryPageExhausted,
  projectHistoryPage,
  resolveHistoryRolloutSeed,
  type HistoryBoundary,
  type HistoryCursorState,
  type HistoryPageWire,
  type HistoryProjection,
  type HistoryTurnDirection,
  type HistoryTurnWire,
} from '@ihui/shared/chat'

/** api-client `getConversationHistory` 的签名别名:测试注入假传输就换它。 */
type HistoryFetch = (
  conversationId: string,
  params?: GetConversationHistoryParams,
) => Promise<ApiResult<ConversationHistoryResult>>

/** 一页里真正收到的量(逐页留痕,这就是"页与页之间没有重复下载"的证据)。 */
export interface HistoryPageMetric {
  direction: HistoryTurnDirection
  turns: number
  messages: number
  bytes: number
}

/**
 * 一次读取的计量。`receivedBytes` 是**从响应里收到的正文 UTF-8 字节数**(按请求累计),
 * 不是投影后时间线的字节数 —— 增量回放要证明的是"第二次没有把旧内容再下一遍",
 * 只有收流量能说这句话;时间线字节数在整轮替换下本来就只增不减,拿它当证据是空的。
 */
export interface HistoryTally {
  requests: number
  receivedTurns: number
  receivedMessages: number
  receivedBytes: number
}

/** 每页 turn 数上限:与服务端 `historyListSchema.maximum` 同值(越界由服务端 400)。 */
export const HISTORY_TURNS_PER_PAGE_MAX = 100
/** 一次最多翻多少页(默认 20 页 × 100 轮),防失控护栏而不是性能预算。 */
export const HISTORY_MAX_PAGES_DEFAULT = 20

export type HistoryReadStop =
  | 'exhausted'
  | 'max-pages'
  | 'stale-cursor'
  | 'no-start'
  | 'not-found'
  | 'denied'
  | 'failed'

export interface HistoryReadOutcome {
  /** false = 请求失败 / 断点已死 / 没有可用起点。`projection` 始终是"已拿到的部分"。 */
  ok: boolean
  projection: HistoryProjection<ConversationMessage>
  /** 服务端 rollout 断点原样透传(resume 的起点由它推)。 */
  projectionState: unknown
  /** 服务端断点存续性结论;null = 本次没有任何一页给过结论(不等于"断点是好的")。 */
  cursorState: HistoryCursorState | null
  tally: HistoryTally
  perPage: HistoryPageMetric[]
  stop: HistoryReadStop
  /** ApiResult 的失败原因/状态码;成功为 null。 */
  error: string | null
  status: number | null
}

export function emptyHistoryTally(): HistoryTally {
  return { requests: 0, receivedTurns: 0, receivedMessages: 0, receivedBytes: 0 }
}

/** 正文按 UTF-8 计的字节数 —— 与写入侧 `rollHistoryProjection` 的断点同一量纲。 */
export function messageContentBytes(message: ConversationMessage): number {
  return Buffer.byteLength(message.content, 'utf8')
}

/** 两笔计量的差;`resume` 之后报这一条,它才是"增量"的可核验定义。 */
export function historyTallyDelta(before: HistoryTally, after: HistoryTally): HistoryTally {
  return {
    requests: after.requests - before.requests,
    receivedTurns: after.receivedTurns - before.receivedTurns,
    receivedMessages: after.receivedMessages - before.receivedMessages,
    receivedBytes: after.receivedBytes - before.receivedBytes,
  }
}

/** 两段计量的和(首屏 + 续读 = 整条会话的收流量),给 `historyTallyDelta` 当被减数用。 */
export function addHistoryTally(a: HistoryTally, b: HistoryTally): HistoryTally {
  return {
    requests: a.requests + b.requests,
    receivedTurns: a.receivedTurns + b.receivedTurns,
    receivedMessages: a.receivedMessages + b.receivedMessages,
    receivedBytes: a.receivedBytes + b.receivedBytes,
  }
}

function turnMessageCount(turns: readonly HistoryTurnWire<ConversationMessage>[]): number {
  let n = 0
  for (const turn of turns) n += turn.messages.length
  return n
}

function turnBytes(turns: readonly HistoryTurnWire<ConversationMessage>[]): number {
  let bytes = 0
  for (const turn of turns) {
    for (const m of turn.messages) bytes += messageContentBytes(m)
  }
  return bytes
}

const EMPTY_BOUNDARY: HistoryBoundary = {
  hasOlder: false,
  hasNewer: false,
  olderCursor: null,
  newerCursor: null,
  oldestTurnOrdinal: null,
  newestTurnOrdinal: null,
}

/** 一页未取时的投影;唯一构造点(各分支各写一份字面量必然漏字段)。 */
export function emptyHistoryProjection(): HistoryProjection<ConversationMessage> {
  return { turns: [], droppedUnordained: 0, replacedTurns: 0, boundary: EMPTY_BOUNDARY }
}

export interface ReadConversationHistoryInput {
  conversationId: string
  /** 每页 turn 数;先过共享层 `clampHistoryLimit`,不发注定 400 的请求。缺省取服务端上限。 */
  turnsPerPage?: number
  maxPages?: number
  fetchPage?: HistoryFetch
}

export interface ResumeConversationHistoryInput extends ReadConversationHistoryInput {
  /** 上次读取的结果(时间线 + 服务端断点)。断点缺失或倒退 ⇒ 不发起任何请求。 */
  previous: HistoryReadOutcome
}

/**
 * 服务端在 HEAD 就已经回传 `cursorState`(`apps/api/src/routes/chat.ts:832` 取自
 * `chat-queries.ts:840` 的 `evaluateHistoryCursorState`),而 `@ihui/api-client` 的
 * `ConversationHistoryResult` **还没把这个字段补进类型** —— 于是"本机 typecheck 绿、CI 红"
 * (本机绿只是因为工作树里那份类型文件被另一个会话改过而未提交)。这里在**消费侧**做交叉类型
 * 声明而不是去改别人的包:字段缺席时按 null 处理(null 的语义本来就是"本次没有任何一页给过结论"),
 * 等那边把字段补进类型后这个交叉声明自动退化成冗余,调用点一字不改。
 */
type HistoryPageSource = ConversationHistoryResult & { cursorState?: HistoryCursorState | null }

function toWirePage(
  res: HistoryPageSource,
  limit: number,
): HistoryPageWire<ConversationMessage> {
  return {
    turns: res.turns.map((t) => ({ turnOrdinal: t.turnOrdinal, messages: t.messages })),
    limit,
    hasMore: res.hasMore,
    nextCursor: res.nextCursor,
    projectionState: res.projectionState,
    cursorState: res.cursorState ?? null,
  }
}

/**
 * 首屏 + 上翻回填:最新一页 → 按服务端 nextCursor 往 `older` 翻,直到服务端说没有更早
 * 或到 maxPages。重叠页由 `foldHistoryPageIntoProjection`(内含 mergeHistoryTurnPages
 * 的整轮替换)折叠 ⇒ 重放同一页是幂等的,且时间线首末轮始终描述整条已读区间。
 */
export async function readConversationHistory(
  input: ReadConversationHistoryInput,
): Promise<HistoryReadOutcome> {
  const limit = clampHistoryLimit(input.turnsPerPage ?? HISTORY_TURNS_PER_PAGE_MAX)
  const state = newLoopState(input, limit, 'full')
  return runLoop(state, { direction: 'newest', cursor: null })
}

/**
 * 增量回放:起点取服务端 rollout 断点(`resolveHistoryRolloutSeed`),方向 `newer`,
 * 只取断点**之后**的轮次。没有可用断点(尚未投影 / 断点倒退)时**一个请求都不发** ——
 * 那种情形下任何"续读"都是全量重拉换了个说法,发出去才是事故。
 * 返回的 tally 只计本次新增,与 `previous.tally` 一比就是"没有全量重传"的证据。
 */
export async function resumeConversationHistory(
  input: ResumeConversationHistoryInput,
): Promise<HistoryReadOutcome> {
  const limit = clampHistoryLimit(input.turnsPerPage ?? HISTORY_TURNS_PER_PAGE_MAX)
  const seed = resolveHistoryRolloutSeed(input.previous.projectionState, null)
  if (!seed.cursor) {
    return {
      ok: false,
      projection: input.previous.projection,
      projectionState: input.previous.projectionState,
      cursorState: input.previous.cursorState,
      tally: emptyHistoryTally(),
      perPage: [],
      stop: 'no-start',
      error: 'no usable rollout breakpoint to resume from',
      status: null,
    }
  }
  const state = newLoopState(input, limit, 'resume', input.previous.projection)
  return runLoop(state, { direction: 'newer', cursor: seed.cursor })
}

/** 续读起点的对外出口(命令与测试都经它,别处不得自己拼 base64url 断点)。 */
export function historyResumeCursor(projectionState: unknown): string | null {
  return resolveHistoryRolloutSeed(projectionState, null).cursor
}

interface LoopState {
  conversationId: string
  limit: number
  maxPages: number
  fetchPage: HistoryFetch
  mode: 'full' | 'resume'
  projection: HistoryProjection<ConversationMessage>
  projectionState: unknown
  cursorState: HistoryCursorState | null
  tally: HistoryTally
  perPage: HistoryPageMetric[]
  pendingFirstPage: boolean
}

function newLoopState(
  input: ReadConversationHistoryInput,
  limit: number,
  mode: 'full' | 'resume',
  initial?: HistoryProjection<ConversationMessage>,
): LoopState {
  return {
    conversationId: input.conversationId,
    limit,
    maxPages: Math.max(1, Math.trunc(input.maxPages ?? HISTORY_MAX_PAGES_DEFAULT)),
    fetchPage: input.fetchPage ?? getConversationHistory,
    mode,
    projection: initial ?? emptyHistoryProjection(),
    projectionState: null,
    cursorState: null,
    tally: emptyHistoryTally(),
    perPage: [],
    pendingFirstPage: true,
  }
}

async function runLoop(
  state: LoopState,
  first: { direction: HistoryTurnDirection; cursor: string | null },
): Promise<HistoryReadOutcome> {
  let request = first
  for (let page = 0; page < state.maxPages; page += 1) {
    const res = await state.fetchPage(state.conversationId, {
      limit: state.limit,
      ...(request.cursor ? { cursor: request.cursor } : {}),
      direction: request.direction,
    })
    state.tally = { ...state.tally, requests: state.tally.requests + 1 }
    if (!res.success) {
      // 403/404 立刻停:归属判定在服务端 SQL 上,消费侧继续翻页只是重复撞墙。
      const stop: HistoryReadStop = res.status === 404 ? 'not-found' : res.status === 403 ? 'denied' : 'failed'
      return {
        ...finalize(state, stop),
        ok: false,
        error: res.error,
        status: typeof res.status === 'number' ? res.status : null,
      }
    }
    const wire = toWirePage(res.data, state.limit)
    state.projectionState = wire.projectionState
    state.cursorState = wire.cursorState ?? null
    const pageTurns = wire.turns.length
    const pageMessages = turnMessageCount(wire.turns)
    const pageBytes = turnBytes(wire.turns)
    state.tally = {
      requests: state.tally.requests,
      receivedTurns: state.tally.receivedTurns + pageTurns,
      receivedMessages: state.tally.receivedMessages + pageMessages,
      receivedBytes: state.tally.receivedBytes + pageBytes,
    }
    state.perPage = [
      ...state.perPage,
      { direction: request.direction, turns: pageTurns, messages: pageMessages, bytes: pageBytes },
    ]
    if (isHistoryCursorStale(wire.cursorState)) {
      // 服务端此时给的就是空页;并进去不会算错,但**绝不能**再拿它的游标往下翻。
      return finalize(state, 'stale-cursor')
    }

    const foldFirstPage = state.pendingFirstPage && state.mode === 'full'
    state.pendingFirstPage = false
    state.projection = foldFirstPage
      ? projectHistoryPage<ConversationMessage>(wire, 'newest')
      : foldHistoryPageIntoProjection<ConversationMessage>(state.projection, wire, request.direction)

    if (isHistoryPageExhausted(wire) || !wire.hasMore || !wire.nextCursor) {
      return finalize(state, 'exhausted')
    }
    request = {
      direction: state.mode === 'full' ? 'older' : 'newer',
      cursor: wire.nextCursor,
    }
  }
  return finalize(state, 'max-pages')
}

function finalize(state: LoopState, stop: HistoryReadStop): HistoryReadOutcome {
  return {
    ok: stop === 'exhausted' || stop === 'max-pages',
    projection: state.projection,
    projectionState: state.projectionState,
    cursorState: state.cursorState,
    tally: state.tally,
    perPage: state.perPage,
    stop,
    error: null,
    status: null,
  }
}

/** 单行 ASCII 计量;label 由调用方给('initial' / 'resume' / 'delta')。 */
export function formatHistoryTallyLine(label: string, t: HistoryTally): string {
  return `history[${label}] requests=${t.requests} turns=${t.receivedTurns} messages=${t.receivedMessages} bytes=${t.receivedBytes}`
}

export function formatHistoryPageLine(index: number, p: HistoryPageMetric): string {
  return `history page ${index + 1}: direction=${p.direction} turns=${p.turns} messages=${p.messages} bytes=${p.bytes}`
}

export function formatHistorySummaryLine(o: HistoryReadOutcome): string {
  const b = o.projection.boundary
  const errorPart = o.error ? ` error=${o.error}` : ''
  const statusPart = o.status !== null ? ` status=${o.status}` : ''
  return `history ok=${o.ok} stop=${o.stop} turns=${o.projection.turns.length} span=${String(b.oldestTurnOrdinal)}..${String(b.newestTurnOrdinal)} dropped=${o.projection.droppedUnordained} replaced=${o.projection.replacedTurns} bytes=${o.tally.receivedBytes}${errorPart}${statusPart}`
}

/**
 * 增量回放的**对账行**:分子是续读实际收下的字节,分母是"整段重取要付多少"
 * (取首屏那一批请求的收流量 —— 那是同一批正文在没有断点时的真实代价)。
 *
 * 为什么不能只打印续读计量就宣称"没有全量重传":`requests=1` 与
 * `bytes=0` 都能被"服务端把整段又发了一遍"伪装出来 —— 只有把两次放同一个式子
 * 里,读的人才看得见差额。saved=100% 是"确实一个新轮都没多",不是bug。
 */
export function formatHistoryReplayCheckLine(
  resumed: HistoryTally,
  initial: HistoryTally,
): { readonly line: string; readonly savedRatio: number } {
  const full = initial.receivedBytes
  const got = resumed.receivedBytes
  const savedRatio = full > 0 ? 1 - got / full : got === 0 ? 1 : 0
  const pct = Math.round(savedRatio * 1000) / 10
  return {
    line: `history[replay] incrementalBytes=${got} fullRefetchBytes=${full} saved=${pct}% resumedTurns=${resumed.receivedTurns}`,
    savedRatio,
  }
}
