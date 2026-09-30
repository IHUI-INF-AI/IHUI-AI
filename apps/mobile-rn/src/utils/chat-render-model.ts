// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 对话可视化的「消息 → 可渲染模型」纯函数(零 React 依赖,可单测)。
 *
 * 背景:W6 计划抽出的共享模块 @ihui/shared/chat/render-model 尚未落地,
 * 本文件是 mobile-rn 端的独立实现;后续共享模块就绪后,可整体替换为
 * `@ihui/shared/chat/render-model`(入参/出参语义保持一致),本文件仅做 re-export 适配。
 *
 * 覆盖三类消息级可视化数据:
 *   ① 工具调用:ToolCallEvent(tool-call-start / tool-result)→ ToolCallItem[](running/success/error)
 *   ② Plan 步骤:PlanUpdateEvent → PlanStepItem[](事件为权威快照,整体替换)
 *   ③ 终端任务:TerminalStartEvent / TerminalEndEvent → TerminalTaskItem[](按 terminalId 合并)
 * 另提供 UI 直接消费的格式化助手(参数/输出/耗时)。
 *
 * 说明:所有 reducer 均为纯函数(除默认参数 Date.now() 外无副作用),
 * 便于在无 React 环境(vitest)中直接断言。
 */
import { describeMcpToolActivity } from '@ihui/shared/chat'
import type {
  PlanUpdateEvent,
  TerminalEndEvent,
  TerminalStartEvent,
  ToolCallEvent,
  ToolDeltaEvent,
} from '@ihui/api-client'
import type { PlanStepStatus, TerminalTaskStatus } from '@ihui/types'

/** 工具调用在 UI 中的三态(running=执行中 / success=成功 / error=失败) */
export type ToolCallStatus = 'running' | 'success' | 'error'

/** 工具调用可渲染项(onToolCall 事件折叠后的消息级状态) */
export interface ToolCallItem {
  /** 工具调用唯一 ID(SSE toolCallId) */
  id: string
  /** 工具名 */
  name: string
  /** 执行状态 */
  status: ToolCallStatus
  /** 调用入参 */
  args?: Record<string, unknown>
  /** 调用结果 */
  result?: unknown
  /** 工具来源:builtin / plugin / mcp */
  serverSource?: 'builtin' | 'plugin' | 'mcp'
  /** MCP server 显示名 */
  serverName?: string
  /** 本地记录的调用开始时间(ms epoch,用于计算耗时) */
  startedAtMs?: number
  /** 耗时(ms,result 事件到达时计算) */
  durationMs?: number
  /** 媒体产物 URL(图片,后端 tool-result 顶层扁平化字段) */
  imageUrl?: string
  /** 媒体产物 URL(音频) */
  audioUrl?: string
  /** 媒体产物 URL(视频) */
  videoUrl?: string
  /** 异步任务 ID */
  taskId?: string
  /** D113 流中 diff 预览(tool-delta 帧累积文本,整帧覆盖写入;tool-result 到达即清除,
   *  最终 diff 以 result 为准。对齐 web ToolCall.partialDiff 语义) */
  partialDiff?: string
}

/** Plan 步骤可渲染项 */
export interface PlanStepItem {
  /** 步骤 ID(事件内无 id,由序号派生) */
  id: string
  /** 步骤描述 */
  step: string
  /** 步骤状态(Codex 三状态) */
  status: PlanStepStatus
  /** 耗时(ms) */
  durationMs?: number
  /** step 累计 token 消耗 */
  tokenUsage?: number
}

/** Plan 事件折叠结果(步骤快照 + 整体 explanation) */
export interface PlanReduceResult {
  steps: PlanStepItem[]
  explanation?: string
}

/** 终端任务可渲染项 */
export interface TerminalTaskItem {
  /** 终端任务 ID(SSE terminalId) */
  id: string
  /** 执行命令 */
  command: string
  /** 执行状态 */
  status: TerminalTaskStatus
  /** 命令输出 */
  output?: string
  /** 后端截断标志与原始长度(RN 没有 live 输出缓冲,只能靠这两个字段交代"内容不完整") */
  truncated?: boolean
  totalChars?: number
  /** 退出码 */
  exitCode?: number
  /** 开始时间(ms epoch) */
  startedAtMs?: number
  /** 耗时(ms) */
  durationMs?: number
}

/** ISO 时间字符串 → ms epoch(非法/缺失返回 undefined) */
function toEpochMs(iso: string | undefined): number | undefined {
  if (!iso) return undefined
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? undefined : ms
}

/**
 * 折叠单个工具调用事件到消息级列表(纯函数)。
 * - tool-call-start:新增或原地更新为 running,记录 startedAtMs;重放时保留已有流中预览
 * - tool-result:按 toolCallId 找到并更新为 success/error,计算 durationMs,写入媒体产物;
 *   D113:partialDiff 整帧清除(最终 diff 以 result 的 diffInfo 为准,对齐 web updates.partialDiff=undefined)
 */
export function applyToolCallEvent(
  list: readonly ToolCallItem[] | undefined,
  event: ToolCallEvent,
  nowMs: number = Date.now(),
): ToolCallItem[] {
  const prev = list ? [...list] : []
  const idx = prev.findIndex((item) => item.id === event.toolCallId)
  const current = idx >= 0 ? prev[idx] : undefined

  const next: ToolCallItem =
    event.type === 'tool-call-start'
      ? {
          id: event.toolCallId,
          name: event.toolName,
          status: 'running',
          args: event.args ?? current?.args,
          serverSource: event.serverSource ?? current?.serverSource,
          serverName: event.serverName ?? current?.serverName,
          startedAtMs: current?.startedAtMs ?? nowMs,
          partialDiff: current?.partialDiff,
        }
      : {
          id: event.toolCallId,
          name: event.toolName,
          status: event.isError ? 'error' : 'success',
          args: event.args ?? current?.args,
          result: event.result,
          serverSource: event.serverSource ?? current?.serverSource,
          serverName: event.serverName ?? current?.serverName,
          startedAtMs: current?.startedAtMs,
          durationMs:
            current?.startedAtMs !== undefined
              ? Math.max(0, nowMs - current.startedAtMs)
              : undefined,
          imageUrl: event.image_url,
          audioUrl: event.audio_url,
          videoUrl: event.video_url,
          taskId: event.task_id,
          // D113:tool-result 到达即清流中预览,不继承 current.partialDiff
          partialDiff: undefined,
        }

  if (idx >= 0) prev[idx] = next
  else prev.push(next)
  return prev
}

/**
 * D113 tool-delta 帧折叠(纯函数):文件写类工具流中 diff 预览。
 * 载荷 partialText 为累积文本,按 toolCallId **覆盖式**写入 partialDiff
 * (同 seq 重放/乱序天然幂等,seq 不参与判断,对齐 web createToolDeltaHandler)。
 * - 空 toolCallId → 整帧丢弃,零写入
 * - 列表中无该 toolCallId(start 帧未到)→ 不凭空造条目,原样返回
 */
export function applyToolDelta(
  list: readonly ToolCallItem[] | undefined,
  event: Pick<ToolDeltaEvent, 'toolCallId' | 'partialText'>,
): ToolCallItem[] {
  const prev = list ? [...list] : []
  if (!event.toolCallId) return prev
  if (!prev.some((item) => item.id === event.toolCallId)) return prev
  return prev.map((item) =>
    item.id === event.toolCallId ? { ...item, partialDiff: event.partialText } : item,
  )
}

/**
 * 折叠 Plan 更新事件(纯函数)。
 * PlanUpdateEvent.plan 为权威快照 → 整体替换步骤列表(不做增量合并)。
 */
export function applyPlanUpdate(event: PlanUpdateEvent): PlanReduceResult {
  return {
    steps: event.plan.map((item, index) => ({
      id: `plan-${index}`,
      step: item.step,
      status: item.status,
      durationMs: item.durationMs,
      tokenUsage: item.tokenUsage,
    })),
    explanation: event.explanation,
  }
}

/**
 * D135 接线(2026-10-01):「单条 assistant 消息的执行可视化」按消息 id 累加的折叠档。
 *
 * 为什么需要这一层,而不是把折叠结果直接写进 `ChatMessage.toolCalls`:
 * 共享契约里那个字段的元素是 `@ihui/types` 的 **ToolCall**(键名 `toolName`、`args` 必填),
 * 而本端渲染件(含 `components/ai/TaskStatusBar`)吃的是本文件的 **ToolCallItem**(键名 `name`,
 * 另带 startedAtMs / durationMs / partialDiff / 媒体产物等端内派生字段)。两者不同形 ——
 * 硬塞要么靠 `as` 骗过类型检查,要么逼每个消费端再抄一份映射,而"两处算同一件事必漂移"是
 * 本仓记过最多次的失效型(AGENTS §12/守门 77·83 同族)。
 *
 * 所以这一层**只做组合,不新增判据**:三个 reducer(`applyToolCallEvent` / `applyToolDelta` /
 * `applyPlanUpdate`)仍是唯一实现,本函数把它们收成一个可按帧判别式穷尽的折叠入口,
 * 让端内可以用一张「消息 id → 折叠档」的旁表接帧。W6 抽出的
 * `@ihui/shared/chat/render-model`(消息 → RenderBlock[])落地后,这张旁表应整体换成那份投影。
 */
export interface AssistantExecutionViz {
  /** 工具调用折叠列表(applyToolCallEvent 的输出,含 D113 流中 diff 预览) */
  toolCalls?: ToolCallItem[]
  /** 计划步骤快照(applyPlanUpdate 的输出;plan_updated 是权威快照 ⇒ 整体替换) */
  planSteps?: PlanStepItem[]
  /** 计划整体解释(PlanUpdateEvent.explanation;缺省即后端没给,不编造) */
  planExplanation?: string
}

/** 可折进 AssistantExecutionViz 的 SSE 帧(kind 为判别式;事件形状逐字沿用 @ihui/api-client 契约) */
export type AssistantExecutionFrame =
  | { readonly kind: 'tool-call'; readonly event: ToolCallEvent }
  | { readonly kind: 'tool-delta'; readonly event: ToolDeltaEvent }
  | { readonly kind: 'plan-update'; readonly event: PlanUpdateEvent }

/**
 * 纯函数:把一帧折进"某条 assistant 消息的执行可视化档",返回新对象(不改入参)。
 * `nowMs` 与 applyToolCallEvent 同口径由调用方显式喂,缺省 Date.now() 只为本屏不必到处传时间。
 * 判别式穷尽 ⇒ 新增帧族必须在这里加一支,漏加会当场 typecheck 红,而不是静默丢帧。
 */
export function applyAssistantExecutionFrame(
  viz: AssistantExecutionViz | undefined,
  frame: AssistantExecutionFrame,
  nowMs: number = Date.now(),
): AssistantExecutionViz {
  const carried: AssistantExecutionViz = { ...(viz ?? {}) }
  switch (frame.kind) {
    case 'tool-call':
      return { ...carried, toolCalls: applyToolCallEvent(viz?.toolCalls, frame.event, nowMs) }
    case 'tool-delta':
      return { ...carried, toolCalls: applyToolDelta(viz?.toolCalls, frame.event) }
    case 'plan-update': {
      const reduced = applyPlanUpdate(frame.event)
      return { ...carried, planSteps: reduced.steps, planExplanation: reduced.explanation }
    }
  }
}

/** 折叠终端任务开始事件(纯函数):按 terminalId 新增或原地重置为 running */
export function applyTerminalStart(
  list: readonly TerminalTaskItem[] | undefined,
  event: TerminalStartEvent,
  nowMs: number = Date.now(),
): TerminalTaskItem[] {
  const prev = list ? [...list] : []
  const idx = prev.findIndex((item) => item.id === event.terminalId)
  const current = idx >= 0 ? prev[idx] : undefined

  const next: TerminalTaskItem = {
    id: event.terminalId,
    command: event.command,
    status: 'running',
    output: current?.output,
    exitCode: current?.exitCode,
    startedAtMs: current?.startedAtMs ?? toEpochMs(event.startedAt) ?? nowMs,
    durationMs: current?.durationMs,
  }

  if (idx >= 0) prev[idx] = next
  else prev.push(next)
  return prev
}

/** 折叠终端任务结束事件(纯函数):按 terminalId 更新终态/输出/退出码/耗时 */
/** D34 上下文注入交代:kind 是取词键,后端中文 collapsed 仅在未知 kind 时兜底显示 */
export interface MessageInjection {
  kind: string
  collapsed: string
  /** 缺省即后端判定超限 —— 不给"可展开"入口 */
  fullText?: string
  count?: number
}

/** #11 引用溯源条目(url 仅在后端确实取到跳转目标时才有,见 ai-service `_citation_url`) */
export interface MessageCitation {
  source: string
  label: string
  url?: string
}

/**
 * citations 帧累积:**追加** + 按 (source,label) 去重。
 * 整替会让流中后到的引用抹掉流首那批(web #26 同因),各端同一口径。
 */
export function appendCitationFrames(
  list: readonly MessageCitation[] | undefined,
  incoming: readonly MessageCitation[],
): MessageCitation[] {
  const next = list ? [...list] : []
  for (const item of incoming) {
    if (next.some((x) => x.source === item.source && x.label === item.label)) continue
    next.push({ source: item.source, label: item.label, ...(item.url ? { url: item.url } : {}) })
  }
  return next
}

/**
 * injection_applied 帧累积:一条回答可能对应多条注入(自定义指令 / 工作区记忆 / Repo Wiki /
 * 检索上下文),必须**追加**并按 kind+collapsed 去重 —— 整体替换会让流首与流中两批互相覆盖。
 */
export function applyInjectionFrame(
  list: readonly MessageInjection[] | undefined,
  event: MessageInjection,
): MessageInjection[] {
  const prev = list ? [...list] : []
  if (prev.some((item) => item.kind === event.kind && item.collapsed === event.collapsed)) {
    return prev
  }
  prev.push({
    kind: event.kind,
    collapsed: event.collapsed,
    fullText: event.fullText,
    count: event.count,
  })
  return prev
}

/** D106 Steer(中途引导)交代项:phase 当前仅 'injected'(预留扩展),
 *  字段与 @ihui/api-client streamChat onSteer 载荷(packages/types chat.ts)严格对齐 */
export interface SteerNotice {
  phase: 'injected'
  /** 用户引导文本(注入 messages 的原文) */
  text: string
  /** 入队时间(ISO,来自 steer 端点) */
  timestamp?: string
  /** 所属 assistant 消息 ID */
  messageId?: string
}

/** 单条 assistant 消息的 steer 交代上限(对齐 web appendSteerNotice / 后端 _STEER_QUEUE_LIMIT) */
export const STEER_NOTICE_MAX_PER_MESSAGE = 8

/**
 * steer 帧累积:一条回答可被多次中途引导,必须**追加**(对齐 web appendSteerNotice 口径)。
 * 空文本/纯空白帧整帧丢弃(没有内容的引导交代对用户只有噪音);四个字段逐字段显式承接
 * (各端 store 枚举式合并,未知字段静默丢,枚举内的字段一个都不许丢)。
 */
export function appendSteerFrames(
  list: readonly SteerNotice[] | undefined,
  event: SteerNotice,
): SteerNotice[] {
  if (typeof event?.text !== 'string' || event.text.trim().length === 0) {
    return list ? [...list] : []
  }
  if ((list?.length ?? 0) >= STEER_NOTICE_MAX_PER_MESSAGE) {
    return [...(list ?? [])]
  }
  return [
    ...(list ?? []),
    {
      phase: 'injected',
      text: event.text,
      ...(typeof event.timestamp === 'string' && event.timestamp
        ? { timestamp: event.timestamp }
        : {}),
      ...(typeof event.messageId === 'string' && event.messageId
        ? { messageId: event.messageId }
        : {}),
    },
  ]
}

/**
 * 从 metadata.steerApplied 还原"这轮中途引导注入了哪些条"(D106 收尾,2026-09-24 立)。
 *
 * api 侧落库形状 [{text, timestamp?}](chat_messages.metadata.steerApplied),
 * 守卫对齐 web readSteerAppliedFromMetadata:数组才采;逐条 text 必须非空字符串,
 * timestamp 仅 string 才带;复用 appendSteerFrames 累积(空文本帧整帧丢弃、8 条封顶、
 * phase 恒 'injected')。老消息 / 无 steer / 全坏 → undefined,不写字段不渲染空态。
 */
export function readSteerAppliedFromMetadata(raw: unknown): SteerNotice[] | undefined {
  if (!Array.isArray(raw)) return undefined
  let out: SteerNotice[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    out = appendSteerFrames(out, {
      phase: 'injected',
      text: typeof rec.text === 'string' ? rec.text : '',
      ...(typeof rec.timestamp === 'string' ? { timestamp: rec.timestamp } : {}),
    })
  }
  return out.length > 0 ? out : undefined
}

export function applyTerminalEnd(
  list: readonly TerminalTaskItem[] | undefined,
  event: TerminalEndEvent,
  nowMs: number = Date.now(),
): TerminalTaskItem[] {
  const prev = list ? [...list] : []
  const idx = prev.findIndex((item) => item.id === event.terminalId)
  const current = idx >= 0 ? prev[idx] : undefined

  const next: TerminalTaskItem = {
    id: event.terminalId,
    command: current?.command ?? '',
    status: event.status,
    output: event.output ?? current?.output,
    truncated: event.truncated ?? current?.truncated,
    totalChars: event.totalChars ?? current?.totalChars,
    exitCode: event.exitCode ?? current?.exitCode,
    startedAtMs: current?.startedAtMs ?? toEpochMs(event.endedAt),
    durationMs:
      event.durationMs ??
      (current?.startedAtMs !== undefined ? Math.max(0, nowMs - current.startedAtMs) : undefined),
  }

  if (idx >= 0) prev[idx] = next
  else prev.push(next)
  return prev
}

/** 格式化耗时:缺失/非法 → '';<1000ms → 'Nms';否则 'N.Ns' */
export function formatDurationMs(durationMs: number | undefined): string {
  if (durationMs === undefined || !Number.isFinite(durationMs) || durationMs < 0) return ''
  if (durationMs < 1000) return `${Math.round(durationMs)}ms`
  return `${(durationMs / 1000).toFixed(1)}s`
}

/** 参数/结果结构化文本:字符串原样返回,对象缩进序列化,空值返回 '' */
export function formatStructured(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2) ?? String(value)
  } catch {
    // 循环引用等序列化失败场景降级为 String(不抛错,避免渲染崩溃)
    return String(value)
  }
}

/** 端内取词函数(与本端 `useI18n().t` 同一契约;第二参是 ICU 变量) */
export type ToolRowTranslateFn = (key: string, params?: Record<string, string | number>) => string

/** `mcpToolActivityTitle` 只读这四字段,签名收窄便于调用方与测试都只喂必要项 */
export type McpToolRowInput = Pick<ToolCallItem, 'name' | 'status' | 'serverSource' | 'serverName'>

/**
 * MCP 工具行的定制措辞(D83 接线,mobile-rn 端的渲染点入口)。
 *
 * 措辞层本身不在端内:`@ihui/shared/chat` 的 `describeMcpToolActivity` 才是唯一数据源
 * (server×tool → server → tool → 功能名 → 码名 五级回落 + 双时态 + 带上下文档),
 * web(`task-status-bar.tsx` / `tool-call-card.tsx`)与小程序(`cards/tool-line.ts`)
 * 已各自接上;本函数把同一份链接到本端的工具卡片行标题上,键一律在
 * `taskStatus` 命名空间下取(与本端 `t('taskStatus.xxx')` 的既有点号全路径一致)。
 *
 * 返回 `null` 表示"这一行没有可渲染的定制/通用措辞",调用方必须沿用既有功能名口径:
 * - 非 MCP(`serverSource !== 'mcp'`)—— 内置工具走 `describeToolCall` 的功能名,不归本层管;
 * - error 态 —— 对失败的调用声称"已 X"是假陈述(与 web / 小程序同一口径);
 * - 整条链走到链尾只剩原始码名 —— 界面禁止直显 `create_issue` 这类码名;
 * - 语言包取不到而回显键名 —— 见下面 translate 闭包里那条"端内回显折成空串"的判据。
 *
 * 关于最后一条:共享层的 `usableRenderedText` 是拿**未加命名空间前缀**的键比渲染结果,
 * 而本端 `t` 缺键时回显的是**点号全路径**(`taskStatus.toolMcpXxxActivity`),两者不等 ⇒
 * 那道守卫在本端形状上判不出回显。本端键的拼法只有本端知道,故在取词边界上归一,
 * 不去改共享层判据(改了要同时复核 web / 小程序两个消费端,属另一票)。
 */
export function mcpToolActivityTitle(
  item: McpToolRowInput,
  translate: ToolRowTranslateFn,
): string | null {
  if (item.serverSource !== 'mcp' || item.status === 'error') return null
  const line = describeMcpToolActivity({
    serverName: item.serverName ?? null,
    toolName: item.name,
    // 本端三态 → 共享层双时态:success 即"已完成"档,running 即"进行中"档
    state: item.status === 'running' ? 'running' : 'completed',
    translate: (key, params) => {
      const namespacedKey = `taskStatus.${key}`
      const text = translate(namespacedKey, params)
      // 回显键名 → 交空串:共享层的可用性判据认空串为"本级未命中",会继续走链,
      // 最终落回原始码名,由上面的 `line === item.name` 折成 null。
      return text === namespacedKey ? '' : text
    },
  })
  return line === item.name ? null : line
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
