// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 对话消息 → 可渲染模型(纯函数,2026-09-12 W6 立)。
 *
 * 目的:把各端 ChatMessage(reasoning / toolCalls / planSteps / terminalTasks /
 * subagentActivities 等异构字段)归一化成平台无关的「块(block)数组」,
 * 由 web / extension / mobile-rn 各自实现渲染层复用:
 * - apps/extension 为 W6 首个消费者(MessageContent.tsx);
 * - apps/mobile-rn 为 W7 后续消费者(RN 侧只写渲染层,不重写数据映射)。
 *
 * 硬约束:
 * - 纯函数:同一输入必得同一输出,不做 IO、不读系统时间、不生成随机 ID。
 * - 零 React / 零 DOM / 零 react-native 依赖:RN 端可直接 import,无需任何 shim。
 *
 * 字段映射规则(ChatMessage → RenderBlock):
 * | ChatMessage 字段       | 渲染块 kind | 说明 |
 * |-----------------------|-------------|------|
 * | content               | markdown    | 非空时产出 1 块;正文 Markdown 原文 |
 * | reasoning             | reasoning   | 非空时产出 1 块 |
 * | toolCalls[]           | tool        | 每次调用 1 块;耗时优先 durationMs,回退 deprecated duration |
 * | planSteps[]           | plan        | 聚合成 1 块(含全部步骤,不拆块) |
 * | terminalTasks[]       | terminal    | 每个终端任务 1 块 |
 * | subagentActivities[]  | subagent    | 每个子代理 1 块 |
 * | meta.usage            | 不产块      | 提取到 RenderModel.usage |
 * | error                 | 不产块      | 提取到 RenderModel.isError |
 *
 * 块顺序:reasoning → markdown → tool → plan → terminal → subagent。
 * 与 web/extension 既有阅读顺序一致(先思考、再正文、再执行细节)。
 *
 * 说明:第二参数 options.streaming 由调用方显式传入(不在函数内探测),
 * 以保证函数纯度;它只影响 reasoning/markdown 块的 streaming 标记。
 */
import type { ChatMessage, ChatRole, ToolCall } from '@ihui/types/chat'
import type {
  PlanStep,
  PlanStepStatus,
  SubAgentActivity,
  SubAgentStatus,
  TerminalTask,
  TerminalTaskStatus,
} from '@ihui/types/ai'

// 复用 @ihui/api-client 的 SSE 错误格式化(shared 侧无同类实现,直接 re-export 单一来源)。
// 依赖方向:@ihui/shared → @ihui/api-client(api-client 不依赖 shared,无循环依赖)。
export { formatSSEError } from '@ihui/api-client'
export type { FormattedSSEError, SSEErrorInfo } from '@ihui/api-client'

/** 渲染块类型(平台无关,各端按 kind 分派各自渲染组件) */
export type RenderBlockKind = 'markdown' | 'reasoning' | 'tool' | 'plan' | 'terminal' | 'subagent'

/** Token 用量(自 ChatMessage.meta.usage 提取) */
export interface RenderUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

/** 正文块:Markdown 原文,由各端 Markdown 渲染器消费 */
export interface MarkdownRenderBlock {
  kind: 'markdown'
  id: string
  text: string
  /** 是否仍在流式输出(用于光标/打字动效) */
  streaming: boolean
}

/** 推理过程块(reasoning model 输出) */
export interface ReasoningRenderBlock {
  kind: 'reasoning'
  id: string
  text: string
  streaming: boolean
}

/** 工具调用块 */
export interface ToolRenderBlock {
  kind: 'tool'
  id: string
  toolName: string
  status: ToolCall['status']
  isError: boolean
  args?: Record<string, unknown>
  result?: unknown
  durationMs?: number
  serverSource?: ToolCall['serverSource']
  serverId?: string
  serverName?: string
  /** 媒体产物(图/音/视频 URL 或异步任务 ID),无媒体时为 undefined */
  media?: {
    image_url?: string
    audio_url?: string
    video_url?: string
    task_id?: string
  }
}

/** Plan 步骤(渲染用最小字段集) */
export interface RenderPlanStep {
  id: string
  step: string
  status: PlanStepStatus
  durationMs?: number
  error?: boolean
}

/** 执行计划块:整条消息的 planSteps 聚合为 1 块 */
export interface PlanRenderBlock {
  kind: 'plan'
  id: string
  steps: RenderPlanStep[]
  explanation?: string
}

/** 终端任务块 */
export interface TerminalRenderBlock {
  kind: 'terminal'
  id: string
  command: string
  status: TerminalTaskStatus
  output?: string
  /** 后端截断标志与原始长度(各端终端块都要能交代"内容不完整",不能只渲染 output) */
  truncated?: boolean
  totalChars?: number
  exitCode?: number
  durationMs?: number
}

/** 子代理活动块 */
export interface SubagentRenderBlock {
  kind: 'subagent'
  id: string
  name: string
  type: string
  status: SubAgentStatus
  currentStep: string
  completedSteps: SubAgentActivity['completedSteps']
  streamingContent?: string
  streamingDone?: boolean
  progressPhase?: SubAgentActivity['progressPhase']
  progressTool?: string
  toolCallsCount?: number
  outputPreview?: string
}

/** 渲染块联合类型 */
export type RenderBlock =
  | MarkdownRenderBlock
  | ReasoningRenderBlock
  | ToolRenderBlock
  | PlanRenderBlock
  | TerminalRenderBlock
  | SubagentRenderBlock

/** 消息级渲染模型 */
export interface RenderModel {
  id: string
  role: ChatRole
  /** 消息正文(Markdown 原文);空字符串表示无正文 */
  text: string
  /** 归一化块列表(顺序固定,见文件头映射规则) */
  blocks: RenderBlock[]
  /** 是否无任何可渲染内容(渲染层据此显示 "..." 占位) */
  isEmpty: boolean
  /** 是否错误消息 */
  isError: boolean
  /** Token 用量(meta.usage 提取,缺失时 undefined) */
  usage?: RenderUsage
  createdAt?: number
  model?: string
}

/** buildRenderModel 可选参数(显式传入以保持纯函数) */
export interface RenderModelOptions {
  /** 该消息是否仍在流式输出(影响 markdown/reasoning 块 streaming 标记) */
  streaming?: boolean
}

/** 从 meta.usage 安全提取 token 用量(字段缺失/类型不符时返回 undefined) */
function extractUsage(meta: Record<string, unknown> | undefined): RenderUsage | undefined {
  const raw = meta?.usage
  if (!raw || typeof raw !== 'object') return undefined
  const u = raw as Record<string, unknown>
  const promptTokens = typeof u.promptTokens === 'number' ? u.promptTokens : undefined
  const completionTokens = typeof u.completionTokens === 'number' ? u.completionTokens : undefined
  const totalTokens = typeof u.totalTokens === 'number' ? u.totalTokens : undefined
  if (promptTokens === undefined || completionTokens === undefined || totalTokens === undefined) {
    return undefined
  }
  return { promptTokens, completionTokens, totalTokens }
}

/** ChatMessage.toolCalls[] → tool 块(耗时优先 durationMs,回退 deprecated duration) */
function toToolBlock(messageId: string, call: ToolCall, index: number): ToolRenderBlock {
  const media = {
    image_url: call.image_url,
    audio_url: call.audio_url,
    video_url: call.video_url,
    task_id: call.task_id,
  }
  const hasMedia = Object.values(media).some((v) => typeof v === 'string' && v.length > 0)
  return {
    kind: 'tool',
    id: `${messageId}:tool:${call.id || index}`,
    toolName: call.toolName,
    status: call.status,
    isError: call.isError ?? call.status === 'error',
    args: call.args,
    result: call.result,
    durationMs: call.durationMs ?? call.duration,
    serverSource: call.serverSource,
    serverId: call.serverId,
    serverName: call.serverName,
    ...(hasMedia ? { media } : {}),
  }
}

/** ChatMessage.planSteps[] → 单个 plan 块 */
function toPlanBlock(messageId: string, steps: PlanStep[]): PlanRenderBlock {
  const explanation = steps.find((s) => s.explanation)?.explanation
  return {
    kind: 'plan',
    id: `${messageId}:plan`,
    steps: steps.map((s, i) => ({
      id: s.id || `${messageId}:plan:${i}`,
      step: s.step,
      status: s.status,
      durationMs: s.durationMs,
      error: s.error,
    })),
    ...(explanation ? { explanation } : {}),
  }
}

/** ChatMessage.terminalTasks[] → 每个任务 1 块 */
function toTerminalBlock(
  messageId: string,
  task: TerminalTask,
  index: number,
): TerminalRenderBlock {
  return {
    kind: 'terminal',
    id: `${messageId}:terminal:${task.id || index}`,
    command: task.command,
    status: task.status,
    output: task.output,
    truncated: task.truncated,
    totalChars: task.totalChars,
    exitCode: task.exitCode,
    durationMs: task.durationMs,
  }
}

/** ChatMessage.subagentActivities[] → 每个子代理 1 块 */
function toSubagentBlock(
  messageId: string,
  agent: SubAgentActivity,
  index: number,
): SubagentRenderBlock {
  return {
    kind: 'subagent',
    id: `${messageId}:subagent:${agent.agentId || index}`,
    name: agent.name,
    type: agent.type,
    status: agent.status,
    currentStep: agent.currentStep,
    completedSteps: agent.completedSteps,
    streamingContent: agent.streamingContent,
    streamingDone: agent.streamingDone,
    progressPhase: agent.progressPhase,
    progressTool: agent.progressTool,
    toolCallsCount: agent.toolCallsCount,
    outputPreview: agent.outputPreview,
  }
}

/**
 * 核心纯函数:ChatMessage → RenderModel。
 *
 * @param message 跨端聊天消息(基础契约见 @ihui/types/chat)
 * @param options 渲染上下文(仅 streaming 标记,显式传入以保证纯度)
 */
export function buildRenderModel(
  message: ChatMessage,
  options: RenderModelOptions = {},
): RenderModel {
  const streaming = options.streaming ?? false
  const blocks: RenderBlock[] = []

  // 1. 推理过程(先于正文)
  if (message.reasoning && message.reasoning.length > 0) {
    blocks.push({
      kind: 'reasoning',
      id: `${message.id}:reasoning`,
      text: message.reasoning,
      streaming: streaming && message.content.length === 0,
    })
  }

  // 2. 正文 Markdown
  if (message.content && message.content.length > 0) {
    blocks.push({
      kind: 'markdown',
      id: `${message.id}:content`,
      text: message.content,
      streaming,
    })
  }

  // 3. 工具调用
  for (const [i, call] of (message.toolCalls ?? []).entries()) {
    blocks.push(toToolBlock(message.id, call, i))
  }

  // 4. 执行计划(聚合为单块)
  if (message.planSteps && message.planSteps.length > 0) {
    blocks.push(toPlanBlock(message.id, message.planSteps))
  }

  // 5. 终端任务
  for (const [i, task] of (message.terminalTasks ?? []).entries()) {
    blocks.push(toTerminalBlock(message.id, task, i))
  }

  // 6. 子代理活动
  for (const [i, agent] of (message.subagentActivities ?? []).entries()) {
    blocks.push(toSubagentBlock(message.id, agent, i))
  }

  return {
    id: message.id,
    role: message.role,
    text: message.content,
    blocks,
    isEmpty: blocks.length === 0,
    isError: message.error === true,
    usage: extractUsage(message.meta),
    createdAt: message.createdAt,
    model: message.model,
  }
}

/** 批量构建(供列表渲染,保持同一纯度) */
export function buildRenderModels(
  messages: ChatMessage[],
  options: RenderModelOptions = {},
): RenderModel[] {
  return messages.map((m) => buildRenderModel(m, options))
}

// ==================== Agent 运行时面板(链路 B)辅助纯函数 ====================

/**
 * 把链路 B 的纯文本 plan(executeAgentRuntimeStream 的 onPlan 只给 string)降级解析为
 * 渲染步骤数组,使 AgentRuntimePanel 能与消息级 plan 共用同一结构化渲染模型。
 *
 * 支持的常见写法(逐行解析,命中即取,不命中默认 pending):
 * - Markdown 复选框:`- [ ] 步骤` / `- [x] 步骤` / `- [>] 步骤`
 * - 圆括号状态: `1. (in_progress) 步骤`
 * - 方括号状态: `1. [completed] 步骤`
 * - 纯序号列表:  `1. 步骤` / `2) 步骤` / `- 步骤`
 *
 * @param plan 后端返回的计划原始文本
 * @returns 结构化步骤数组(空文本返回空数组)
 */
export function parsePlanText(plan: string): RenderPlanStep[] {
  if (!plan) return []
  const steps: RenderPlanStep[] = []
  for (const rawLine of plan.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    // 剥掉列表前缀(- / * / 1. / 1) / 1、)
    const stripped = line.replace(/^(?:[-*]|\d+[.)、])\s*/, '')
    if (!stripped) continue
    const status = detectStepStatus(stripped)
    const text = stripped
      .replace(/^\[[ xX>\-/]\]\s*/, '')
      .replace(/^\((?:pending|in_progress|completed|done|failed)\)\s*/i, '')
      .replace(/^\[(?:pending|in_progress|completed|done|failed)\]\s*/i, '')
      .trim()
    if (!text) continue
    steps.push({ id: `plan-step-${steps.length}`, step: text, status })
  }
  return steps
}

/** 从单行文本识别步骤状态(未命中默认 pending) */
function detectStepStatus(line: string): PlanStepStatus {
  if (
    /^\[[xX]\]/.test(line) ||
    /\((completed|done)\)/i.test(line) ||
    /\[(completed|done)\]/i.test(line)
  ) {
    return 'completed'
  }
  if (/^\[[>\-/]\]/.test(line) || /\(in_progress\)/i.test(line) || /\[in_progress\]/i.test(line)) {
    return 'in_progress'
  }
  return 'pending'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
