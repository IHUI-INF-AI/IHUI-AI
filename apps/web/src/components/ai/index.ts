/**
 * AI 组件群 - 从旧架构 Vue3 迁移至 React + shadcn/ui
 *
 * 核心组件：UnifiedAIPanel / MarkdownStream / DiffPreview / InlineDiffViewer
 * Agent 组件：AgentSwarmMonitor / BackgroundAgentsPanel / PermissionConfirmDialog / SubAgentActivityFeed
 * 语音组件：VoiceInput / VoiceRecord
 * 生成组件群：见 ./ai-generation
 * MCP 组件群：见 ./mcp
 */

// 核心组件
export { UnifiedAIPanel } from './unified-ai-panel'
export { MarkdownStream } from './markdown-stream'
export { DiffPreview } from './diff-preview'
export { InlineDiffViewer } from './inline-diff-viewer'

// Agent 组件
export { AgentSwarmMonitor } from './agent-swarm-monitor'
export { BackgroundAgentsPanel } from './background-agents-panel'
export { PermissionConfirmDialog } from './permission-confirm-dialog'
export { SubAgentActivityFeed } from './sub-agent-activity-feed'

// 语音组件
export { VoiceInput } from './voice-input'
export { VoiceRecord } from './voice-record'

// 共享类型
export type {
  AICapabilityMode,
  AICapabilityType,
  ModelCategory,
  GenerationType,
  ImageProvider,
  VideoProvider,
  CapabilityItem,
  AIModelInfo,
  AgentInfo,
  MCPTool,
  MCPServer,
  AgentStatus,
  SubAgentStep,
  SubAgentActivity,
  SwarmData,
  SwarmResult,
  SwarmPerformanceMetrics,
  BackgroundAgent,
  PendingToolCall,
  InlineDiffInfo,
  DiffLine,
  UnifiedAIResponse,
  CapabilityComposition,
} from './types'

// 生成组件群：见 ../ai-generation
// MCP 组件群：见 ../mcp
