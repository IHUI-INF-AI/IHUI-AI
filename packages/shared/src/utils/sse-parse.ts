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
} from '@ihui/api-client'
import type { PlanUpdateEvent, TerminalStartEvent, TerminalEndEvent } from '@ihui/types'

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
  content?: string
  sessionId?: string
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
  /** done 事件携带的 token 用量(对标原 ai_assistant.vue total_tokens,ai-service event:done 下发) */
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
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
}

function applyErrorMeta(evt: SSEEvent, json: Record<string, unknown>): void {
  if (typeof json.code === 'number') evt.code = json.code
  if (typeof json.statusCode === 'number' && evt.code === undefined) evt.code = json.statusCode
  if (typeof json.errorCode === 'string') evt.errorCode = json.errorCode
  if (typeof json.retryAfter === 'number') evt.retryAfter = json.retryAfter
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

export function parseSSEChunk(buffer: string): {
  events: SSEEvent[]
  remainder: string
  /** 本批次内最后一条 SSE `id:` 行(供 Last-Event-ID 断点续传使用),无则为 undefined */
  lastId?: string
} {
  const events: SSEEvent[] = []
  let rest = buffer
  let lastId: string | undefined

  let nl: number
  while ((nl = rest.indexOf('\n')) !== -1) {
    const line = rest.slice(0, nl).replace(/\r$/, '')
    rest = rest.slice(nl + 1)
    // 捕获 SSE id: 行(W5:断点续传游标,parseLine 会将其丢弃,故在此单独提取)
    if (line.startsWith('id:')) lastId = line.slice(3).trim()
    const evt = parseLine(line)
    if (evt) events.push(evt)
  }

  return { events, remainder: rest, lastId }
}

function parseLine(line: string): SSEEvent | null {
  if (!line || line.startsWith(':')) return null

  let data = line
  if (line.startsWith('data:')) {
    data = line.slice(5).replace(/^\s/, '')
  } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
    return null
  }

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
          },
        }
      }
    }
    return null
  } catch {
    return data ? { type: 'chunk', content: data } : null
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
