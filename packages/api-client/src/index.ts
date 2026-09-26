// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

export {
  fetchApi,
  fetchAiServiceJson,
  fetchRaw,
  fetchText,
  setTokenProvider,
  setDeviceFingerprintProvider,
  getDeviceFingerprintProvider,
  setBaseUrl,
  setUserAgent,
  getUserAgent,
  setStreamBaseUrl,
  getStreamBaseUrl,
  getToken,
  streamChat,
  parseStreamLine,
  parseStreamLineReasoning,
  parseFallbackEvent,
  extractAgentId,
  getSSEErrorInfo,
  formatSSEError,
  // 厂商账号额度耗尽稳定码 + 同族等效替换 reason(2026-09-22 批次 60 前端配套)
  PROVIDER_QUOTA_EXHAUSTED,
  FALLBACK_REASON_QUOTA_EQUIVALENT,
  mergeAbortSignals,
  postToolResult,
  // D77(2026-09-25 立):对话流业务表单的上行出口 —— 与 postToolResult 同一条 ai-service 会话通道
  postFormResponse,
  buildFormResponseEvent,
  // 2026-08-14 补充 re-export:401 自动续期全局单例,web useAuthBootstrap 复用
  // (并行改动 use-auth-bootstrap.ts 依赖它;client.ts 已实现,入口遗漏导致编译失败)
  refreshAccessTokenOnce,
  isAbortError,
  // 2026-09-25 补能力:401 处理器注册口 —— 端内改走本包端点函数后仍能拿到"弹登录框"反馈
  setUnauthorizedHandler,
  getUnauthorizedHandler,
} from './client.js'
export type {
  TokenProvider,
  UnauthorizedContext,
  UnauthorizedHandler,
  DeviceFingerprintProvider,
  StreamChatOptions,
  SSEErrorInfo,
  SSEErrorSeverity,
  FormattedSSEError,
  FetchApiOptions,
  ToolCallEvent,
  ToolSummaryEvent,
  FallbackEvent,
  ToolDelegateEvent,
  SubagentSpawnEvent,
  SubagentEndEvent,
  SubagentProgressEvent,
  CitationsEvent,
  TerminalDeltaEvent,
  UsageEvent,
  // Budget 用量分档提醒事件(2026-09-19 立,网关发,前端 onBudget toast 提示用量进度)
  BudgetEvent,
  // D106(2026-09-22 立):这三帧的类型此前漏 re-export —— 端内要写 onSteer/onInjectionApplied/
  // onRetryScheduled 回调就点不到参数类型,只能自己重抄一份或用 any(§3 类型零技术债禁止)。
  SteerEvent,
  InjectionAppliedEvent,
  RetryScheduledEvent,
} from './client.js'
// AI 对话可视化 Phase 4a 事件类型 re-export(2026-08-01,消息级 plan/terminal inline 展示)
export type { PlanUpdateEvent, TerminalStartEvent, TerminalEndEvent } from '@ihui/types'
export { ApiError, isNotFound, isErrorCode } from './api-error.js'
export { setTransport, getTransport } from './transport.js'
export type { Transport, TransportResponse, TransportInit } from './transport.js'

// 模型上下文容量映射(跨端共享:web/desktop/extension/mobile-rn/miniapp-taro)
export {
  DEFAULT_CONTEXT_CAPACITY,
  getModelContextCapacity,
  formatTokenCount,
} from './model-context-capacity.js'

export { CircuitBreaker, CircuitOpenError, serverPreset, clientPreset } from './circuit-breaker.js'
export type { CircuitState, CircuitBreakerOptions, CircuitBreakerStats } from './circuit-breaker.js'
export { eduApi, buildQs } from './utils.js'
export type { PageData, PageQuery } from './utils.js'

// WebSocket 跨端客户端(框架无关,各端写薄包装层)
export {
  WebSocketClient,
  createNotificationClient,
  buildNotificationWsUrl,
  fetchWsTicket,
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
// 2026-09-26 收口可发布性:此处原有对 @ihui/types 的**具名值**再导出(isAIResponse),
// 它是本包对外唯一一条运行时跨包再导出 ⇒ 只要它在,dependencies 就摘不掉 workspace 协议
// (发出去即 ERR_MODULE_NOT_FOUND)。实测该 pass-through 全仓零消费者:apps/web 用 isAIResponse
// 走 @/hooks/use-websocket,那里直接从 @ihui/types re-export;函数本体仍在 @ihui/types 单点存活
// ⇒ 删掉的是一条无人走的便利出口,不是功能(§7 三问过)。恢复它的前置是 @ihui/types 自身可发布
// (现测 6 条 blocker:exports 指 src / 缺 LICENSE 与 NOTICE / dist 含无扩展名相对 import 等),另计一票。

export * from './endpoints/admin.js'
export * from './endpoints/admin-auth.js'
export * from './endpoints/admin-business.js'
export * from './endpoints/admin-content.js'
export * from './endpoints/admin-member.js'
export * from './endpoints/admin-monitor.js'
export * from './endpoints/admin-deploy.js'
export * from './endpoints/admin-system.js'
// P1-2.2a: SaaS 部署层管理后台 API 端点
export * from './endpoints/admin-tenants.js'
export * from './endpoints/agent.js'
export * from './endpoints/agent-runtime.js'
// Agent 会话 Token 用量(2026-09-07 工作线 A)
export * from './endpoints/agent-usage.js'
// AI 模型定价查询(W4 成本真网计价,2026-09-12)
export * from './endpoints/ai-pricing.js'
// Deep Research 深度研究(2026-09-07 工作线 B)
export * from './endpoints/research.js'
export * from './endpoints/ai.js'
export * from './endpoints/ai-media.js'
export * from './endpoints/auth.js'
export * from './endpoints/banner.js'
export * from './endpoints/business.js'
export * from './endpoints/category.js'
export * from './endpoints/chat.js'
export * from './endpoints/community.js'
// 中文连接器端点(2026-09-02 立,P2-2 语雀/飞书/企微/钉钉文档接入)
export * from './endpoints/connectors.js'
export * from './endpoints/course.js'
export * from './endpoints/crew.js'
export * from './endpoints/developer.js'
// 浏览器降级端点(2026-07-22 立,P1 WorkPanel iframe 降级)
export * from './endpoints/browser.js'
// Browser Hub CDP 端点(2026-07-31 立,P0 WorkPanel CDP 完整 Chrome 升级)
export * from './endpoints/browser-hub.js'
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
  // 分销团队(2026-08-21 建,TeamScreen/TeamDetailScreen 真实链路)
  type TeamStats,
  type TeamMemberItem,
  type TeamMemberDetail,
  getTeamStats,
  getTeamMembers,
  getTeamMemberDetail,
} from './endpoints/distribution.js'
// 下载量统计 API(2026-08-06 立,sidebar + 详情页下载按钮点击上报)
export * from './endpoints/downloads.js'
// 设备推送令牌 API(2026-09-06 立,mobile-cap 推送链路,跨端共享)
export * from './endpoints/devices.js'
// 挣钱中心仪表盘 API(2026-07-31 立,P0 挣钱核心,跨端共享)
export * from './endpoints/earnings.js'
export * from './endpoints/edu.js'
export * from './endpoints/exam.js'
// 文件上传端点(2026-07-28 立,mobile-rn AigcPublishScreen 接入真实文件选择+上传)
export * from './endpoints/files.js'
// 商品端点(2026-09-04 立,GET /goods/select 购物车分页,mobile-rn CartScreen 跨端共享)
export * from './endpoints/goods.js'
export * from './endpoints/learn.js'
export * from './endpoints/live.js'
export * from './endpoints/llm.js'
// IDE LSP 四核心端点(2026-09-10 补转出:CodeEditor 直连 LSP,入口遗漏导致构建失败)
export * from './endpoints/lsp.js'
export * from './endpoints/knowledge-rag.js'
export * from './endpoints/member.js'
export * from './endpoints/misc.js'
// MCP 商店端点(2026-09-01 立,directory/register/external-servers)
export * from './endpoints/mcp.js'
// Artifact 预览端点(2026-09-01 立,对话生成图表 iframe 渲染)
export * from './endpoints/artifacts.js'
// Agent Plan Mode 端点(2026-09-02 立,计划模式确认 UI 后端契约)
export * from './endpoints/agent-plan.js'
// Best-of-N 同任务多副本自动择优端点(2026-09-07 立)
export * from './endpoints/best-of-n.js'
// Self-healing 验证自愈引擎端点(2026-09-11 立,2-3 产品化 web 驾驶舱接线)
export * from './endpoints/self-healing.js'
export * from './endpoints/notification.js'
export * from './endpoints/order.js'
export * from './endpoints/payment.js'
// 插件市场 API(2026-07-22 立,跨端共享)
export * from './endpoints/plugin.js'
export * from './endpoints/resource.js'
export * from './endpoints/share.js'
export * from './endpoints/social.js'
export * from './endpoints/srs.js'
export * from './endpoints/study.js'
export * from './endpoints/subscription.js'
export * from './endpoints/system.js'
export * from './endpoints/voice-stt.js'
export * from './endpoints/teacher.js'
export * from './endpoints/token.js'
export * from './endpoints/user.js'
export * from './endpoints/vip.js'
export * from './endpoints/wallet.js'
export * from './endpoints/workspace.js'
// 外部会话导入端点(2026-09-20 立,D28,web /settings/import 页跨端共享)
export * from './endpoints/conversation-import.js'

// 架构迁移审计 P2 v2 补开发:5 个新端点共享封装(private-letters / wrong-questions / mail / auth-codes / exam-marking)
export * from './endpoints/auth-codes.js'
export * from './endpoints/chat-skills.js'
// AI Skills TOP 19 个 skill 端点(2026-07-23 新增,跨端共享)
export * from './endpoints/skills-market.js'
export * from './endpoints/ai-skills.js'
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
export { getToolGenMeta, postToolGen } from './endpoints/admin-tool-gen.js'
export type {
  GenType,
  GenField,
  GenInput,
  GenResult,
  GenTypeMeta,
  GenMetaResponse,
} from './endpoints/admin-tool-gen.js'

// 旧架构 edu-web 公开 API 端点(2026-07-22 立)
// 覆盖 audit 清单中 carousels/agreements/announcements/points/search 公开端点
// 旧函数名通过 apps/web/src/lib/legacy-edu-api.ts 桥接
export * from './endpoints/legacy-public.js'

// 多平台一键发布(账号 + 任务 + 扫码登录,2026-07-30 新增)
export * from './endpoints/publish.js'

// Coze 平台 API 端点(2026-07-27 立,PAT 直连 Coze 官方 API,跨端共享)
export * from './endpoints/coze.js'

// IM 渠道管理 API 端点(2026-07-31 立,P0 admin/im-channels 16 平台管理配套)
export * from './endpoints/im-channel.js'

// 子智能体(Subagent)派单 + Swarm 拓扑端点(2026-08-26 立,移动端原生化配套)
export * from './endpoints/subagents.js'

// 自媒体助手(技能列表/调用 + 记录,2026-09-05 新增,M3 web→mobile 对齐)
export * from './endpoints/self-media.js'

// 规范(Spec)生成器模板端点(2026-09-05 新增,M3 web→mobile 对齐)
export * from './endpoints/spec.js'

// 上下文引擎只读端点(压缩统计 + 提及检索,2026-09-05 新增,M3 web→mobile 对齐)
export * from './endpoints/context-mentions.js'

// Repo Wiki 端点(代码仓库→知识库文档,2026-09-07 新增)
export * from './endpoints/repo-wiki.js'
// Knowledge Card 端点(仓库级任务经验卡,2026-09-10 新增,2-1 项目知识引擎)
export * from './endpoints/knowledge-card.js'
export * from './endpoints/team-memory.js'
// D29 团队级知识引擎端点(G-35,2026-09-26 立,空间/成员/条目/审计 12 条路径)
export * from './endpoints/team-knowledge.js'

// 用户侧 Agent 定时自动化端点(2026-09-07 新增)
export * from './endpoints/automations.js'
export * from './endpoints/patrol.js'

// GitHub App 管理端点(2026-09-26 立,D15④:admin 安装台账 + 配置状态)
export * from './endpoints/admin-github-app.js'
