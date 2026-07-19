/**
 * 跨端 API 契约类型 — 单一导入面。
 *
 * 范围:web / api / ai-service / desktop / extension / mobile-rn / miniapp-taro / cli
 *       八端共享 API 契约类型(用户/认证/分页/通知/消息/WebSocket/工作区/智能体/AI 聊天)。
 *
 * 设计原则:
 * 1. **纯类型,无运行时** — 仅 `interface` / `type` 声明 + 类型守卫(无业务数据,无副作用)。
 * 2. **零冗余** — 全部 `export type` / `export` 自 `@ihui/types` 子模块,不重新定义。
 * 3. **稳定入口** — 各端从此处导入共享类型,避免散落在 `endpoints/*` 文件中。
 *
 * 注意:
 * - 端点专属类型(AuthUser / AiModel / CourseItem / ...)继续在 `@ihui/api-client/endpoints/*` 中定义
 *   (与运行时 fetch 函数就近耦合),各端通过 `@ihui/api-client` 导入。
 * - 本文件只承载**跨端共享的、不与特定 fetch 函数耦合的**契约类型。
 * - 命名冲突已显式 `export type`(详见 @ihui/types/index.ts 的 PermissionMode/PermissionDecision 注释)。
 */

// ===================== 用户与认证 =====================
export type { User, UserProfile, AuthToken } from './user.js'

// ===================== 通用 API 响应包装 =====================
export type { ApiResponse, PaginatedResponse, ApiResult } from './api.js'

// ===================== AI 聊天 =====================
export type { ChatMessage, ChatRequest, AgentTask } from './ai.js'

// ===================== 通知 / WebSocket =====================
export type {
  WSNotification,
  AIResponseNotification,
  NotificationItem,
  MessageItem,
  UnreadCount,
  CustomerServiceSession,
  CustomerServiceMessage,
} from './notification.js'
export { isAIResponse } from './notification.js'

export type {
  NotificationChannel,
  ChannelConfig,
  DingtalkMessage,
  FeishuMessage,
  WechatWorkMessage,
} from './notification-channels.js'

// ===================== 消息自愈(CLI/API/ai-service 共用) =====================
export type { RepairableMessage, RepairResult } from './message-repair.js'
export { repairMessages } from './message-repair.js'

// ===================== 智能体运行时 =====================
export type {
  PermissionMode,
  PermissionDecision,
  DangerLevel,
  PermissionRules,
  PermissionCheckResult,
  PlanState,
  PlanEvent,
  PlanContext,
  HookEvent,
  HookContext,
  HookEntry,
  HooksConfig,
  HookResult,
  JSONSchema,
  JSONSchemaType,
  PersonaContract,
  PersonaContracts,
  SessionStatus,
  SessionMessage,
  SessionState,
  SessionSummary,
  SubagentPersona,
  CapabilityMode,
  IsolationMode,
  SkillFrontmatter,
  SkillDefinition,
} from './agent-runtime.js'

// ===================== 工作区(adjacent tagging wire 协议) =====================
export type {
  SessionId,
  ToolCallId,
  HunkId,
  RewindPoint,
  TaggedRequest,
  WorkspaceRequest,
  BeginPromptData,
  EndPromptData,
  CancelPromptData,
  CreateSessionData,
  LoadSessionData,
  PromptMode,
  Attachment,
  ToolChunk,
  ToolCallStartData,
  ToolCallDeltaData,
  ToolCallEndData,
  ToolCallErrorData,
  WorkspaceEvent,
  SessionCreatedData,
  SessionLoadedData,
  PromptStartedData,
  PromptCompletedData,
  PromptCancelledData,
  ErrorData,
  ConversationItem,
  UserMessage,
  AssistantMessage,
  ToolCallMessage,
  ToolResultMessage,
  SystemMessage,
  PermissionRequest,
  PermissionRequestData,
  PermissionAllowData,
  PermissionDenyData,
  UsageStats,
} from './workspace.js'
export { isWorkspaceRequest, isToolChunk, isWorkspaceEvent } from './workspace.js'
