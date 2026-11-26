// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

export {
  query,
  DEFAULT_ABORT_GRACE_MS,
  DEFAULT_KILL_GRACE_MS,
  DEFAULT_PERMISSION_TIMEOUT_MS,
  DEFAULT_STDERR_LIMIT,
} from './query.js'
export type {
  AgentEvent,
  CanUseTool,
  PermissionDecision,
  QueryOptions,
  QueryResult,
  ToolPermissionRequest,
} from './query.js'

export { AgentSdkError, JsonRpcPeer, NdjsonDecoder, encodeMessage } from './protocol.js'
// L14/RP-21 三端共用协议契约(方法表 + 错误码单一真相源)
export {
  ACP_METHODS,
  ACP_NOTIFICATION_METHODS,
  ACP_REQUEST_METHODS,
  AGENT_SDK_ERROR_CODES,
} from './contract.js'
export type { AcpMethodKey, AcpMethodName } from './contract.js'
// L03/RP-7 审批反向通道三队列(审批/备份/恢复):断线不丢、重连按序补发
export { ApprovalChannel, ApprovalChannelError, APPROVAL_QUEUE_KINDS } from './approval-channel.js'
export type {
  ApprovalChannelErrorCode,
  ApprovalChannelStats,
  ApprovalDecisionKind,
  ApprovalEnvelope,
  ApprovalQueueKind,
  ApprovalRequestInput,
} from './approval-channel.js'
// L05/RP-8 动态通道注册表:通道名唯一真相源 + 未注册即拒(计数/审计)
export {
  CHANNEL_KINDS,
  CHANNEL_NAME_PATTERN,
  ChannelDispatcher,
  ChannelRegistry,
  ChannelRegistryError,
  ChannelRejected,
} from './channel-registry.js'
export type {
  ChannelAuditRecord,
  ChannelDispatcherOptions,
  ChannelKind,
  ChannelRegistryErrorCode,
  ChannelSpec,
} from './channel-registry.js'
// L07/RP-24 桥版本握手:HELLO 摘要 + mismatch 禁用入口 + fail-closed 首屏门 + bundle 静态校验
export {
  BRIDGE_METHOD_PATTERN,
  BRIDGE_PROTOCOL_VERSION,
  BridgeHandshakeError,
  computeMethodDigest,
  createBridgeHello,
  createFailClosedGate,
  negotiateBridge,
  scanBridgeCalls,
} from './bridge-handshake.js'
export type {
  BridgeEntrypointSpec,
  BridgeHandshakeErrorCode,
  BridgeHello,
  BridgeNegotiationResult,
  NativeBridgeManifest,
} from './bridge-handshake.js'
// L12/RP-26 通道域隔离:agent/ui/remote-session 三域独立 ACL/版本/健康/审计分表
export {
  CHANNEL_DOMAINS,
  DOMAIN_PREFIXES,
  DomainChannelRouter,
  DomainRejected,
} from './channel-domain.js'
export type {
  ChannelDomain,
  DomainAuditRecord,
  DomainConfig,
  DomainRejectReason,
} from './channel-domain.js'
export type {
  AgentSdkErrorCode,
  AgentSdkErrorOptions,
  ContentBlock,
  DecodeResult,
  JsonRpcErrorObject,
  JsonRpcErrorResponse,
  JsonRpcId,
  JsonRpcMessage,
  JsonRpcNotification,
  JsonRpcNotificationHandler,
  JsonRpcPeerOptions,
  JsonRpcRequest,
  JsonRpcRequestHandler,
  JsonRpcResponse,
  JsonRpcSuccessResponse,
  PermissionOption,
  PermissionOptionKind,
  SessionUpdate,
  StopReason,
} from './protocol.js'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
