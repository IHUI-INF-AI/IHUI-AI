/**
 * 历史遗留的极简 ChatMessage(2026-07-31 标注)。
 * 与 packages/shared/src/hooks/use-chat.ts 的 ChatMessage 同名但定义不一致。
 * 新代码应优先使用 shared 版本(含 toolCalls / reasoning / meta 等字段);
 * 本接口仅保留向后兼容,勿再扩展。
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface AgentTask {
  id: string;
  goal: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
}

// ==================== AI 对话可视化深度接入(2026-07-31 立) ====================
// 为 AI 对话可视化深度接入提供跨端类型契约:
// - ToolCallSource:工具调用来源(builtin/plugin/mcp)
// - ToolCallSummary:工具调用汇总(SSE 流末尾由后端聚合发出)
// - BaseToolCall:基础工具调用接口(各端继承后扩展端独占字段)

/** 工具调用来源(2026-07-31 立,AI 对话可视化深度接入) */
export type ToolCallSource = 'builtin' | 'plugin' | 'mcp'

/**
 * 工具调用汇总(2026-07-31 立,在 SSE 流末尾由后端聚合发出)。
 * - 未收到 tool-summary SSE 事件时,前端可降级从 message.toolCalls 数组本地聚合
 * - 收到时直接使用,无需重复计算
 */
export interface ToolCallSummary {
  /** 搜索文件次数(read_file/search_codebase/file_search 工具调用次数) */
  filesSearched: number
  /** 搜索网页次数(web_search/search_web 工具调用次数) */
  webSearched: number
  /** 修改的文件数(edit_file/write_file 工具调用去重后的文件路径数) */
  filesModified: number
  /** 新增行数(edit_file/write_file 工具 diff 中 + 行数) */
  linesAdded: number
  /** 删除行数(edit_file/write_file 工具 diff 中 - 行数) */
  linesDeleted: number
  /** 按工具分类统计(如 { read_file: 3, edit_file: 2, web_search: 1 }) */
  toolsByCategory: Record<string, number>
  /** 总工具调用次数(等于 Object.values(toolsByCategory).reduce((a,b)=>a+b,0)) */
  totalCalls: number
  /** 总耗时(ms,从第一个 tool-call-start 到最后一个 tool-result) */
  totalDurationMs?: number
}

/**
 * 基础工具调用接口(2026-07-31 立,扩展版,跨端共享)。
 * - web 端在 stores/chat.ts 中继承此接口扩展 InlineDiff/ApplyStatus 等本地字段
 * - ai-service 后端在 SSE 事件中按此结构返回字段
 */
export interface BaseToolCall {
  /** 工具调用 ID(SSE tool-call-start 事件的 toolCallId) */
  id: string
  /** 工具名(如 read_file / edit_file / browser_navigate) */
  toolName: string
  /** 工具调用参数(JSON object) */
  args?: Record<string, unknown>
  /** 工具调用结果(tool-result 事件的 result 字段) */
  result?: unknown
  /** 工具调用状态:running=执行中 / success=成功 / error=失败 */
  status: 'running' | 'success' | 'error'
  /** 是否为错误结果(tool-result 事件的 isError 字段) */
  isError?: boolean
  /** 工具调用迭代轮次(LangGraph tool loop 的 iteration) */
  iteration?: number
  /** 后端 repeated: true 标记(同 tool_name + 同 args 已执行过,跳过实际调用) */
  repeated?: boolean
  /** 工具调用耗时(ms,tool-result 到达时计算) */
  durationMs?: number
  /**
   * MCP server 来源标识(2026-07-31 新增,用于 ToolCallCard 区分原生/MCP 工具)。
   * - builtin: AGENT_TOOLS 内置工具(read_file/edit_file 等)
   * - plugin: 用户从插件市场添加的 PLUGIN_ID_TO_TOOLS 工具
   * - mcp: 通过 MCP server 注册的外部工具(serverId/serverName 必填)
   */
  serverSource?: ToolCallSource
  /** MCP server ID(serverSource='mcp' 时必填,如 'context7' / 'filesystem' / 'github' 等) */
  serverId?: string
  /** MCP server 显示名(serverSource='mcp' 时必填,如 'Context7 MCP' / 'Filesystem MCP' 等) */
  serverName?: string
}

// ==================== AI 对话可视化 Phase 2:消息级 SSE 事件类型(2026-07-31 立) ====================
// 为 SubagentActivity / PlanStep / TerminalTask 三类 SSE 事件提供跨端类型契约,
// 让后端 SSE 事件能关联到具体的 assistant 消息 ID(messageId),
// 前端按消息分组写入,在消息气泡内 inline 展示。
//
// 分两层:
// 1. SSE 协议事件层:SubagentSpawnEvent/EndEvent/ProgressEvent/PlanUpdateEvent/TerminalStartEvent/EndEvent
//    - 后端 SSE 流发出的事件契约(字段与 @ihui/api-client streamChat 解析逻辑对齐)
//    - messageId?: 关联到触发该事件的 assistant 消息(2026-07-31 新增,后端 SSE 增强由主 agent 处理)
// 2. 消息级展示层:SubAgentActivity / PlanStep / TerminalTask
//    - 前端 ChatMessage 字段引用的聚合数据结构(字段与 apps/web 现有定义对齐,主 agent 后续统一)
//    - messageId?: 关联到所属 assistant 消息

/** Subagent 派发生成事件(2026-07-28 立,ai-service tool loop 中 dispatch_subagent 工具执行前发出)。
 *  字段与 @ihui/api-client streamChat 的 tryParseSubagent 解析逻辑对齐。 */
export interface SubagentSpawnEvent {
  /** subagent 唯一 ID */
  id: string
  /** subagent 角色(如 validator/reviewer) */
  role: string
  /** subagent 执行的任务描述 */
  task: string
  /** 事件时间戳(ISO 8601) */
  timestamp: string
  /** 2026-07-31 Phase 2:关联到触发该 subagent 的 assistant 消息 ID。
   *  后端 SSE 携带时前端按消息分组写入 message.subagentActivities;缺失时降级到进度面板。 */
  messageId?: string
}

/** Subagent 派发结束事件(dispatch_subagent 工具执行后发出) */
export interface SubagentEndEvent {
  /** subagent 唯一 ID */
  id: string
  /** 最终状态:done=成功 / failed=失败 */
  status: 'done' | 'failed'
  /** 失败原因(status='failed' 时存在) */
  failureReason?: string
  /** 事件时间戳(ISO 8601) */
  timestamp: string
  /** 2026-07-31 Phase 2:关联到触发该 subagent 的 assistant 消息 ID */
  messageId?: string
}

/** Subagent 执行进度事件(2026-07-28 立,subagent 执行期间实时发出):
 *  - phase='thinking': subagent 开始 LLM 调用(含 iteration)
 *  - phase='tool_call': subagent 开始调用工具(含 tool name + iteration)
 *  - phase='tool_result': subagent 工具返回(含 tool name + ok + iteration)
 *  - phase='output_ready': subagent 最终输出就绪(含 output_preview)
 *  字段与 @ihui/api-client streamChat 的 tryParseSubagent 解析逻辑对齐。 */
export interface SubagentProgressEvent {
  /** subagent 唯一 ID */
  id: string
  /** 执行阶段 */
  phase: 'thinking' | 'tool_call' | 'tool_result' | 'output_ready'
  /** 事件时间戳(ISO 8601) */
  timestamp: string
  /** 当前迭代轮次(phase=thinking/tool_call/tool_result 时存在) */
  iteration?: number
  /** 工具名(phase=tool_call/tool_result 时存在) */
  tool?: string
  /** 工具是否成功(phase=tool_result 时存在) */
  ok?: boolean
  /** 输出预览(phase=output_ready 时存在,截断 200 字符) */
  outputPreview?: string
  /** agent 名称(并行模式下标识哪个 agent) */
  agentName?: string
  /** 2026-07-31 Phase 2:关联到触发该 subagent 的 assistant 消息 ID */
  messageId?: string
}

/** Plan 步骤状态(Codex 风格三状态,2026-07-27 重构对齐)。
 *  注意:与 packages/shared/src/plan/index.ts 的 PlanStepStatus(五状态)不同,
 *  本类型用于 AI 对话可视化 Phase 2 消息级 plan steps(Codex 协议对齐)。 */
export type PlanStepStatus = 'pending' | 'in_progress' | 'completed'

/** Plan 步骤(消息级展示,对应 Codex PlanItemArg + explanation)。
 *  字段与 apps/web/src/hooks/use-agent-progress.ts 的 PlanStep 对齐,主 agent 后续统一引用。 */
export interface PlanStep {
  /** 步骤唯一 ID */
  id: string
  /** 步骤标题/描述 */
  step: string
  /** 步骤状态(Codex 三状态) */
  status: PlanStepStatus
  /** 可选解释(Codex UpdatePlanArgs.explanation) */
  explanation?: string
  /** 开始时间(ISO 8601) */
  startedAt?: string
  /** 结束时间(ISO 8601) */
  endedAt?: string
  /** 耗时(ms) */
  durationMs?: number
  /** Codex:step 累计 token 消耗(可选,由 status 事件更新) */
  tokenUsage?: number
  /** 错误标记(toolCalls error 时为 true,PlanStepsCard 显示红色错误样式) */
  error?: boolean
  /** 关联消息 ID(用于点击步骤跳转消息 + hover 联动,apps/web 已有字段) */
  sourceMessageId?: string
  /** 步骤分组编号(同一条 assistant 消息的步骤同组,组间视觉分隔) */
  groupIndex?: number
  /** 2026-07-31 Phase 2:关联到所属 assistant 消息 ID。
   *  与 sourceMessageId 语义相同,主 agent 后续可统一为单一字段。 */
  messageId?: string
}

/** Plan 更新 SSE 事件(2026-07-31 Phase 2 新增):
 *  后端在 plan_updated 事件中携带 messageId 时,前端按消息分组写入 message.planSteps。
 *  字段对齐 apps/web use-agent-progress.ts 的 extractPlanFromEvents 解析逻辑。 */
export interface PlanUpdateEvent {
  /** 关联到所属 assistant 消息 ID(2026-07-31 Phase 2 新增) */
  messageId?: string
  /** 可选解释(Codex UpdatePlanArgs.explanation) */
  explanation?: string
  /** plan 步骤数组(权威快照,整体替换前端 message.planSteps) */
  plan: Array<{
    step: string
    status: PlanStepStatus
    startedAt?: string
    endedAt?: string
    durationMs?: number
    tokenUsage?: number
  }>
  /** 事件时间戳(ISO 8601) */
  timestamp?: string
}

/** 终端任务状态 */
export type TerminalTaskStatus = 'running' | 'completed' | 'failed'

/** 终端任务(消息级展示,后台终端执行)。
 *  字段与 apps/web/src/hooks/use-agent-progress.ts 的 TerminalTask 对齐。 */
export interface TerminalTask {
  /** 终端任务唯一 ID */
  id: string
  /** 执行的命令 */
  command: string
  /** 执行状态 */
  status: TerminalTaskStatus
  /** 命令输出 */
  output?: string
  /** 开始时间(ISO 8601) */
  startedAt: string
  /** 结束时间(ISO 8601) */
  endedAt?: string
  /** 耗时(ms) */
  durationMs?: number
  /** 退出码(completed=0 / failed=非 0) */
  exitCode?: number
  /** 2026-07-31 Phase 2:关联到所属 assistant 消息 ID */
  messageId?: string
}

/** 终端任务开始 SSE 事件(2026-07-31 Phase 2 新增):
 *  后端在 terminal_start 事件中携带 messageId 时,前端按消息分组写入 message.terminalTasks。 */
export interface TerminalStartEvent {
  /** 终端任务唯一 ID */
  terminalId: string
  /** 执行的命令 */
  command: string
  /** 初始状态(开始时为 'running') */
  status: 'running'
  /** 开始时间(ISO 8601) */
  startedAt?: string
  /** 2026-07-31 Phase 2:关联到所属 assistant 消息 ID */
  messageId?: string
}

/** 终端任务结束 SSE 事件(2026-07-31 Phase 2 新增):
 *  后端在 terminal_end 事件中携带 messageId 时,前端更新对应 message.terminalTasks 项。 */
export interface TerminalEndEvent {
  /** 终端任务唯一 ID */
  terminalId: string
  /** 最终状态 */
  status: TerminalTaskStatus
  /** 命令输出 */
  output?: string
  /** 退出码 */
  exitCode?: number
  /** 结束时间(ISO 8601) */
  endedAt?: string
  /** 耗时(ms) */
  durationMs?: number
  /** 2026-07-31 Phase 2:关联到所属 assistant 消息 ID */
  messageId?: string
}

/** Subagent 状态(用于 SubAgentActivity.status,与 apps/web AgentStatus 字面量对齐)。
 *  命名为 SubAgentStatus 以避免与未来可能的 AgentStatus 类型冲突,语义更精确。 */
export type SubAgentStatus =
  | 'idle'
  | 'pending'
  | 'thinking'
  | 'acting'
  | 'reflecting'
  | 'waiting'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

/** 子智能体单步执行结果(用于 SubAgentActivity.completedSteps) */
export interface SubAgentStep {
  stepAction: string
  createdAt: string
  status: 'pending' | 'running' | 'completed' | 'failed'
}

/** 子智能体活动(消息级展示)。
 *  字段与 apps/web/src/components/ai/types.ts 的 SubAgentActivity 对齐,主 agent 后续统一引用。 */
export interface SubAgentActivity {
  /** subagent ID */
  agentId: string
  /** 显示名称 */
  name: string
  /** 类型 */
  type: string
  /** 当前状态 */
  status: SubAgentStatus
  /** 当前步骤描述 */
  currentStep: string
  /** 已完成步骤列表 */
  completedSteps: SubAgentStep[]
  /** 流式 token 累积内容(上层按 agentId 分流后填入);缺失表示该 agent 无 token 流 */
  streamingContent?: string
  /** 流式是否结束:true=已完成,false/undefined=进行中 */
  streamingDone?: boolean
  /** 当前执行阶段(subagent_progress SSE 事件驱动) */
  progressPhase?: 'thinking' | 'tool_call' | 'tool_result' | 'output_ready'
  /** 当前迭代轮次(progress 事件携带) */
  progressIteration?: number
  /** 当前调用的工具名(phase=tool_call/tool_result 时存在) */
  progressTool?: string
  /** 工具调用累计次数(每收到一次 tool_result 递增) */
  toolCallsCount?: number
  /** 输出预览(phase=output_ready 时存在,截断 200 字符) */
  outputPreview?: string
  /** 2026-07-31 Phase 2:关联到所属 assistant 消息 ID */
  messageId?: string
}
