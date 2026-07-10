/**
 * AI 组件群共享类型定义
 * 从旧架构 client/src/components/ai/ 迁移
 */

/** AI 能力模式 */
export type AICapabilityMode = 'model' | 'agent' | 'agentic' | 'mcp' | 'generation'

/** AI 能力类型（统一编排用） */
export type AICapabilityType = 'model' | 'agent' | 'agentic' | 'mcp' | 'hybrid'

/** 模型分类 */
export type ModelCategory = 'talk' | 'image' | 'video' | 'audio' | 'videoa' | 'other'

/** 生成类型 */
export type GenerationType = 'auto' | 'image' | 'video' | '3d' | 'vision' | 'audio' | 'music'

/** 图像服务商 */
export type ImageProvider = 'qwen' | 'doubao' | 'jimeng'

/** 视频服务商 */
export type VideoProvider = 'qwen' | 'kling' | 'one-click'

/** 通用能力项 */
export interface CapabilityItem {
  id: string
  name: string
  description?: string
  icon?: string
  iconUrl?: string
  tags?: string[]
  metadata?: Record<string, unknown>
}

/** AI 模型信息 */
export interface AIModelInfo extends CapabilityItem {
  provider: string
  category: ModelCategory
}

/** Agent 信息 */
export interface AgentInfo extends CapabilityItem {
  platform?: string
  type?: string
}

/** MCP 工具 */
export interface MCPTool extends CapabilityItem {
  serverId?: string
  serverName?: string
  category?: string
}

/** MCP 服务器 */
export interface MCPServer {
  id: string
  name: string
  protocol: string
  status: 'connected' | 'disconnected' | 'error' | 'connecting'
  toolsCount?: number
  description?: string
}

/** Agent 状态 */
export type AgentStatus =
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

/** 子智能体单步执行结果 */
export interface SubAgentStep {
  stepAction: string
  createdAt: string
  status: 'pending' | 'running' | 'completed' | 'failed'
}

/** 子智能体活动 */
export interface SubAgentActivity {
  agentId: string
  name: string
  type: string
  status: AgentStatus
  currentStep: string
  completedSteps: SubAgentStep[]
}

/** Swarm 数据 */
export interface SwarmData {
  swarm?: {
    swarmId: string
    status: AgentStatus
    task: string
    currentIteration: number
    maxIterations: number
  }
  agentList?: Array<{
    name: string
    type: string
    status: AgentStatus
    currentStep?: string
  }>
  results?: SwarmResult[]
}

/** Swarm 执行结果 */
export interface SwarmResult {
  step_id: string
  step_action: string
  result?: string
  error_message?: string
  created_at: string
  tool_results?: Array<{
    toolId: string
    result?: unknown
    error?: string
  }>
  reflection?: unknown
}

/** Swarm 性能指标 */
export interface SwarmPerformanceMetrics {
  successRate: number
  averageStepTime: number
  averageTokensPerStep: number
  totalSteps: number
  completedSteps: number
  failedSteps: number
}

/** 后台 Agent */
export interface BackgroundAgent {
  agent_id: string
  status: AgentStatus
  prompt: string
  created_at: string
  updated_at?: string
  progress?: {
    text_preview?: string
    tool_calls?: number
  }
  result?: {
    output?: string
  }
  error?: string
}

/** 待确认的工具调用 */
export interface PendingToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  reason?: string
  iteration?: number
}

/** 行内 Diff 信息 */
export interface InlineDiffInfo {
  file_path: string
  old_content: string
  new_content: string
  is_new_file?: boolean
}

/** Diff 行 */
export interface DiffLine {
  type: 'added' | 'removed' | 'context'
  prefix: string
  content: string
  oldLineNumber: number | string
  newLineNumber: number | string
}

/** 统一 AI 调用响应 */
export interface UnifiedAIResponse {
  success: boolean
  data?: unknown
  error?: string
  capabilityId?: string
  capabilityType?: AICapabilityType
  timestamp: number
}

/** 能力组合模板 */
export interface CapabilityComposition {
  id: string
  name: string
  description: string
}
