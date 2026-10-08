// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type {
  ToolCallEvent,
  ToolSummaryEvent,
  FallbackEvent,
  ToolDelegateEvent,
  SubagentSpawnEvent,
  SubagentEndEvent,
  SubagentProgressEvent,
  CitationsEvent,
  SteerEvent,
  BudgetEvent,
  InjectionAppliedEvent,
  RetryScheduledEvent,
  /** 终端实时输出增量(api-client 2026-09-18 立,本解析器 D19-A1 才接上) */
  TerminalDeltaEvent,
  /** 文件写类工具流中 diff 预览(api-client 2026-09-27 立 D113,本解析器同批接上) */
  ToolDeltaEvent,
  /** 命令在等键盘输入(api-client 2026-09-29 立 D151,本解析器同批接上) */
  TerminalInteractionEvent,
  GoalUpdateEvent,
} from '@ihui/api-client'
import type { PlanUpdateEvent, TerminalStartEvent, TerminalEndEvent } from '@ihui/types'

// D174(2026-09-30 立):帧级 traceId 的键名与归一规则只有一份,住在 SSE 契约层
// (`sse/contract.ts`,与 Python 侧 `core/sse_contract.py` + `core/trace_context.py` 对应)。
// 本解析器不另写一遍 hex/全 0 判据 —— 两处算同一件事必漂移,而漂开的表现是"有的帧的
// trace 被采信、有的被判废",排查时最难归因。
import { normalizeSSEFrameTraceId, SSE_TRACE_ID_PAYLOAD_KEY } from '../sse/contract'

/**
 * SSE 事件对象。
 *
 * W5 扩展:事件类型由 6 类补齐至 18 类,与 @ihui/api-client client.ts 的
 * streamChat 事件契约严格对齐。复合事件(工具调用 / subagent / 计划 / 终端)
 * 统一以嵌套对象承载,其类型直接复用 @ihui/api-client / @ihui/types,
 * 不在此处二次定义,避免跨端字段漂移。
 */
export interface SSEEvent {
  type:
    | 'chunk'
    | 'done'
    | 'error'
    | 'reasoning'
    | 'meta'
    | 'compaction'
    // W5 新增事件类型(对齐 @ihui/api-client 的 streamChat 线上契约)
    | 'fallback'
    | 'usage'
    | 'tool-call-start'
    | 'tool-result'
    | 'subagent_spawn'
    | 'subagent_progress'
    | 'subagent_end'
    | 'tool-summary'
    | 'tool-delegate'
    | 'plan_updated'
    | 'terminal_start'
    | 'terminal_end'
    // #11 Citations 全链路(2026-09-13 立):knowledge_lookup 工具执行后下发引用溯源
    | 'citations'
    // ===== D106 补齐(2026-09-22 立):api-client 早已解析、本解析器漏接的四帧 =====
    | 'steer'
    | 'budget'
    | 'injection_applied'
    | 'retry_scheduled'
    // ===== D19-A1(2026-09-24 立):终端实时输出增量帧 =====
    // 后端 mcp_server._emit_terminal_delta 产的帧**带 text、不带 content/delta**,
    // 在下方兜底抽取链之前无人认领 ⇒ 曾被判成 chunk,把 stdout 混进聊天正文。
    // 本类型**只消污染**:跨端渲染接线属另一票(mobile-rn 注册 + 契约对账)。
    | 'terminal_delta'
    // ===== D113(2026-09-27 立):文件写类工具流中 diff 预览帧 =====
    // 后端 tool-delta 载荷是 {toolCallId, seq, partialText, truncated?} —— 既不带 content
    // 也不带 delta/text,在本兜底抽取链之前无人认领,一路走到函数末尾 `return null`
    // ⇒ **帧能到设备却被静默丢掉**(api-client 那条链 2026-09-27 已解析,小程序端因此
    // 与 web/RN 不同源:工具跑完才看得到改了什么)。本变体只补这一格,渲染接线在端内票。
    | 'tool-delta'
    // ===== D151(2026-09-29 立):命令在等键盘输入的一帧 =====
    // 此前它在本解析链上**无人认领**,被下面 `sessionId` 那条泛化兜底折成 meta ⇒
    // 小程序端拿不到 terminalId/提示原文,结构上不可能显示"它在等人"(见函数体内的认领注释)。
    | 'terminal_interaction'
    // ===== D152(2026-09-29 立):会话目标(goal)状态的一帧 =====
    // 载荷 {sessionId, status, objective?, elapsedMs?, tokenUsage?, updatedAt?} ——
    // 带字符串 sessionId 而**不带 content/delta/text**,不认领就会一路走到下面那条
    // `typeof json?.sessionId === 'string' ⇒ {type:'meta', sessionId}` 的泛化兜底,
    // 状态与目标原文整帧丢失(terminal_delta=D19-A1、tool-delta=D113、
    // terminal_interaction=D151 同型三次;判据 scripts/check-sse-parser-parity.mjs)。
    | 'goal_updated'
    // ===== G-815976(2026-10-04 收口入契约):流式中断标记帧 =====
    // llm_gateway astream 异常中断且已发过 chunk 时发出(此后流终止,不会有 done)。
    // 载荷 {fallback_applied, reason, model?} —— 不带 content/delta/text,不认领会
    // 被静默丢掉 ⇒ 小程序端半截回答与完整回答完全同形(与 api-client 的
    // onPartialDone 同一帧,两端解析必须同源,判据 scripts/check-sse-parser-parity.mjs)。
    | 'partial_done'
  content?: string
  sessionId?: string
  /**
   * D174(2026-09-30 立):帧级 trace id(小写 32 hex)。**由认领链最外层统一挂回**,
   * 见下方 `parseLine` 的注入注释 —— 内层各分支不得自己再挂一遍。
   *
   * 缺席 = 本轮服务端没有有效 trace(**不是**空串、**不是** null),消费侧按
   * `typeof === 'string'` 判。它是关联键,不是授权凭据(值来自客户端可自写的
   * `traceparent` 头)—— 归属/权限判定不得读它。
   */
  traceId?: string
  /** 错误码(对齐 @ihui/api-client SSEErrorInfo 字段) */
  code?: number
  errorCode?: string
  retryAfter?: number
  /** 上下文自动压缩事件字段(对齐后端 SSE compaction 事件) */
  compaction?: {
    triggered: true
    tokensBefore: number
    tokensAfter: number
    removedCount: number
    usageRatio: number
    /** G-150:incompressible = 压缩已撞到上限,界面须改口径并给"开新对话"出口 */
    trigger?: string
  }
  /** done 事件携带的 token 用量(对标原 ai_assistant.vue total_tokens,ai-service event:done 下发)。
   *  G-403(2026-10-07):cacheReadTokens/cacheWriteTokens 三态(数字=真回报含 0;null/缺席=未采到),
   *  与 api-client UsageEvent、shared sse contract 的 usage 帧同口径 —— 绝不许把"没采到"写成 0。 */
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
    cacheReadTokens?: number | null
    cacheWriteTokens?: number | null
  }
  /** done 事件携带的模型名 */
  model?: string
  // ===== W5 新增事件负载(类型复用 @ihui/api-client / @ihui/types) =====
  /** fallback 事件:主模型失败切换到备用模型 */
  fallback?: FallbackEvent
  /** 工具调用事件(tool-call-start / tool-result 共用) */
  toolCall?: ToolCallEvent
  /** subagent 派发事件 */
  subagentSpawn?: SubagentSpawnEvent
  /** subagent 执行进度事件 */
  subagentProgress?: SubagentProgressEvent
  /** subagent 执行结束事件 */
  subagentEnd?: SubagentEndEvent
  /** 工具调用汇总事件 */
  toolSummary?: ToolSummaryEvent
  /** 工具委托执行事件(前端本地工具代理) */
  toolDelegate?: ToolDelegateEvent
  /** 计划更新事件(plan_updated) */
  planUpdate?: PlanUpdateEvent
  /** 终端任务开始事件 */
  terminalStart?: TerminalStartEvent
  /** 终端任务结束事件 */
  terminalEnd?: TerminalEndEvent
  /** #11 Citations 全链路:引用溯源事件(knowledge_lookup 工具执行后下发) */
  citations?: CitationsEvent
  // ===== D106 补齐:api-client 早已解析、本解析器漏接的四帧(小程序侧因此静默丢帧) =====
  /** Steer 中途引导确认帧(steer) */
  steer?: SteerEvent
  /** 网关预算分档提醒帧(budget) */
  budget?: BudgetEvent
  /** D34 上下文注入交代帧(injection_applied) */
  injectionApplied?: InjectionAppliedEvent
  /** D39 重试交代帧(retry_scheduled) */
  retryScheduled?: RetryScheduledEvent
  /** D19-A1 终端实时输出增量帧(terminal_delta):字段口径与 api-client tryParseTerminalDelta 一致 */
  terminalDelta?: TerminalDeltaEvent
  /** D113 工具流中 diff 预览帧(tool-delta):字段口径与 api-client tryParseToolDelta 一致 */
  toolDelta?: ToolDeltaEvent
  /** D151 命令在等键盘输入(terminal_interaction):字段口径与 api-client tryParseTerminalInteraction 一致 */
  terminalInteraction?: TerminalInteractionEvent
  /** D152 会话目标状态(goal_updated):字段口径与 api-client tryParseGoalUpdate 一致 */
  goalUpdated?: GoalUpdateEvent
  /** G-815976 流式中断标记(partial_done):字段口径与 api-client PartialDoneEvent 一致 */
  partialDone?: {
    fallback_applied: boolean
    reason: string
    model?: string
  }
}

function applyErrorMeta(evt: SSEEvent, json: Record<string, unknown>): void {
  if (typeof json.code === 'number') evt.code = json.code
  if (typeof json.statusCode === 'number' && evt.code === undefined) evt.code = json.statusCode
  if (typeof json.errorCode === 'string') evt.errorCode = json.errorCode
  if (typeof json.retryAfter === 'number') evt.retryAfter = json.retryAfter
}

// ============================================================================
// G-640(2026-09-29 立):SSE 重放单调性守卫
//
// 病灶:重连按 Last-Event-ID 起播时,服务端重放窗口与客户端已消费区间可能重叠
// (agents 流 sse_buffer.replay_outcome 在未带游标时重放全部现存缓冲;chat 流
// 重连服务端不支持续传时从头重发)。重放的事件 id 与已消费的相同,客户端此前
// 没有任何拦截 ⇒ 同一事件二次进状态机(计数翻倍、正文重复)。
//
// 落点选在本解析器(共享消费出口)而非各端回调层:miniapp-taro 的每一条事件
// 都从 parseSSEChunk 出去,在这里拦 = 出口只有一份;各端自建守卫必然漂移。
// 守卫**可注入**(SSEReplayGuard 接口,测试与端侧自有实现都从这注入),
// **缺省不注入时本函数行为与既有语义逐字一致**(不传 options 即旧函数)。
// ============================================================================

/** 重放单调性守卫协议(可注入)。 */
export interface SSEReplayGuard {
  /**
   * 询问该事件 id 是否可以消费。
   * 返回 true = 首次消费,事件放行;false = 已消费过(重放),出口即丢弃。
   * 实现方持有游标状态;流/task 维度各建一个实例(序号跨 task 不可比)。
   */
  admit(eventId: string): boolean
}

/** 非 `{prefix}-{seq}` 形态 id 的精确去重缓存上限(防长流内存无界)。 */
const REPLAY_SEEN_NON_SEQ_CAP = 1024

/**
 * 单调性守卫(默认实现)。
 *
 * id 形态 `{prefix}-{seq}`(与 ai-service sse_buffer._parse_seq 同判据:prefix 可含
 * `-`,尾段必须纯数字):维护已见最大 seq,seq ≤ maxSeq 的事件判为重放丢弃 ——
 * 单调游标只需 O(1) 内存,不为长流保留历史。
 * 不带数字尾段的 id(UUID 等)无法判单调,退化为精确去重(有界缓存)。
 */
export class SseMonotonicReplayGuard implements SSEReplayGuard {
  private maxSeq = -1
  private readonly seenNonSeq = new Set<string>()

  admit(eventId: string): boolean {
    const seq = sseEventSeqOf(eventId)
    if (seq === null) {
      if (this.seenNonSeq.has(eventId)) return false
      if (this.seenNonSeq.size >= REPLAY_SEEN_NON_SEQ_CAP) this.seenNonSeq.clear()
      this.seenNonSeq.add(eventId)
      return true
    }
    if (seq <= this.maxSeq) return false
    this.maxSeq = seq
    return true
  }
}

/** 从 `{prefix}-{seq}` 形态的事件 id 取序号;形态不符返回 null(与后端同判据)。 */
function sseEventSeqOf(eventId: string): number | null {
  const idx = eventId.lastIndexOf('-')
  if (idx <= 0 || idx === eventId.length - 1) return null
  const suffix = eventId.slice(idx + 1)
  return /^\d+$/.test(suffix) ? Number(suffix) : null
}

/** parseSSEChunk 可选参数(G-640)。 */
export interface ParseSSEChunkOptions {
  /** 重放单调性守卫;提供时已消费 id 的事件在出口被丢弃,缺省行为与既有语义逐字一致。 */
  replayGuard?: SSEReplayGuard
}

/**
 * W5:提取工具来源三元组(兼容后端 snake_case / camelCase 两种序列化策略)。
 * 逻辑与 @ihui/api-client client.ts 的 tryParseToolCall 完全一致,避免字段漂移。
 */
function pickServerMeta(json: Record<string, unknown>): {
  serverSource?: 'builtin' | 'plugin' | 'mcp'
  serverId?: string
  serverName?: string
} {
  const raw = json.serverSource ?? json.server_source
  const serverSource = raw === 'builtin' || raw === 'plugin' || raw === 'mcp' ? raw : undefined
  const serverId =
    typeof json.serverId === 'string'
      ? json.serverId
      : typeof json.server_id === 'string'
        ? json.server_id
        : undefined
  const serverName =
    typeof json.serverName === 'string'
      ? json.serverName
      : typeof json.server_name === 'string'
        ? json.server_name
        : undefined
  return { serverSource, serverId, serverName }
}

export function parseSSEChunk(
  buffer: string,
  options?: ParseSSEChunkOptions,
): {
  events: SSEEvent[]
  remainder: string
  /** 本批次内最后一条 SSE `id:` 行(供 Last-Event-ID 断点续传使用),无则为 undefined */
  lastId?: string
  /**
   * G-640:本批次因重放重叠被守卫丢弃的事件数。仅当提供 replayGuard 且确有丢弃时才带键
   * —— 缺省(无守卫/无丢弃)不带键,既有解构方零感知。
   */
  replayedDropped?: number
} {
  const guard = options?.replayGuard
  const events: SSEEvent[] = []
  let rest = buffer
  let lastId: string | undefined
  // G-640:当前事件块携带的 id: 游标。SSE 里 id 行属于其后的同一事件块,
  // 下一条 id 行出现前解析出的事件都关联它;流不带 id 行(如对话流)时保持 undefined,
  // 守卫完全不介入(无 id 的事件无法与历史区分,放行 = 既有语义)。
  let currentEventId: string | undefined
  let replayedDropped: number | undefined

  let nl: number
  while ((nl = rest.indexOf('\n')) !== -1) {
    const line = rest.slice(0, nl).replace(/\r$/, '')
    rest = rest.slice(nl + 1)
    // 捕获 SSE id: 行(W5:断点续传游标,parseLine 会将其丢弃,故在此单独提取)
    if (line.startsWith('id:')) {
      currentEventId = line.slice(3).trim()
      // 无守卫:保持既有语义 —— 任何 id: 行当场推进 lastId(即便事件未随行解析出)。
      // 有守卫时游标只随已消费事件推进,见下方 admit 分支。
      if (!guard && currentEventId) lastId = currentEventId
    }
    const evt = parseLine(line)
    if (!evt) continue
    if (guard && currentEventId) {
      // 重放守卫:已消费 id 的事件在出口即丢弃,不进状态机。游标 lastId 只随
      // **已消费**事件推进 —— 全重放批被拦时 lastId 保持 undefined,消费方既有游标
      // 不被重放帧回退(回退会让服务端下次再重放一段,虽然守卫仍能拦,但没必要)。
      if (!guard.admit(currentEventId)) {
        replayedDropped = (replayedDropped ?? 0) + 1
        continue
      }
      lastId = currentEventId
    }
    events.push(evt)
  }

  return { events, remainder: rest, lastId, replayedDropped }
}

/**
 * 行 → data 负载的**唯一**剥前缀实现(D174 抽出)。
 *
 * `parseLineEvent` 与帧级 trace 提取共用它:两处各剥一遍 `data:` / `\r` / 前导空格,
 * 迟早有一处漏掉某条规矩,而漂开的表现不是报错,是"trace 取不到"这种静默丢字段。
 * 返回 `null` = 这一行不承载 data(空行 / `:` 注释行 / `event:`|`id:`|`retry:` 控制行)。
 */
function dataPayloadOfLine(line: string): string | null {
  if (!line || line.startsWith(':')) return null
  if (line.startsWith('data:')) return line.slice(5).replace(/^\s/, '')
  if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) return null
  return line
}

/**
 * D174(2026-09-30 立):帧级 traceId 的**唯一认领点** —— 挂在整条认领链的最外层。
 *
 * 为什么必须在包装层、而不是在某个分支里挂:本函数尾部有一条泛化兜底
 * `typeof json?.sessionId === 'string' ⇒ {type:'meta', sessionId}`,内层分支 `return`
 * 出来的是**已经收窄完**的对象,兜底之后再去补字段就补不上了(整帧已被折成一条 meta)。
 * 本仓同型已栽过三次 —— terminal_delta 被折成 chunk(D19-A1)、tool-delta 被整帧丢掉
 * (D113)、terminal_interaction 被折成 meta(D151);判据
 * `scripts/check-sse-parser-parity.mjs`。在这一层挂,**每一帧**都过这一次,连被兜底
 * 折掉的那些也带着自己的 traceId。
 *
 * 代价如实登记:具名帧的 data JSON 因此被解析两次(`parseLineEvent` 一次、取 trace 一次)。
 * 一次 parse 的是几百字节的对象(实测每帧微秒级),换来的是"新分支不需要记得挂 trace"
 * —— 少一处会漏的地方,比省一次 parse 值钱。
 */
function parseLine(line: string): SSEEvent | null {
  const evt = parseLineEvent(line)
  if (!evt) return null
  const traceId = frameTraceIdOfLine(line)
  return traceId ? { ...evt, traceId } : evt
}

/**
 * 从一行 SSE 文本里取帧级 traceId;取不到 ⇒ `undefined`(**不写空串、不写 null**)。
 *
 * 值规则(小写 32 hex / 全 0 非法)只在 `sse/contract.ts::normalizeSSEFrameTraceId`
 * 那一份里定义,生产侧对应 `apps/ai-service/app/core/trace_context.py::normalize_trace_id`。
 * `[DONE]` 与 Vercel data-stream 的 `0:"…"` 协议帧不带我方 payload ⇒ 直接不给 trace。
 */
function frameTraceIdOfLine(line: string): string | undefined {
  const data = dataPayloadOfLine(line)
  if (!data || data === '[DONE]') return undefined
  if (/^\d+:.*$/su.test(data)) return undefined
  try {
    const json = JSON.parse(data) as Record<string, unknown>
    return normalizeSSEFrameTraceId(json?.[SSE_TRACE_ID_PAYLOAD_KEY])
  } catch {
    return undefined
  }
}

function parseLineEvent(line: string): SSEEvent | null {
  const data = dataPayloadOfLine(line)
  if (data === null) return null

  if (data === '[DONE]') return { type: 'done' }

  const proto = data.match(/^(\d+):(.*)$/s)
  const protoType = proto?.[1]
  const protoPayload = proto?.[2]
  if (protoType && protoPayload) {
    try {
      const parsed = JSON.parse(protoPayload)
      if (protoType === '0' && typeof parsed === 'string') {
        return { type: 'chunk', content: parsed }
      }
      if (protoType === '9' && typeof parsed === 'string') {
        return { type: 'reasoning', content: parsed }
      }
      // W5:Vercel AI SDK data-stream 协议 tool_call(2)/tool_result(7)分支
      if (protoType === '2' && parsed?.toolCallId && parsed?.toolName) {
        return {
          type: 'tool-call-start',
          toolCall: {
            type: 'tool-call-start',
            toolCallId: String(parsed.toolCallId),
            toolName: String(parsed.toolName),
            args: parsed.args as Record<string, unknown> | undefined,
          },
        }
      }
      if (protoType === '7' && parsed?.toolCallId) {
        return {
          type: 'tool-result',
          toolCall: {
            type: 'tool-result',
            toolCallId: String(parsed.toolCallId),
            toolName: typeof parsed.toolName === 'string' ? parsed.toolName : '',
            result: parsed.result,
            isError: parsed.isError === true,
            // 媒体产物字段保持后端 snake_case(与 client.ts 契约一致)
            image_url: typeof parsed.image_url === 'string' ? parsed.image_url : undefined,
            audio_url: typeof parsed.audio_url === 'string' ? parsed.audio_url : undefined,
            video_url: typeof parsed.video_url === 'string' ? parsed.video_url : undefined,
            task_id: typeof parsed.task_id === 'string' ? parsed.task_id : undefined,
          },
        }
      }
      return null
    } catch {
      return null
    }
  }

  try {
    const json = JSON.parse(data) as Record<string, unknown>
    if (typeof json?.error === 'string') {
      const evt: SSEEvent = { type: 'error', content: json.error }
      applyErrorMeta(evt, json)
      return evt
    }
    if (json?.type === 'error' && typeof json?.message === 'string') {
      const evt: SSEEvent = { type: 'error', content: json.message }
      applyErrorMeta(evt, json)
      return evt
    }
    if (json?.error === true && typeof json?.error_message === 'string') {
      const evt: SSEEvent = { type: 'error', content: json.error_message }
      applyErrorMeta(evt, json)
      return evt
    }
    // ===== D106 补齐:四帧必须在下方兜底抽取链(content/delta/text)之前分流,
    // 否则 steer.text 会被喷成正文增量(与 client.ts 同一历史坑位) =====
    if (json?.type === 'steer' && typeof json.text === 'string') {
      return {
        type: 'steer',
        steer: {
          phase: 'injected',
          text: json.text,
          timestamp: typeof json.timestamp === 'string' ? json.timestamp : undefined,
          messageId: typeof json.messageId === 'string' ? json.messageId : undefined,
        },
      }
    }
    if (json?.type === 'budget' && (json.level === 'warning' || json.level === 'critical')) {
      return {
        type: 'budget',
        budget: {
          level: json.level,
          percent: typeof json.percent === 'number' ? json.percent : undefined,
          usedTokens: typeof json.usedTokens === 'number' ? json.usedTokens : undefined,
          limitTokens: typeof json.limitTokens === 'number' ? json.limitTokens : undefined,
          tier: typeof json.tier === 'string' ? json.tier : undefined,
          resetAt: typeof json.resetAt === 'string' ? json.resetAt : undefined,
        },
      }
    }
    // 无 collapsed 就没有可显示的东西 ⇒ 不产出事件(而不是产一条空行),与 tryParseInjection 同判据
    if (
      json?.type === 'injection_applied' &&
      typeof json.kind === 'string' &&
      json.kind !== '' &&
      typeof json.collapsed === 'string' &&
      json.collapsed !== ''
    ) {
      return {
        type: 'injection_applied',
        injectionApplied: {
          kind: json.kind,
          collapsed: json.collapsed,
          ...(typeof json.fullText === 'string' ? { fullText: json.fullText } : {}),
          ...(typeof json.count === 'number' ? { count: json.count } : {}),
          ...(typeof json.messageId === 'string' ? { messageId: json.messageId } : {}),
        },
      }
    }
    if (
      json?.type === 'retry_scheduled' &&
      typeof json.attempt === 'number' &&
      typeof json.maxRetries === 'number'
    ) {
      return {
        type: 'retry_scheduled',
        retryScheduled: {
          attempt: json.attempt,
          maxRetries: json.maxRetries,
          retryInMs: typeof json.retryInMs === 'number' ? json.retryInMs : 0,
          ...(typeof json.httpStatus === 'number' ? { httpStatus: json.httpStatus } : {}),
          ...(typeof json.messageId === 'string' ? { messageId: json.messageId } : {}),
        },
      }
    }
    // ===== D19-A1(2026-09-24 立):terminal_delta 必须在兜底抽取链之前认领 =====
    // 后端 apps/ai-service/app/services/mcp_server.py::_emit_terminal_delta 产的帧形如
    // {"type":"terminal_delta","terminalId","command","stream","text","iteration"[,"messageId"]}
    // —— 带 text、不带 content/delta,原先一路滑到 `typeof json?.text === 'string'` 那条泛化
    // 兜底,被判成 {type:'chunk'},miniapp-taro 的 dispatch 再 emitDelta 进气泡
    // ⇒ **终端 stdout 混进聊天正文**(用户可见的内容污染)。
    // 字段收窄口径与 @ihui/api-client client.ts 的 tryParseTerminalDelta 逐位一致,不另立第二种命名。
    // 校验不过(terminalId / text 不是 string)一律**丢弃**,绝不回落 chunk。
    if (json?.type === 'terminal_delta') {
      const terminalId = json.terminalId
      const text = json.text
      if (typeof terminalId !== 'string' || typeof text !== 'string') return null
      const delta: TerminalDeltaEvent = {
        terminalId,
        command: typeof json.command === 'string' ? json.command : '',
        stream: json.stream === 'stderr' ? 'stderr' : 'stdout',
        text,
        iteration: typeof json.iteration === 'number' ? json.iteration : 0,
        ...(typeof json.messageId === 'string' ? { messageId: json.messageId } : {}),
      }
      return { type: 'terminal_delta', terminalDelta: delta }
    }
    // ===== D113(2026-09-27 立):tool-delta 同样必须在兜底抽取链之前认领 =====
    // 载荷 partialText 是**累积文本**(整帧替换渲染),若滑到下面的 content/delta/text 泛化
    // 兜底就会被当成正文增量喷进气泡;而它的 type 又不在任何既有分支里,原状是走到末尾
    // `return null` ⇒ 静默丢帧。两条失效方向都在这一次改掉:既不污染正文,也不悄悄消失。
    // 字段收窄口径抄 @ihui/api-client client.ts 的 tryParseToolDelta(seq 非 number 归 0、
    // truncated 仅 true 才带键),并额外要求 toolCallId / partialText **必须是 string**
    // —— 校验不过一律**丢弃**,绝不回落 chunk(与 terminal_delta 同一条纪律)。
    if (json?.type === 'tool-delta') {
      const toolCallId = json.toolCallId
      const partialText = json.partialText
      if (typeof toolCallId !== 'string' || typeof partialText !== 'string') return null
      const delta: ToolDeltaEvent = {
        toolCallId,
        seq: typeof json.seq === 'number' ? json.seq : 0,
        partialText,
        ...(json.truncated === true ? { truncated: true } : {}),
      }
      return { type: 'tool-delta', toolDelta: delta }
    }
    // ===== D151(2026-09-29 立):terminal_interaction 同样必须在兜底抽取链之前认领 =====
    // 载荷 {terminalId, sessionId, promptTail, waitingSinceMs, inputMode, maxInputChars, messageId?}
    // —— 既不带 content/delta/text,又**带一个字符串 sessionId**,于是它一路走到下面那条
    // `typeof json?.sessionId === 'string' ⇒ {type:'meta', sessionId}` 的泛化兜底,
    // 被折成一条 meta 帧:terminalId 与提示原文全部丢失,小程序端**结构上不可能**知道
    // 命令在等人(2026-09-29 派单代理实测探针打出 EVENTS=[{type:meta,sessionId:s-9}] 的那一格)。
    // 字段收窄口径抄 @ihui/api-client client.ts 的 tryParseTerminalInteraction:terminalId
    // 必须是 string,否则**丢弃**,绝不回落 chunk/meta —— 静默降级就是把"没看见"写成"看见了"。
    if (json?.type === 'terminal_interaction') {
      const terminalId = json.terminalId
      if (typeof terminalId !== 'string') return null
      const interaction: TerminalInteractionEvent = {
        terminalId,
        sessionId: typeof json.sessionId === 'string' ? json.sessionId : '',
        promptTail: typeof json.promptTail === 'string' ? json.promptTail : '',
        waitingSinceMs: typeof json.waitingSinceMs === 'number' ? json.waitingSinceMs : 0,
        inputMode: 'line',
        maxInputChars: typeof json.maxInputChars === 'number' ? json.maxInputChars : 4096,
        ...(typeof json.messageId === 'string' ? { messageId: json.messageId } : {}),
      }
      return { type: 'terminal_interaction', terminalInteraction: interaction }
    }
    // ===== D152(2026-09-29 立):goal_updated 必须在同一条泛化兜底之前认领 =====
    // 载荷 {sessionId, status, objective?, elapsedMs?, tokenUsage?, updatedAt?}。
    // 判据与 api-client tryParseGoalUpdate 同形:**status 必须是那七个值之一**,
    // 否则**丢弃**(绝不回落 chunk/meta —— 把"没认出来"写成"看见了"是本仓最高频的
    // 失效型)。sessionId 缺省时给空串并照发:状态本身是这一帧的全部内容。
    if (json?.type === 'goal_updated') {
      const status = json.status
      if (
        status !== 'active' &&
        status !== 'paused' &&
        status !== 'blocked' &&
        status !== 'done' &&
        status !== 'usageLimited' &&
        status !== 'budgetLimited' &&
        status !== 'cleared'
      ) {
        return null
      }
      const goal: GoalUpdateEvent = {
        sessionId: typeof json.sessionId === 'string' ? json.sessionId : '',
        status,
        ...(typeof json.objective === 'string' ? { objective: json.objective } : {}),
        ...(typeof json.elapsedMs === 'number' ? { elapsedMs: json.elapsedMs } : {}),
        ...(typeof json.tokenUsage === 'number' ? { tokenUsage: json.tokenUsage } : {}),
        ...(typeof json.updatedAt === 'number' ? { updatedAt: json.updatedAt } : {}),
      }
      return { type: 'goal_updated', goalUpdated: goal }
    }
    // G-815976(2026-10-04):流式中断标记帧认领 —— 不带 content/delta/text,不认领
    // 会被静默丢掉(与 terminal_delta/tool-delta 同型:帧能到设备却像"功能不存在")。
    if (json?.type === 'partial_done') {
      return {
        type: 'partial_done',
        partialDone: {
          fallback_applied: json.fallback_applied === true,
          reason: typeof json.reason === 'string' ? json.reason : 'stream_interrupted',
          model: typeof json.model === 'string' ? json.model : undefined,
        },
      }
    }
    const choices = json?.choices as Array<Record<string, unknown>> | undefined
    const choice = choices?.[0]
    if (choice) {
      const delta =
        (choice.delta as Record<string, unknown> | undefined)?.content ??
        (choice.message as Record<string, unknown> | undefined)?.content ??
        choice.text
      if (typeof delta === 'string') return { type: 'chunk', content: delta }
    }
    if (json?.type === 'reasoning' && typeof json?.delta === 'string') {
      return { type: 'reasoning', content: json.delta }
    }
    if (typeof json?.content === 'string') return { type: 'chunk', content: json.content }
    if (typeof json?.delta === 'string') return { type: 'chunk', content: json.delta }
    if (typeof json?.text === 'string') return { type: 'chunk', content: json.text }
    if (json?.type === 'meta' && typeof json?.sessionId === 'string') {
      return { type: 'meta', sessionId: json.sessionId }
    }
    // done 事件:ai-service 在流末尾下发 {"type":"done","model":"...","usage":{"prompt_tokens":..,"completion_tokens":..,"total_tokens":..}}
    // 解析 usage.total_tokens 填充到消息的 tokenCount(对标原 ai_assistant.vue total_tokens 显示)
    if (json?.type === 'done') {
      const rawUsage = json.usage as Record<string, unknown> | undefined
      const usage = rawUsage
        ? {
            promptTokens:
              typeof rawUsage.prompt_tokens === 'number' ? rawUsage.prompt_tokens : undefined,
            completionTokens:
              typeof rawUsage.completion_tokens === 'number'
                ? rawUsage.completion_tokens
                : undefined,
            totalTokens:
              typeof rawUsage.total_tokens === 'number' ? rawUsage.total_tokens : undefined,
          }
        : undefined
      return {
        type: 'done',
        usage,
        model: typeof json.model === 'string' ? json.model : undefined,
      }
    }
    if (typeof json?.sessionId === 'string') {
      return { type: 'meta', sessionId: json.sessionId }
    }
    // 上下文自动压缩事件(跨端统一 88% 阈值触发,后端 SSE 首事件)
    const compaction = json?.compaction as Record<string, unknown> | undefined
    if (compaction && compaction.triggered === true) {
      return {
        type: 'compaction',
        compaction: {
          triggered: true,
          tokensBefore: Number(compaction.tokensBefore ?? 0),
          tokensAfter: Number(compaction.tokensAfter ?? 0),
          removedCount: Number(compaction.removedCount ?? 0),
          usageRatio: Number(compaction.usageRatio ?? 0),
          ...(typeof compaction.trigger === 'string' ? { trigger: compaction.trigger } : {}),
        },
      }
    }

    // ===== W5 新增事件(对齐 @ihui/api-client client.ts 的 streamChat 线上契约) =====
    // fallback:主模型失败切换到备用模型(线上字段 snake_case,与 parseFallbackEvent 一致)
    if (json?.type === 'fallback' && typeof json.primary_model === 'string') {
      return {
        type: 'fallback',
        fallback: {
          primaryModel: json.primary_model,
          backupModel: typeof json.backup_model === 'string' ? json.backup_model : 'unknown',
          reason: typeof json.reason === 'string' ? json.reason : 'unknown',
        },
      }
    }
    // 工具调用结果事件(兼容后端 tool_result / tool-result 两种写法,需 toolCallId)
    if ((json?.type === 'tool_result' || json?.type === 'tool-result') && json?.toolCallId) {
      return {
        type: 'tool-result',
        toolCall: {
          type: 'tool-result',
          toolCallId: String(json.toolCallId),
          toolName: typeof json.toolName === 'string' ? json.toolName : '',
          args: json.args as Record<string, unknown> | undefined,
          result: json.result,
          isError: json.isError === true,
          ...pickServerMeta(json),
          // 媒体产物保持后端 snake_case 顶层扁平化(与 client.ts 契约一致)
          image_url: typeof json.image_url === 'string' ? json.image_url : undefined,
          audio_url: typeof json.audio_url === 'string' ? json.audio_url : undefined,
          video_url: typeof json.video_url === 'string' ? json.video_url : undefined,
          task_id: typeof json.task_id === 'string' ? json.task_id : undefined,
        },
      }
    }
    // 工具调用开始事件(自定义 JSON 形式,需 toolCallId)
    if (json?.type === 'tool-call-start' && json?.toolCallId) {
      return {
        type: 'tool-call-start',
        toolCall: {
          type: 'tool-call-start',
          toolCallId: String(json.toolCallId),
          toolName: typeof json.toolName === 'string' ? json.toolName : '',
          args: json.args as Record<string, unknown> | undefined,
          ...pickServerMeta(json),
        },
      }
    }
    // subagent 派发事件
    if (json?.type === 'subagent_spawn' && json?.id) {
      return {
        type: 'subagent_spawn',
        subagentSpawn: {
          id: String(json.id),
          role: typeof json.role === 'string' ? json.role : '',
          task: typeof json.task === 'string' ? json.task : '',
          timestamp: typeof json.timestamp === 'string' ? json.timestamp : new Date().toISOString(),
          messageId: typeof json.messageId === 'string' ? json.messageId : undefined,
        },
      }
    }
    // subagent 执行进度事件(phase 仅接受 4 个契约值)
    if (json?.type === 'subagent_progress' && json?.id) {
      const phase = json.phase
      if (
        phase === 'thinking' ||
        phase === 'tool_call' ||
        phase === 'tool_result' ||
        phase === 'output_ready'
      ) {
        return {
          type: 'subagent_progress',
          subagentProgress: {
            id: String(json.id),
            phase,
            timestamp:
              typeof json.timestamp === 'string' ? json.timestamp : new Date().toISOString(),
            iteration: typeof json.iteration === 'number' ? json.iteration : undefined,
            tool: typeof json.tool === 'string' ? json.tool : undefined,
            ok: typeof json.ok === 'boolean' ? json.ok : undefined,
            outputPreview:
              typeof json.output_preview === 'string' ? json.output_preview : undefined,
            agentName: typeof json.agentName === 'string' ? json.agentName : undefined,
            messageId: typeof json.messageId === 'string' ? json.messageId : undefined,
          },
        }
      }
    }
    // subagent 执行结束事件
    if (json?.type === 'subagent_end' && json?.id) {
      return {
        type: 'subagent_end',
        subagentEnd: {
          id: String(json.id),
          status: json.status === 'failed' ? 'failed' : 'done',
          failureReason: typeof json.failureReason === 'string' ? json.failureReason : undefined,
          timestamp: typeof json.timestamp === 'string' ? json.timestamp : new Date().toISOString(),
          messageId: typeof json.messageId === 'string' ? json.messageId : undefined,
        },
      }
    }
    // 工具调用汇总事件(兼容后端 snake_case 字段)
    if (json?.type === 'tool-summary') {
      const numOr = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
      const toolsByCategory = json.toolsByCategory ?? json.tools_by_category
      const totalDurationMs = json.totalDurationMs ?? json.total_duration_ms
      return {
        type: 'tool-summary',
        toolSummary: {
          filesSearched: numOr(json.filesSearched ?? json.files_searched),
          webSearched: numOr(json.webSearched ?? json.web_searched),
          filesModified: numOr(json.filesModified ?? json.files_modified),
          linesAdded: numOr(json.linesAdded ?? json.lines_added),
          linesDeleted: numOr(json.linesDeleted ?? json.lines_deleted),
          toolsByCategory:
            toolsByCategory && typeof toolsByCategory === 'object'
              ? (toolsByCategory as Record<string, number>)
              : {},
          totalCalls: numOr(json.totalCalls ?? json.total_calls),
          totalDurationMs:
            typeof totalDurationMs === 'number' && Number.isFinite(totalDurationMs)
              ? totalDurationMs
              : undefined,
        },
      }
    }
    // 工具委托执行事件(session_id / tool_call_id 均为后端 snake_case 必填)
    if (
      json?.type === 'tool-delegate' &&
      typeof json.session_id === 'string' &&
      typeof json.tool_call_id === 'string'
    ) {
      return {
        type: 'tool-delegate',
        toolDelegate: {
          session_id: json.session_id,
          tool_call_id: json.tool_call_id,
          tool_name: typeof json.tool_name === 'string' ? json.tool_name : '',
          args:
            json.args && typeof json.args === 'object'
              ? (json.args as Record<string, unknown>)
              : {},
          iteration: typeof json.iteration === 'number' ? json.iteration : 0,
          type: 'tool-delegate',
        },
      }
    }
    // 计划更新事件(plan 为权威快照数组)
    if (json?.type === 'plan_updated' && Array.isArray(json.plan)) {
      return {
        type: 'plan_updated',
        planUpdate: {
          messageId: typeof json.messageId === 'string' ? json.messageId : undefined,
          explanation: typeof json.explanation === 'string' ? json.explanation : undefined,
          plan: json.plan as PlanUpdateEvent['plan'],
          timestamp: typeof json.timestamp === 'string' ? json.timestamp : undefined,
        },
      }
    }
    // 终端任务开始事件
    if (json?.type === 'terminal_start' && typeof json.terminalId === 'string') {
      return {
        type: 'terminal_start',
        terminalStart: {
          terminalId: json.terminalId,
          command: typeof json.command === 'string' ? json.command : '',
          status: 'running',
          startedAt: typeof json.startedAt === 'string' ? json.startedAt : undefined,
          messageId: typeof json.messageId === 'string' ? json.messageId : undefined,
        },
      }
    }
    // 终端任务结束事件
    if (json?.type === 'terminal_end' && typeof json.terminalId === 'string') {
      return {
        type: 'terminal_end',
        terminalEnd: {
          terminalId: json.terminalId,
          status:
            json.status === 'completed'
              ? 'completed'
              : json.status === 'failed'
                ? 'failed'
                : 'running',
          output: typeof json.output === 'string' ? json.output : undefined,
          exitCode: typeof json.exitCode === 'number' ? json.exitCode : undefined,
          endedAt: typeof json.endedAt === 'string' ? json.endedAt : undefined,
          durationMs: typeof json.durationMs === 'number' ? json.durationMs : undefined,
          messageId: typeof json.messageId === 'string' ? json.messageId : undefined,
        },
      }
    }
    // #11 Citations 全链路(2026-09-13 立):knowledge_lookup 工具执行后下发的引用溯源事件
    if (json?.type === 'citations' && Array.isArray(json.citations)) {
      return {
        type: 'citations',
        citations: {
          messageId: typeof json.messageId === 'string' ? json.messageId : undefined,
          citations: json.citations as CitationsEvent['citations'],
        },
      }
    }
    // usage:OpenAI 协议 usage chunk(后端 stream_options.include_usage=true 时发送)
    const usageRaw = json?.usage as Record<string, unknown> | undefined
    if (usageRaw && typeof usageRaw === 'object') {
      const promptTokens = Number(usageRaw.prompt_tokens ?? usageRaw.promptTokens ?? 0)
      const completionTokens = Number(usageRaw.completion_tokens ?? usageRaw.completionTokens ?? 0)
      const totalTokens = Number(usageRaw.total_tokens ?? usageRaw.totalTokens ?? 0)
      if (promptTokens > 0 || completionTokens > 0 || totalTokens > 0) {
        return {
          type: 'usage',
          usage: {
            promptTokens: Number.isFinite(promptTokens) ? promptTokens : 0,
            completionTokens: Number.isFinite(completionTokens) ? completionTokens : 0,
            totalTokens: Number.isFinite(totalTokens) ? totalTokens : 0,
            // G-403(2026-10-07):缓存读/写两维在此接住,与 api-client 的
            // parseUsageCacheTokens 同一套别名清单、同一条"两态绝不并桶"纪律:
            // 真回报的数字(含 0)原样透传;整维没采到 ⇒ null(未知),绝不造 0。
            // shared 不能反向依赖 api-client,故此处内联同一判据(改动须两处同步)。
            ...parseCacheTokensShared(usageRaw),
          },
        }
      }
    }
    return null
  } catch {
    return data ? { type: 'chunk', content: data } : null
  }
}

/**
 * G-403(2026-10-07):从 usage 对象接住 prompt 缓存读/写两维(共享解析版)。
 *
 * 与 `packages/api-client/src/client.ts` 的 `parseUsageCacheTokens` 同一套别名清单、
 * 同一条"两态绝不并桶"纪律:真回报的数字(含 0)是读数;整维没采到 ⇒ null(未知),
 * 绝不造 0。shared 不能反向依赖 api-client,故内联同一判据 —— **两处改动须同步**,
 * 权威出处:
 * - `cached_tokens` / `cache_creation_tokens` = ai-service 归一契约(usage_cache.py);
 * - `prompt_tokens_details.cached_tokens` = OpenAI 原生嵌套形态;
 * - `cache_read_input_tokens` / `cache_creation_input_tokens` = Anthropic 原生;
 * - `prompt_cache_hit_tokens` = DeepSeek 原生;
 * - camelCase `cacheReadTokens` / `cacheWriteTokens` = 我方命名帧线格式(llm.py _usage_frame)。
 */
function parseCacheTokensShared(usage: Record<string, unknown>): {
  cacheReadTokens: number | null
  cacheWriteTokens: number | null
} {
  const toNumber = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null
  const details = usage['prompt_tokens_details']
  const nested = details && typeof details === 'object' ? (details as Record<string, unknown>) : {}
  const firstReported = (candidates: unknown[]): number | null => {
    for (const c of candidates) {
      const n = toNumber(c)
      if (n !== null) return n
    }
    return null
  }
  return {
    cacheReadTokens: firstReported([
      usage['cacheReadTokens'],
      usage['cached_tokens'],
      nested['cached_tokens'],
      usage['cache_read_input_tokens'],
      usage['prompt_cache_hit_tokens'],
    ]),
    cacheWriteTokens: firstReported([
      usage['cacheWriteTokens'],
      usage['cacheCreationTokens'],
      usage['cache_creation_tokens'],
      usage['cache_creation_input_tokens'],
    ]),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
