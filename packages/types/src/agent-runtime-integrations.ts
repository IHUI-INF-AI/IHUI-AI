// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 外部集成与适配域跨端契约:MCP sampling、IM 消息(历史版,barrel 经 im-gateway.ts 显式导出新版)、沙箱、MoA/Provider 兜底/凭据池、多模态/Vision、OTEL、ImPlatform、Git/GitHub 操作面。
// 自 agent-runtime.ts 拆出(2026-10-08,C2 契约文件行上限 2000 收口;拆分前该文件 2164 行)。
// 内容按行段逐字节搬移,经 agent-runtime.ts 的 export * 链路再导出,公开导出面与拆分前
// 逐名等值 —— @ihui/types 主入口、api-contracts、mobile-rn mock 的消费面均不受影响。
// 守门静态锚定的词汇域(权限模式词表 / AGENT_INSTANCE_STATES / AGENT_TASK_STATUSES /
// AGENT_TURN_STOP_REASONS / AgentSSEEvent / CONNECTION_CAPABILITY_FIELDS)仍实体留在 agent-runtime.ts。
// ============================================================================
// MCP Sampling 反向调用契约(P1-3)
// ============================================================================

/** MCP Sampling 请求(MCP 工具反向请求 LLM 推理) */
export interface McpSamplingRequest {
  /** 调用方 MCP 工具名 */
  callerTool: string
  /** LLM 推理的 messages */
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  /** 期望模型(可选,缺省用主模型) */
  model?: string
  /** 最大 token(默认 1024) */
  maxTokens?: number
  /** 温度(默认 0.7) */
  temperature?: number
  /** 工具调用上下文(用于审计) */
  context?: string
}

/** MCP Sampling 响应 */
export interface McpSamplingResponse {
  /** LLM 输出内容 */
  content: string
  /** 实际使用模型 */
  model: string
  /** token 使用量 */
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
  /** 是否被护栏拦截(如速率限制/白名单) */
  blocked: boolean
  /** 拦截原因(blocked=true 时有值) */
  blockedReason?: string
}

/** Sampling 护栏配置(5 层) */
export interface SamplingGuardrails {
  /** 速率限制(RPM,默认 10) */
  rateLimitRpm: number
  /** 模型白名单(允许被 sampling 调用的模型) */
  modelWhitelist: string[]
  /** 最大工具调用轮数(默认 5) */
  maxToolRounds: number
  /** 超时秒数(默认 30) */
  timeoutSeconds: number
  /** 是否记录审计日志 */
  auditLog: boolean
}

// ============================================================================
// IM 平台 gateway 契约(P1-1)
// ============================================================================

/** IM 平台类型已扩展至 16 种,定义见文件末尾 P3-5 节(原 8 → 16,覆盖 Hermes Agent 15+ 渠道) */

/** IM 消息方向 */
export type ImMessageDirection = 'inbound' | 'outbound'

/** IM 消息类型 */
export type ImMessageType = 'text' | 'image' | 'file' | 'audio' | 'video' | 'card'

/** IM 入站消息(从 IM 平台到 IHUI-AI) */
export interface ImInboundMessage {
  /** 平台类型 */
  platform: ImPlatform
  /** 平台原始消息 ID */
  platformMessageId: string
  /** 发送者 ID(平台侧) */
  fromUserId: string
  /** 发送者昵称 */
  fromUserName?: string
  /** 会话/群 ID */
  chatId: string
  /** 消息类型 */
  messageType: ImMessageType
  /** 文本内容 */
  text?: string
  /** 媒体 URL(图片/文件/音视频) */
  mediaUrl?: string
  /** 是否群消息 */
  isGroup: boolean
  /** @机器人 标记 */
  mentionedBot: boolean
  /** 平台原始 payload(完整 webhook 数据) */
  rawPayload: unknown
  /** 接收时间(ISO) */
  receivedAt: string
}

/** IM 出站消息(从 IHUI-AI 到 IM 平台) */
export interface ImOutboundMessage {
  /** 平台类型 */
  platform: ImPlatform
  /** 目标会话/群 ID */
  chatId: string
  /** 消息类型 */
  messageType: ImMessageType
  /** 文本内容 */
  text?: string
  /** 媒体 URL */
  mediaUrl?: string
  /** 卡片结构(platform=feishu/wecom 时可用) */
  card?: unknown
  /** 回复的消息 ID(可选) */
  replyToMessageId?: string
}

/** IM gateway 适配器配置 */
export interface ImAdapterConfig {
  /** 平台类型 */
  platform: ImPlatform
  /** 是否启用 */
  enabled: boolean
  /** webhook secret(验签) */
  webhookSecret?: string
  /** bot token */
  botToken?: string
  /** app id(飞书/企业微信) */
  appId?: string
  /** app secret */
  appSecret?: string
  /** 回调 URL(出站消息 API) */
  callbackUrl?: string
}

/** IM gateway 状态 */
export interface ImGatewayStatus {
  platform: ImPlatform
  enabled: boolean
  connected: boolean
  lastMessageAt?: string
  messageCount: number
  error?: string
}

// ============================================================================
// 沙箱后端契约(P2-1)
// ============================================================================

/** 沙箱后端类型(对标 Hermes 6 种后端) */
export type SandboxBackendType =
  | 'local' // 本地执行(现有)
  | 'docker' // Docker 容器隔离
  | 'ssh' // 远程 SSH 执行
  | 'modal' // Modal serverless GPU
  | 'daytona' // Daytona 云开发环境
  | 'singularity' // HPC 集群 Singularity

/** 沙箱配置 */
export interface SandboxConfig {
  /** 后端类型 */
  backend: SandboxBackendType
  /** 工作目录(本地)或镜像名(Docker)或主机地址(SSH) */
  target: string
  /** 超时秒数(默认 60) */
  timeoutSeconds?: number
  /** Docker 镜像(backend=docker 时) */
  image?: string
  /** SSH 主机(backend=ssh 时) */
  host?: string
  /** SSH 用户名 */
  user?: string
  /** SSH 端口(默认 22) */
  port?: number
  /** 环境变量 */
  env?: Record<string, string>
  /** 资源限制(CPU/内存) */
  resourceLimits?: {
    cpuCores?: number
    memoryMb?: number
    diskMb?: number
  }
}

/** 沙箱执行结果 */
export interface SandboxExecutionResult {
  /** 退出码(0=成功) */
  exitCode: number
  /** stdout */
  stdout: string
  /** stderr */
  stderr: string
  /** 执行时长(ms) */
  durationMs: number
  /** 使用的后端 */
  backend: SandboxBackendType
  /** 是否超时 */
  timedOut: boolean
}

// ============================================================================
// LLM Provider 扩展契约(P2-2)
// ============================================================================

/** MoA(Mixture of Agents)预设 */
export interface MoaPreset {
  /** 预设名 */
  name: string
  /** 描述 */
  description: string
  /** 参与模型列表(按权重) */
  models: Array<{
    /** provider 名 */
    provider: string
    /** 模型名 */
    model: string
    /** 权重(0-1) */
    weight: number
    /** 角色:proposer(出方案)/ aggregator(聚合)/ critic(批判) */
    role: 'proposer' | 'aggregator' | 'critic'
  }>
  /** 聚合策略 */
  aggregationStrategy: 'weighted_average' | 'vote' | 'best_of_n' | 'cascade'
}

/** Provider 故障转移配置 */
export interface ProviderFallbackConfig {
  /** 主 provider */
  primary: string
  /** 备用 provider 列表(按优先级) */
  fallbacks: string[]
  /** 触发转移的错误类型 */
  triggerOnError: Array<
    'rate_limited' | 'auth_error' | 'overloaded' | 'timeout' | 'context_too_long' | 'unknown'
  >
  /** 重试次数(默认 1) */
  maxRetries?: number
}

/** 凭证池配置(多 key 轮询) */
export interface CredentialPoolConfig {
  /** provider 名 */
  provider: string
  /** API key 列表(轮询使用) */
  apiKeys: string[]
  /** 轮询策略 */
  rotationStrategy: 'round_robin' | 'least_used' | 'random'
  /** 单 key 速率限制(RPM) */
  perKeyRateLimit?: number
}

// ============================================================================
// 多模态输入契约(P2-3)
// ============================================================================

/** 多模态输入类型 */
export type MultimodalInputType = 'text' | 'image' | 'video' | 'audio'

/** 多模态消息内容块(对齐 OpenAI vision 格式) */
export interface MultimodalContentBlock {
  /** 内容类型 */
  type: 'text' | 'image_url' | 'input_image' | 'input_video' | 'input_audio'
  /** 文本内容(type=text 时) */
  text?: string
  /** 图片 URL(type=image_url 时) */
  imageUrl?: { url: string; detail?: 'auto' | 'low' | 'high' }
  /** base64 编码的图片/视频/音频(type=input_* 时) */
  data?: string
  /** 媒体 MIME 类型 */
  mediaType?: string
}

/** 视觉分析请求 */
export interface VisionAnalyzeRequest {
  /** 图片 URL 或 base64 */
  image: string
  /** 分析任务描述 */
  task: string
  /** 期望模型(可选) */
  model?: string
  /** 最大 token(默认 1024) */
  maxTokens?: number
}

/** 视觉分析响应 */
export interface VisionAnalyzeResponse {
  /** 分析结果文本 */
  analysis: string
  /** 实际使用模型 */
  model: string
  /** 检测到的对象列表(可选) */
  detectedObjects?: Array<{
    label: string
    confidence: number
    bbox?: [number, number, number, number]
  }>
  /** token 使用量 */
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
}

// ============================================================================
// 可观测性契约(P2-4)
// ============================================================================

/** Otel Span 类型 */
export type OtelSpanKind = 'internal' | 'server' | 'client' | 'producer' | 'consumer'

/** Trace 上下文(跨端传递) */
export interface TraceContext {
  /** trace ID */
  traceId: string
  /** span ID */
  spanId: string
  /** 父 span ID(可选) */
  parentSpanId?: string
  /** baggage(跨端携带的键值对) */
  baggage?: Record<string, string>
}

/** 可观测性埋点配置 */
export interface OtelSpanConfig {
  /** span 名 */
  name: string
  /** span 类型 */
  kind: OtelSpanKind
  /** 属性(键值对) */
  attributes?: Record<string, string | number | boolean>
  /** 关联的 trace 上下文(跨端传递时) */
  traceContext?: TraceContext
}

/** 端到端 trace 事件 */
export interface TraceEvent {
  /** 事件名 */
  name: string
  /** 时间戳(ISO) */
  timestamp: string
  /** 端标识(web/api/ai-service/cli/desktop/extension/mobile-rn/miniapp-taro) */
  endpoint: string
  /** span ID */
  spanId: string
  /** 父 span ID */
  parentSpanId?: string
  /** 属性 */
  attributes?: Record<string, string | number | boolean>
  /** 状态(ok/error) */
  status: 'ok' | 'error'
  /** 错误信息(status=error 时) */
  error?: string
}

// ============================================================================
// IM 平台扩展契约(P3-5,2026-07-22 立)
// 对标 Hermes Agent:15+ 消息渠道(原 8 + 新增 7+ = 15+)
// ============================================================================

/** IM 平台类型(扩展 8 → 16,覆盖 Hermes Agent 15+ 渠道) */
export type ImPlatform =
  | 'feishu' // 飞书(原)
  | 'wecom' // 企业微信(原)
  | 'dingtalk' // 钉钉(原)
  | 'discord' // Discord(原)
  | 'telegram' // Telegram(原)
  | 'slack' // Slack(原)
  | 'wechat' // 微信公众号/小程序(原)
  | 'webhook' // 通用 webhook(原)
  | 'whatsapp' // WhatsApp Business(新增)
  | 'line' // LINE(新增)
  | 'kakaotalk' // KakaoTalk(新增)
  | 'signal' // Signal(新增)
  | 'matrix' // Matrix(新增)
  | 'rocketchat' // Rocket.Chat(新增)
  | 'mattermost' // Mattermost(新增)
  | 'zulip' // Zulip(新增)

// ============================================================================
// Git 工具深化契约(Wave 8,2026-07-22 立)
// 对标 OpenClaw/OpenCode:branch/merge/rebase/stash/conflict/tag/remote + GitHub PR
// ============================================================================

/** Git 操作枚举(只读 + 写入,对标 OpenClaw/OpenCode 完整 Git 工作流) */
export type GitOperation =
  | 'status'
  | 'diff'
  | 'log'
  | 'show'
  | 'branch_list'
  | 'branch_create'
  | 'branch_switch'
  | 'branch_delete'
  | 'merge'
  | 'rebase'
  | 'stash_push'
  | 'stash_pop'
  | 'stash_list'
  | 'tag_create'
  | 'tag_list'
  | 'remote_add'
  | 'remote_list'
  | 'conflict_status'
  | 'conflict_resolve'

/** GitHub PR/Issue/Release 操作枚举(via gh CLI 或 REST API) */
export type GitHubOperation =
  | 'pr_create'
  | 'pr_list'
  | 'pr_view'
  | 'pr_review'
  | 'pr_merge'
  | 'pr_comment'
  | 'pr_close'
  | 'pr_reopen'
  | 'pr_checkout'
  | 'issue_create'
  | 'issue_list'
  | 'release_create'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
