// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

export * from './auth'
export * from './notifications'
export * from './validation'
export * from './workflows'
export * from './utils'
export * from './hooks'
export * from './stores'
export * from './skills/market'
export * from './tasks/dispatch'
export * from './design/element'
export * from './subagents'
// 2026-11-27（F0/P0-03/V2-08）：总管智能体注册表契约单一源（角色/模式/状态/错误码/作用域 + 名称规则）。
// 新代码只从这里取枚举；旧 subagents 域只保留 @deprecated 适配层。
export {
  AGENT_ROLES,
  AGENT_ROLE_VALUES,
  // 注意：barrel 里的 `AgentRole` 仍是 ./subagents 的 @deprecated 5 值旧域
  // （apps/web 的 Record<AgentRole,...> 穷尽表仍需它）；注册表 10+custom 用这个名字。
  type AgentRole as AgentRegistryRole,
  type BuiltinAgentRole,
  ORCHESTRATION_MODES,
  ORCHESTRATION_MODE_ALIASES,
  // 同理：`OrchestrationMode` 保留 ./subagents 的 9+2 别名兼容层，规范 9 模式叫这个。
  type OrchestrationMode as AgentOrchestrationMode,
  type OrchestrationModeAlias,
  type OrchestrationModeInput,
  normalizeOrchestrationMode,
  isAgentRole,
  isBuiltinAgentRole,
  isOrchestrationMode,
  isOrchestrationModeAlias,
  RUN_STATUSES,
  TERMINAL_RUN_STATUSES,
  ACTIVE_RUN_STATUSES,
  type RunStatus,
  type TerminalRunStatus,
  isRunStatus,
  isTerminalRunStatus,
  DEFINITION_STATUSES,
  type DefinitionStatus,
  isDefinitionStatus,
  APPROVAL_STATUSES,
  type ApprovalStatus,
  isApprovalStatus,
  SCOPES,
  type Scope,
  isScope,
  ERROR_CODES as AGENT_ERROR_CODES,
  ERROR_HTTP_STATUS,
  RETRYABLE_ERROR_CODES,
  type ErrorCode as AgentErrorCode,
  isErrorCode,
  httpStatusForErrorCode,
  isRetryableErrorCode,
} from './agent-registry/contracts'
export * from './context'
export * from './spec'
export * from './plan'
export * from './chat'
// 2026-11-23:会话标题纯文本净化(剥 Markdown 强调/行首编号/`(think)` 残片)与默认标题常量
// 已随 `./utils` 的 barrel 覆盖 —— web 侧栏、D176 交接标题、api 生成与入库四处同一份规则。
// G3 Beyond-Coding 泛化:统一 Artifact 交付物体系(纯类型+校验+渲染,跨端单一真相源)
export * from './artifact'
export * from './constants'
export * from './navigation/sidebar-nav'
export * from './navigation/drawer-ui-contract'
export * from './pay'
export * from './share'
export * from './seo'
export * from './sse'
export * from './types'
export * from './relay-account-verdict'
export * from './permission'
export * from './chat/conversation-org-server'
// D155 下行告警记录的收敛形状(唯一真相源,2026-11-13 定;miniapp api 层按根入口取名,
// 此前 barrel 缺席 ⇒ TS2305 —— 端内不重定义一份,补这一行即三端同名可达)。
export * from './chat/stream-alerts'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
