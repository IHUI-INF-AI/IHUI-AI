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
// 能力清单(2026-11-26 四程序对标 W4-01):声明式扩展契约的形状校验与启用条件判定。
export {
  CAPABILITY_ID_PATTERN,
  CAPABILITY_PERMISSION_PATTERN,
  CAPABILITY_VERSION_PATTERN,
  CAPABILITY_VIEW_LOCATIONS,
  evaluateEnablement,
  isValidEnablement,
  parseCapabilityManifest,
  satisfiesVersionRange,
} from './capability-manifest.js'
export type {
  AgentPluginContribution,
  CapabilityContributions,
  CapabilityFilePreviewer,
  CapabilityManifest,
  CapabilityManifestParseResult,
  CapabilityMentionProvider,
  CapabilitySessionResource,
  CapabilitySidebarItem,
  CapabilityView,
  CapabilityViewLocation,
  EnablementEnvironment,
  EnablementExpression,
  ManifestIssue,
  ManifestIssueCode,
  ManifestParseOptions,
  NativeModuleContribution,
} from './capability-manifest.js'
// 会话格式版本化(2026-11-26 四程序对标 W4-13):逐版本迁移 + 有损声明 + 未知版本即拒。
export {
  SESSION_FORMAT_V0,
  SESSION_FORMAT_CURRENT_VERSION,
  SessionFormatRegistry,
  SessionFormatRegistryError,
  createSessionFormatRegistry,
  isSessionFormatRecord,
} from './session-format.js'
export type {
  SessionFormatCodec,
  SessionFormatMigrateFail,
  SessionFormatMigrateOk,
  SessionFormatMigrateResult,
  SessionFormatParseFail,
  SessionFormatParseOk,
  SessionFormatParseResult,
  SessionFormatRecord,
  SessionFormatRegistryErrorCode,
  SessionFormatStep,
} from './session-format.js'
// 宿主 API 契约(2026-11-26 四程序对标 W4-07):四服务面 + 事件 payload 必绑类型 + 稳定签名比对。
export { assertHostApiContract, validateHostApiContract } from './host-api-contract.js'
export { diffHostApiContracts, serializeHostApiContract } from './host-api-contract-serde.js'
export { HOST_API_CONTRACT_V1 } from './host-api-contract-v1.js'
export { HostApiContractError } from './host-api-contract-types.js'
export type {
  HostApiContract,
  HostApiDrift,
  HostApiDriftKind,
  HostApiEvent,
  HostApiIssue,
  HostApiIssueCode,
  HostApiMethod,
  HostApiService,
  HostApiType,
  HostApiValidateFail,
  HostApiValidateOk,
  HostApiValidateResult,
} from './host-api-contract-types.js'
// RP-12 超越点A(2026-11-26 四程序对标 Qoder QoderModelPurpose):模型用途枚举 + 用途感知路由。
// 单一真相源:用途值域只此一份;fail-closed:未知用途恒拒,不降级到 main 猜。
export {
  MODEL_PURPOSES,
  MODEL_PURPOSE_UNKNOWN,
  isModelPurpose,
  isWithinBudget,
  resolvePurposeModels,
} from './model-purpose.js'
export type {
  ModelPurpose,
  ModelPurposeBudget,
  ModelPurposeRoute,
  ModelPurposeRouteTable,
} from './model-purpose.js'

// agent 沙箱执行策略(执行前判定层):危险命令拒绝 + 资源上限 + 环境脱敏 + 审计。
// 相对 DeepSeek harness(直接把 node/python 给 AI、无防护)的核心超越。零依赖自洽,
// 危险命令判据由调用方注入(生产用 @ihui/shared detectDangerousCommands),保持单一真相源。
export {
  DEFAULT_SANDBOX_LIMITS,
  evaluateSandboxCommand,
  looksLikeSecretEnvKey,
  sanitizeEnv,
} from './sandbox-policy.js'
export type {
  SandboxAuditRecord,
  SandboxCommand,
  SandboxContext,
  SandboxDecision,
  SandboxDenyCode,
  SandboxLimits,
} from './sandbox-policy.js'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
