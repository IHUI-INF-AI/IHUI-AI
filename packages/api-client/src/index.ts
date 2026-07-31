export {
  fetchApi,
  fetchAiServiceJson,
  fetchRaw,
  fetchText,
  setTokenProvider,
  setBaseUrl,
  setStreamBaseUrl,
  streamChat,
  parseStreamLine,
  parseStreamLineReasoning,
  parseFallbackEvent,
  extractAgentId,
  getSSEErrorInfo,
  formatSSEError,
  mergeAbortSignals,
} from './client'
export type {
  TokenProvider,
  StreamChatOptions,
  SSEErrorInfo,
  SSEErrorSeverity,
  FormattedSSEError,
  FetchApiOptions,
  ToolCallEvent,
  ToolSummaryEvent,
  FallbackEvent,
  SubagentSpawnEvent,
  SubagentEndEvent,
  SubagentProgressEvent,
} from './client'
export { ApiError, isNotFound, isErrorCode } from './api-error'
export { setTransport, getTransport } from './transport'
export type { Transport, TransportResponse, TransportInit } from './transport'

// 模型上下文容量映射(跨端共享:web/desktop/extension/mobile-rn/miniapp-taro)
export {
  DEFAULT_CONTEXT_CAPACITY,
  getModelContextCapacity,
  formatTokenCount,
} from './model-context-capacity'

export { CircuitBreaker, CircuitOpenError, serverPreset, clientPreset } from './circuit-breaker'
export type { CircuitState, CircuitBreakerOptions, CircuitBreakerStats } from './circuit-breaker'
export { eduApi, buildQs } from './utils'
export type { PageData, PageQuery } from './utils'

// WebSocket 跨端客户端(框架无关,各端写薄包装层)
export {
  WebSocketClient,
  createNotificationClient,
  buildNotificationWsUrl,
  isWSNotification,
} from './ws-client'
export type { WebSocketClientOptions, WebSocketClientHandlers, WebSocketLike } from './ws-client'

// 通知类型 re-export(各端统一从 @ihui/api-client 导入,无需单独依赖 @ihui/types)
export type {
  WSNotification,
  AIResponseNotification,
  NotificationItem,
  MessageItem,
  UnreadCount,
  CustomerServiceSession,
  CustomerServiceMessage,
} from '@ihui/types'
export { isAIResponse } from '@ihui/types'

export * from './endpoints/admin'
export * from './endpoints/admin-auth'
export * from './endpoints/admin-business'
export * from './endpoints/admin-content'
export * from './endpoints/admin-member'
export * from './endpoints/admin-monitor'
export * from './endpoints/admin-system'
// P1-2.2a: SaaS 部署层管理后台 API 端点
export * from './endpoints/admin-tenants'
export * from './endpoints/agent'
export * from './endpoints/agent-runtime'
export * from './endpoints/ai'
export * from './endpoints/ai-media'
export * from './endpoints/auth'
export * from './endpoints/banner'
export * from './endpoints/business'
export * from './endpoints/category'
export * from './endpoints/chat'
export * from './endpoints/community'
export * from './endpoints/course'
export * from './endpoints/crew'
export * from './endpoints/developer'
// 浏览器降级端点(2026-07-22 立,P1 WorkPanel iframe 降级)
export * from './endpoints/browser'
// Browser Hub CDP 端点(2026-07-31 立,P0 WorkPanel CDP 完整 Chrome 升级)
export * from './endpoints/browser-hub'
export {
  type CommissionOverview,
  type InviteInfo,
  type InvitedUser,
  type CommissionRecord,
  type CommissionWithdrawRecord,
  type CommissionRanking,
  type DayMonthSummary,
  getOverview,
  getInviteInfo,
  getInvitedUsers,
  getCommissionList,
  getWithdrawList,
  requestWithdraw,
  getDayMonthSummary,
} from './endpoints/distribution'
// 挣钱中心仪表盘 API(2026-07-31 立,P0 挣钱核心,跨端共享)
export * from './endpoints/earnings'
export * from './endpoints/edu'
export * from './endpoints/exam'
// 文件上传端点(2026-07-28 立,mobile-rn AigcPublishScreen 接入真实文件选择+上传)
export * from './endpoints/files'
export * from './endpoints/learn'
export * from './endpoints/live'
export * from './endpoints/llm'
export * from './endpoints/knowledge-rag'
export * from './endpoints/member'
export * from './endpoints/misc'
export * from './endpoints/notification'
export * from './endpoints/order'
export * from './endpoints/payment'
// 插件市场 API(2026-07-22 立,跨端共享)
export * from './endpoints/plugin'
export * from './endpoints/resource'
export * from './endpoints/share'
export * from './endpoints/social'
export * from './endpoints/srs'
export * from './endpoints/study'
export * from './endpoints/subscription'
export * from './endpoints/system'
export * from './endpoints/voice-stt'
export * from './endpoints/teacher'
export * from './endpoints/token'
export * from './endpoints/user'
export * from './endpoints/vip'
export * from './endpoints/wallet'
export * from './endpoints/workspace'

// 架构迁移审计 P2 v2 补开发:5 个新端点共享封装(private-letters / wrong-questions / mail / auth-codes / exam-marking)
export * from './endpoints/auth-codes'
export * from './endpoints/chat-skills'
// AI Skills TOP 19 个 skill 端点(2026-07-23 新增,跨端共享)
export * from './endpoints/ai-skills'
export * from './endpoints/exam-marking'
export * from './endpoints/mail'
export * from './endpoints/private-letters'
export * from './endpoints/wrong-questions'
// Explicit re-exports to resolve naming conflicts between modules.
// 同名函数签名/用途不同,显式指定主来源以消除 export * 歧义(TS2308)。
// 仍可通过子路径 @ihui/api-client/endpoints/<name> 访问任一模块的同名导出。
export { getRanking } from './endpoints/business'
export { getMessages, sendMessage } from './endpoints/chat'
export { getCategories } from './endpoints/system'
export { getUserStatistics } from './endpoints/user'
export { getAuthRole, updateAuthRole } from './endpoints/admin-system'
export { getToolGenMeta, postToolGen } from './endpoints/admin-tool-gen'
export type {
  GenType,
  GenField,
  GenInput,
  GenResult,
  GenTypeMeta,
  GenMetaResponse,
} from './endpoints/admin-tool-gen'

// 旧架构 edu-web 公开 API 端点(2026-07-22 立)
// 覆盖 audit 清单中 carousels/agreements/announcements/points/search 公开端点
// 旧函数名通过 apps/web/src/lib/legacy-edu-api.ts 桥接
export * from './endpoints/legacy-public'

// 多平台一键发布(账号 + 任务 + 扫码登录,2026-07-30 新增)
export * from './endpoints/publish'

// Coze 平台 API 端点(2026-07-27 立,PAT 直连 Coze 官方 API,跨端共享)
export * from './endpoints/coze'

// IM 渠道管理 API 端点(2026-07-31 立,P0 admin/im-channels 16 平台管理配套)
export * from './endpoints/im-channel'
