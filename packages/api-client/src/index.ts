export {
  fetchApi,
  setTokenProvider,
  setBaseUrl,
  streamChat,
  parseStreamLine,
  parseStreamLineReasoning,
  getSSEErrorInfo,
  formatSSEError,
} from './client.js'
export type {
  TokenProvider,
  StreamChatOptions,
  SSEErrorInfo,
  SSEErrorSeverity,
  FormattedSSEError,
  FetchApiOptions,
} from './client.js'
export { ApiError, isNotFound, isErrorCode } from './api-error.js'

export { CircuitBreaker, CircuitOpenError, serverPreset, clientPreset } from './circuit-breaker.js'
export type { CircuitState, CircuitBreakerOptions, CircuitBreakerStats } from './circuit-breaker.js'
export { eduApi, buildQs } from './utils.js'
export type { PageData, PageQuery } from './utils.js'

// WebSocket 跨端客户端(框架无关,各端写薄包装层)
export {
  WebSocketClient,
  createNotificationClient,
  buildNotificationWsUrl,
  isWSNotification,
} from './ws-client.js'
export type { WebSocketClientOptions, WebSocketClientHandlers, WebSocketLike } from './ws-client.js'

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

export * from './endpoints/admin.js'
export * from './endpoints/admin-auth.js'
export * from './endpoints/admin-content.js'
export * from './endpoints/admin-member.js'
export * from './endpoints/admin-monitor.js'
export * from './endpoints/admin-system.js'
export * from './endpoints/agent.js'
export * from './endpoints/agent-runtime.js'
export * from './endpoints/ai.js'
export * from './endpoints/ai-media.js'
export * from './endpoints/auth.js'
export * from './endpoints/business.js'
export * from './endpoints/category.js'
export * from './endpoints/chat.js'
export * from './endpoints/community.js'
export * from './endpoints/course.js'
export * from './endpoints/crew.js'
export * from './endpoints/developer.js'
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
} from './endpoints/distribution.js'
export * from './endpoints/exam.js'
export * from './endpoints/learn.js'
export * from './endpoints/live.js'
export * from './endpoints/llm.js'
export * from './endpoints/knowledge-rag.js'
export * from './endpoints/misc.js'
export * from './endpoints/notification.js'
export * from './endpoints/order.js'
export * from './endpoints/payment.js'
export * from './endpoints/resource.js'
export * from './endpoints/share.js'
export * from './endpoints/subscription.js'
export * from './endpoints/system.js'
export * from './endpoints/token.js'
export * from './endpoints/user.js'
export * from './endpoints/vip.js'
export * from './endpoints/wallet.js'
export * from './endpoints/workspace.js'

// 架构迁移审计 P2 v2 补开发:5 个新端点共享封装(private-letters / wrong-questions / mail / auth-codes / exam-marking)
export * from './endpoints/auth-codes.js'
export * from './endpoints/exam-marking.js'
export * from './endpoints/mail.js'
export * from './endpoints/private-letters.js'
export * from './endpoints/wrong-questions.js'

// Explicit re-exports to resolve naming conflicts between modules.
// 同名函数签名/用途不同,显式指定主来源以消除 export * 歧义(TS2308)。
// 仍可通过子路径 @ihui/api-client/endpoints/<name> 访问任一模块的同名导出。
export { getRanking } from './endpoints/business.js'
export { getMessages, sendMessage } from './endpoints/chat.js'
export { getCategories } from './endpoints/system.js'
export { getUserStatistics } from './endpoints/user.js'
export { getAuthRole, updateAuthRole } from './endpoints/admin-system.js'
