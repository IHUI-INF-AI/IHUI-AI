// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { PermissionModeId } from './permission-mode.js'

/** 唯一真源见 ./permission-mode(G-161);此处保留旧名以不破坏既有 import。 */
export type PermissionMode = PermissionModeId

export type PermissionDecision = 'allow' | 'deny' | 'ask'

export type DangerLevel = 'read' | 'write' | 'dangerous'

export interface PermissionRules {
  allow?: string[]
  deny?: string[]
  ask?: string[]
  mode?: PermissionMode
}

export interface PermissionCheckResult {
  allowed: boolean
  reason?: string
}

export type PlanState = 'initialized' | 'gathering' | 'executing' | 'done' | 'cancelled'

export type PlanEvent = 'start' | 'gather_complete' | 'execute_complete' | 'cancel' | 'reset'

export interface PlanContext {
  currentState?: PlanState
  messages?: unknown[]
  planSteps?: string[]
  currentStepIndex?: number
}

export type HookEvent =
  | 'preToolCall'
  | 'postToolCall'
  | 'userPromptSubmit'
  | 'preCompact'
  | 'postCompact'
  | 'notification'
  | 'stop'
  | 'stopFailure'
  | 'postToolUseFailure'
  | 'permissionDenied'
  | 'subagentStart'
  | 'subagentStop'
  | 'sessionStart'
  | 'sessionEnd'

export interface HookContext {
  workspacePath?: string
  sessionId?: string
  toolName?: string
  toolArgs?: unknown
  toolResult?: unknown
  prompt?: string
  error?: string
  reason?: string
  subagentId?: string
  subagentType?: string
  compactedTokensBefore?: number
  compactedTokensAfter?: number
  notificationText?: string
}

export interface HookEntry {
  name: string
  command?: string
  webhook?: string
  method?: 'POST' | 'PUT' | 'GET'
  headers?: Record<string, string>
  body?: string
  matchTool?: string
  blockOnError?: boolean
  timeout?: number
}

export interface HooksConfig {
  preToolCall?: HookEntry[]
  postToolCall?: HookEntry[]
  sessionStart?: HookEntry[]
  sessionEnd?: HookEntry[]
  userPromptSubmit?: HookEntry[]
  preCompact?: HookEntry[]
  postCompact?: HookEntry[]
  notification?: HookEntry[]
  stop?: HookEntry[]
  stopFailure?: HookEntry[]
  postToolUseFailure?: HookEntry[]
  permissionDenied?: HookEntry[]
  subagentStart?: HookEntry[]
  subagentStop?: HookEntry[]
}

export interface HookResult {
  proceed: boolean
  reason?: string
}

export type JSONSchemaType =
  'object' | 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'null'

export interface JSONSchema {
  type?: JSONSchemaType | JSONSchemaType[]
  description?: string
  properties?: Record<string, JSONSchema>
  required?: string[]
  items?: JSONSchema
  enum?: (string | number | boolean | null)[]
  additionalProperties?: boolean | JSONSchema
  [key: string]: unknown
}

export interface PersonaContract {
  input_schema: JSONSchema
  output_schema: JSONSchema
}

export type PersonaContracts = Record<string, PersonaContract>

export type SessionStatus = 'running' | 'completed' | 'failed' | 'cancelled'

/**
 * D103 子智能体实例七态(P 协议层;对标 Codex `localConversation.multiAgentAction.agentState`)。
 *
 * **与 `SessionStatus` 的分工(不另建第二套枚举)**:
 *   · `SessionStatus` 是**会话级**四态(粗粒度,用于会话列表/生命周期);
 *   · 本枚举是**实例级**七态(细粒度),含会话级**完全没有**的三个终态 ——
 *     `pendingInit`(已受理、尚未就绪)、`shutdown`(已关闭)、`notFound`(找不到;竞品有而我方此前无处表达)。
 *   · 两者经 `sessionStatusFromInstance()` **单向下映射**;禁止两套各自演化后再互相比较。
 *
 * 现状取证(2026-09-23):运行时只产出 `subagentStart` / `subagentStop` 两个事件,故本枚举是**新增能力**,
 * 消费方在事件落到七态之前不得假装已有细粒度状态。
 */
export const AGENT_INSTANCE_STATES = [
  'running',
  'completed',
  'errored',
  'interrupted',
  'pendingInit',
  'shutdown',
  'notFound',
] as const

/** 子智能体实例态 */
export type AgentInstanceState = (typeof AGENT_INSTANCE_STATES)[number]

/**
 * 实例七态 → 会话级四态(**唯一映射**;新增实例态时本函数会因 switch 不穷尽而编译失败,防漏改)。
 * `pendingInit` 归 `running`(已受理未就绪仍处活动期);`shutdown` / `notFound` 归 `cancelled`。
 */
export function sessionStatusFromInstance(state: AgentInstanceState): SessionStatus {
  switch (state) {
    case 'running':
    case 'pendingInit':
      return 'running'
    case 'completed':
      return 'completed'
    case 'errored':
      return 'failed'
    case 'interrupted':
    case 'shutdown':
    case 'notFound':
      return 'cancelled'
  }
}

export interface SessionMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp?: string
  toolCallId?: string
  toolName?: string
}

export interface SessionState {
  id: string
  sessionId: string
  createdAt: string
  updatedAt: string
  model?: string
  messages: SessionMessage[]
  toolState?: Record<string, unknown>
  cwd?: string
  status: SessionStatus
  error?: string
}

export interface SessionSummary {
  id: string
  createdAt: string
  updatedAt: string
  status: SessionStatus
}

export type SubagentPersona = 'researcher' | 'coder' | 'reviewer' | 'planner' | 'general'

export type CapabilityMode = 'read-only' | 'read-write' | 'execute' | 'all'

export type IsolationMode = 'none' | 'worktree'

export interface SkillFrontmatter {
  name?: string
  description?: string
  allowedTools?: string[]
  tools?: string[]
  model?: string
  tags?: string[]
  /** Skill 版本(语义化,对齐 agentskills.io 开放标准) */
  version?: string
  /** 许可证(MIT/Apache-2.0 等) */
  license?: string
  /** 前置依赖(命令/环境变量) */
  prerequisites?: SkillPrerequisites
  /** 关联 skill 名(用于渐进式加载的引用层) */
  relatedSkills?: string[]
  /** 是否启用渐进式加载(元数据→指令→引用 3 层),默认 false */
  progressiveDisclosure?: boolean
  /** 来源:builtin(预置)/ user(用户编写)/ auto(自进化生成)/ hub(Skills Hub) */
  source?: SkillSource
  /** 自进化生成时间(ISO,仅 source=auto 时有值) */
  autoGeneratedAt?: string
  /** 自进化触发任务 ID(仅 source=auto 时有值,用于追溯) */
  autoGeneratedFromTask?: string
}

export interface SkillPrerequisites {
  /** 依赖的系统命令(如 ["curl", "jq"]) */
  commands?: string[]
  /** 依赖的环境变量名(如 ["GITHUB_TOKEN"]) */
  env?: string[]
}

export type SkillSource = 'builtin' | 'user' | 'auto' | 'hub'

export interface SkillDefinition {
  filePath: string
  sourceDir: string
  frontmatter: SkillFrontmatter
  content: string
  hasFrontmatter: boolean
}

// ============================================================================
// Skill 自进化契约(P0-2)
// ============================================================================

/** Skill 自进化评估请求(任务结束后 LLM 自评是否提炼可复用模式) */
export interface SkillEvolutionRequest {
  /** 触发任务 ID */
  taskId: string
  /** 会话 ID */
  sessionId: string
  /** 任务目标 */
  goal: string
  /** 任务执行步骤(含 LLM 输出 + 工具调用) */
  steps: Array<{
    iteration: number
    type: 'llm' | 'tool'
    content: string
    toolName?: string
    toolArgs?: unknown
    toolResult?: unknown
  }>
  /** 最终结果 */
  finalResult: string
  /** 现有 skill 名列表(避免重复生成) */
  existingSkills: string[]
}

/** Skill 自进化评估结果 */
export interface SkillEvolutionResult {
  /** 是否提炼出新 skill */
  shouldCreate: boolean
  /** 新 skill 名(shouldCreate=true 时有值) */
  skillName?: string
  /** 新 skill 描述 */
  description?: string
  /** 生成的 SKILL.md 完整内容(含 frontmatter) */
  skillContent?: string
  /** 提炼理由(为何值得沉淀为 skill) */
  reason?: string
  /** 关联的现有 skill(用于 relatedSkills 字段) */
  relatedSkills?: string[]
}

// ============================================================================
// 统一记忆契约(P0-3)
// ============================================================================

/** 记忆作用域(统一三端:CLI/api/ai-service) */
export type MemoryScope = 'global' | 'project' | 'session' | 'user'

/** 记忆条目类型 */
export type MemoryEntryType =
  | 'preference' // 用户偏好
  | 'convention' // 项目约定
  | 'decision' // 历史决策
  | 'fact' // 事实信息
  | 'feedback' // 用户反馈
  | 'skill_ref' // skill 引用(指向 SkillDefinition)

/** 统一记忆条目(跨端共享) */
export interface MemoryEntry {
  /** 条目 ID(自增或 UUID) */
  id: string
  /** 作用域 */
  scope: MemoryScope
  /** 条目类型 */
  type: MemoryEntryType
  /** 分类(如 "UI 偏好"/"API 约定",缺省 "未分类") */
  category: string
  /** 条目文本 */
  text: string
  /** 来源端(cli/api/ai-service) */
  source: string
  /** 创建时间(ISO) */
  createdAt: string
  /** 更新时间(ISO) */
  updatedAt: string
}

/** 统一记忆读写请求 */
export interface MemorySyncRequest {
  /** 用户 ID(必填,隔离不同用户记忆) */
  userId: string
  /** 作用域(缺省 session) */
  scope?: MemoryScope
  /** 会话 ID(scope=session 时必填) */
  sessionId?: string
  /** 项目标识(scope=project 时必填,如 "IHUI-AI-<hash8>") */
  projectKey?: string
}

/** 统一记忆读写响应 */
export interface MemorySyncResponse {
  entries: MemoryEntry[]
  total: number
}

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
// Skill 跨端同步契约(P1-4)
// ============================================================================

/** Skill 同步请求(跨端同步) */
export interface SkillSyncRequest {
  /** 用户 ID */
  userId: string
  /** 操作类型 */
  action: 'push' | 'pull' | 'list'
  /** push:本地 skill 推到 api;pull:从 api 拉到本地 */
  skills?: Array<{
    name: string
    description?: string
    content: string
    frontmatter?: SkillFrontmatter
  }>
  /** pull 时指定要拉的 skill 名(缺省拉全部) */
  skillNames?: string[]
}

/** Skill 同步响应 */
export interface SkillSyncResponse {
  /** 操作结果 */
  action: 'push' | 'pull' | 'list'
  /** 同步的 skill 列表 */
  skills: Array<{
    name: string
    description?: string
    content: string
    frontmatter?: SkillFrontmatter
    source?: SkillSource
  }>
  /** 同步数量 */
  count: number
  /** 同步时间(ISO) */
  syncedAt: string
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
// 记忆系统深度层契约(P3-1,2026-07-22 立)
// 对标 Hermes Agent:FTS5 全文 + 向量双引擎 + 自动提取 + 衰减遗忘 + 用户画像
// ============================================================================

/** 记忆检索引擎(双引擎) */
export type MemoryRetrievalEngine = 'fts5' | 'vector' | 'hybrid'

/** 记忆检索请求 */
export interface MemoryRetrievalRequest {
  /** 用户 ID */
  userId: string
  /** 查询文本(语义检索 + 关键词) */
  query: string
  /** 检索引擎(默认 hybrid) */
  engine?: MemoryRetrievalEngine
  /** 作用域过滤 */
  scope?: MemoryScope
  /** 返回条数(默认 10) */
  topK?: number
  /** 相似度阈值(0-1,默认 0.7) */
  similarityThreshold?: number
  /** 是否包含已衰减记忆(默认 false) */
  includeDecayed?: boolean
}

/** 记忆检索结果项 */
export interface MemoryRetrievalResultItem {
  /** 记忆条目 */
  entry: MemoryEntry
  /** 相似度分数(0-1,向量检索) */
  similarity?: number
  /** FTS5 rank(全文检索) */
  ftsRank?: number
  /** 综合得分(hybrid 模式) */
  combinedScore?: number
  /** 命中原因 */
  matchedBy: 'vector' | 'fts5' | 'hybrid' | 'exact'
}

/** 记忆检索响应 */
export interface MemoryRetrievalResponse {
  items: MemoryRetrievalResultItem[]
  total: number
  engine: MemoryRetrievalEngine
  /** 检索耗时(ms) */
  durationMs: number
}

/** 记忆衰减配置 */
export interface MemoryDecayConfig {
  /** 衰减策略 */
  strategy: 'time' | 'access_frequency' | 'combined'
  /** 半衰期(天,time 策略) */
  halfLifeDays: number
  /** 最小保留分数(低于此值标记为 decayed) */
  minRetentionScore: number
  /** 访问加分(每次访问 +x,access_frequency 策略) */
  accessBoost: number
}

/** 记忆衰减状态 */
export interface MemoryDecayState {
  /** 记忆条目 ID */
  entryId: string
  /** 当前衰减分数(0-1) */
  retentionScore: number
  /** 上次访问时间(ISO) */
  lastAccessedAt: string
  /** 访问次数 */
  accessCount: number
  /** 是否已衰减(retentionScore < minRetentionScore) */
  isDecayed: boolean
}

/** 用户画像维度 */
export type UserProfileDimension =
  | 'preference' // 偏好(技术栈/工具/风格)
  | 'expertise' // 专业能力
  | 'communication_style' // 沟通风格
  | 'workflow' // 工作流习惯
  | 'domain' // 领域知识

/** 用户画像条目 */
export interface UserProfileEntry {
  /** 用户 ID */
  userId: string
  /** 画像维度 */
  dimension: UserProfileDimension
  /** 画像内容(如 "偏好 TypeScript,常用 React") */
  content: string
  /** 置信度(0-1,基于支持记忆数) */
  confidence: number
  /** 支持该画像的记忆 ID 列表 */
  supportingMemoryIds: string[]
  /** 最后更新时间(ISO) */
  updatedAt: string
}

/** 用户画像聚合结果 */
export interface UserProfileAggregate {
  userId: string
  entries: UserProfileEntry[]
  /** 记忆总数 */
  totalMemories: number
  /** 画像完整度(0-1,基于各维度覆盖) */
  completeness: number
  /** 上次更新时间(ISO) */
  updatedAt: string
}

// ============================================================================
// 自进化闭环深度层契约(P3-2,2026-07-22 立)
// 对标 Hermes Agent:Skill 生成后自动测试 + 反馈追踪 + 迭代优化 + 评分
// ============================================================================

/** Skill 测试用例 */
export interface SkillTestCase {
  /** 测试名 */
  name: string
  /** 测试输入 */
  input: string
  /** 期望输出(包含的关键词或正则) */
  expectedPattern: string
  /** 是否正则匹配(默认 false,字符串包含) */
  isRegex?: boolean
}

/** Skill 测试请求 */
export interface SkillTestRequest {
  /** skill 名 */
  skillName: string
  /** skill 内容(SKILL.md 正文) */
  skillContent: string
  /** 测试用例列表 */
  testCases: SkillTestCase[]
  /** 测试超时(秒,默认 30) */
  timeoutSeconds?: number
}

/** 单个测试用例结果 */
export interface SkillTestCaseResult {
  /** 测试名 */
  name: string
  /** 实际输出 */
  actualOutput: string
  /** 是否通过 */
  passed: boolean
  /** 失败原因(passed=false 时) */
  failureReason?: string
  /** 执行时长(ms) */
  durationMs: number
}

/** Skill 测试结果 */
export interface SkillTestResult {
  /** skill 名 */
  skillName: string
  /** 测试用例结果列表 */
  results: SkillTestCaseResult[]
  /** 通过数 */
  passed: number
  /** 总数 */
  total: number
  /** 通过率(0-1) */
  passRate: number
  /** 总耗时(ms) */
  totalDurationMs: number
  /** 是否全部通过 */
  allPassed: boolean
}

/** Skill 使用反馈(单次使用记录) */
export interface SkillUsageFeedback {
  /** skill 名 */
  skillName: string
  /** 使用任务 ID */
  taskId: string
  /** 使用时间(ISO) */
  usedAt: string
  /** 是否成功完成 */
  success: boolean
  /** 用户满意度(0-1,可选,来自用户反馈) */
  userSatisfaction?: number
  /** 执行时长(ms) */
  durationMs: number
  /** 失败原因(success=false 时) */
  failureReason?: string
}

/** Skill 使用统计 */
export interface SkillUsageStats {
  /** skill 名 */
  skillName: string
  /** 总使用次数 */
  totalUses: number
  /** 成功次数 */
  successCount: number
  /** 成功率(0-1) */
  successRate: number
  /** 平均满意度(0-1) */
  avgSatisfaction: number
  /** 平均执行时长(ms) */
  avgDurationMs: number
  /** 最后使用时间(ISO) */
  lastUsedAt: string
  /** 当前版本 */
  currentVersion: string
  /** 迭代历史 */
  iterationHistory: Array<{
    version: string
    iteratedAt: string
    reason: string
    previousPassRate: number
    newPassRate: number
  }>
}

/** Skill 迭代请求(基于反馈优化 skill) */
export interface SkillIterationRequest {
  /** skill 名 */
  skillName: string
  /** 当前 skill 内容 */
  currentContent: string
  /** 使用统计 */
  usageStats: SkillUsageStats
  /** 失败案例(用于改进) */
  failureCases: Array<{ input: string; actualOutput: string; failureReason: string }>
  /** 当前测试结果 */
  currentTestResult: SkillTestResult
}

/** Skill 迭代结果 */
export interface SkillIterationResult {
  /** 是否生成新版本 */
  shouldIterate: boolean
  /** 新版本号(shouldIterate=true 时) */
  newVersion?: string
  /** 新 skill 内容 */
  newContent?: string
  /** 迭代理由 */
  reason: string
  /** 预期改进点 */
  expectedImprovements: string[]
}

// ============================================================================
// 调度系统深度层契约(P3-3,2026-07-22 立)
// 对标 Hermes Agent:任务自动分解 + agent 通信 + 调度算法 + 失败重试
// ============================================================================

/** 任务分解策略 */
export type TaskDecompositionStrategy =
  | 'sequential' // 顺序分解(简单流水线)
  | 'parallel' // 并行分解(独立子任务)
  | 'dag' // DAG 分解(有依赖关系的子任务图)
  | 'recursive' // 递归分解(复杂任务层层拆解)

/** 子任务依赖关系 */
export interface SubTaskDependency {
  /** 依赖的子任务 ID */
  dependsOn: string
  /** 依赖类型 */
  type:
    | 'output' // 需要前置任务的输出
    | 'completion' // 仅需前置任务完成
    | 'resource' // 共享资源锁
}

/** 分解出的子任务 */
export interface SubTask {
  /** 子任务 ID */
  id: string
  /** 任务描述 */
  description: string
  /** 推荐的 agent 类型(基于能力匹配) */
  recommendedAgentType: string
  /** 期望的 agent 能力 */
  requiredCapabilities: string[]
  /** 依赖的其他子任务 */
  dependencies: SubTaskDependency[]
  /** 优先级(1-10,10 最高) */
  priority: number
  /** 预估耗时(秒) */
  estimatedDurationSeconds?: number
  /** 是否可重试(默认 true) */
  retryable?: boolean
  /** 最大重试次数(默认 3) */
  maxRetries?: number
}

/** 任务分解请求 */
export interface TaskDecompositionRequest {
  /** 原始任务描述 */
  task: string
  /** 可用的 agent 列表(含能力描述) */
  availableAgents: Array<{ name: string; capabilities: string[] }>
  /** 分解策略(默认 dag) */
  strategy?: TaskDecompositionStrategy
  /** 最大子任务数(默认 10) */
  maxSubTasks?: number
}

/** 任务分解结果 */
export interface TaskDecompositionResult {
  /** 分解出的子任务列表 */
  subTasks: SubTask[]
  /** 执行顺序(拓扑排序后的 ID 列表) */
  executionOrder: string[]
  /** 并行批次(同一批可并行执行) */
  parallelBatches: string[][]
  /** 分解策略 */
  strategy: TaskDecompositionStrategy
  /** 总预估耗时(秒) */
  totalEstimatedDurationSeconds?: number
}

/** 共享黑板条目(agent 间共享上下文) */
export interface BlackboardEntry {
  /** 条目 ID */
  id: string
  /** 键(如 "current_design" / "shared_context") */
  key: string
  /** 值 */
  value: string
  /** 写入的 agent 名 */
  writtenBy: string
  /** 关联的子任务 ID */
  subTaskId?: string
  /** 时间戳(ISO) */
  timestamp: string
  /** 读取过的 agent 列表 */
  readBy: string[]
}

/** 调度决策 */
export interface ScheduleDecision {
  /** 子任务 ID */
  subTaskId: string
  /** 分配的 agent 名 */
  assignedAgent: string
  /** 分配理由 */
  reason: string
  /** 分配分数(0-1,能力匹配度) */
  matchScore: number
  /** 预计开始时间(ISO) */
  estimatedStartTime: string
  /** 调度策略 */
  strategy: 'capability_match' | 'load_balance' | 'priority' | 'round_robin'
}

/** 调度结果 */
export interface SchedulingResult {
  decisions: ScheduleDecision[]
  /** 并发度(同时执行的 agent 数) */
  concurrency: number
  /** 预计总耗时(秒) */
  estimatedTotalDurationSeconds: number
  /** 调度策略 */
  strategy: 'capability_match' | 'load_balance' | 'priority' | 'round_robin'
}

/** 失败重试策略 */
export interface RetryPolicy {
  /** 最大重试次数 */
  maxRetries: number
  /** 退避策略 */
  backoff: 'fixed' | 'linear' | 'exponential'
  /** 初始延迟(ms) */
  initialDelayMs: number
  /** 最大延迟(ms) */
  maxDelayMs: number
  /** 可重试的错误类型 */
  retryableErrors: Array<'timeout' | 'rate_limited' | 'overloaded' | 'network' | 'unknown'>
}

/** 故障转移配置 */
export interface FailoverConfig {
  /** 主 agent */
  primary: string
  /** 备用 agent 列表 */
  fallbacks: string[]
  /** 触发转移的条件 */
  triggerOn: Array<'failure' | 'timeout' | 'low_quality'>
  /** 质量阈值(triggerOn 含 low_quality 时) */
  qualityThreshold?: number
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

// ============================================================================
// 多 Agent 并行执行契约(2026-07-22 立,对标 Hermes Kanban + Claude Agent Teams)
// 跨端共享:ai-service(DAG worker pool)+ cli(子进程并行)+ api(Kanban API)+ web(工作台 UI)
// ============================================================================

/**
 * Agent 任务 Kanban 状态机(6 列,对标 Hermes Agent Kanban)。
 *
 * 状态流转:
 *   triage → todo → ready → in_progress → done
 *                    ↓           ↓
 *                 blocked ←──────┘
 *
 * - triage: 新建未分类(待 librarian/主 agent 评估优先级和分派)
 * - todo: 已分类待执行(优先级已定,等待 worker 空闲)
 * - ready: 已就绪可执行(依赖已满足,等待 worker pick)
 * - in_progress: 执行中(worker 已 pick)
 * - blocked: 阻塞中(依赖未满足 / 工具失败 / 等待人工)
 * - done: 已完成(成功 or 失败,终态)
 *
 * **单一真相源 = 下面的 `AGENT_TASK_STATUSES`**(2026-09-27 D6/G3 收口)。
 * 联合类型由该数组派生,所以"编译期联合"与"运行时清单"不可能分叉 —— 此前它们是两格
 * (数组端内各抄一份、联合住在 types),而守门 `check-background-task-type-parity` 只管
 * executor 接线、`check-agent-event-parity` 只管 SSE 事件名,**这一族成员集合全仓零判据**
 * (取证见 docs/d6-convergence-audit-2026-09-27.md §2.3)。
 *
 * ⚠️ **六个字符串值全部是对外契约,不得改名/删成员/改拼写**(三条独立证据):
 *   ① 落库列:`packages/database/src/schema/agent-tasks.ts:31` `varchar('status', {length:20})`
 *      (默认值 `'pending'` 是 legacy 档,由 `LEGACY_STATUS_MAP` 读取时归一);
 *   ② REST 契约:`apps/api/src/routes/agents-kanban.ts:128,151` 两处 `z.enum([...])`
 *      (查询参数与 transition 请求体);
 *   ③ SSE 帧载荷:`apps/api/src/routes/agents-kanban.ts:386,453,473,524` 的
 *      `broadcastSSEEvent({ type: 'task_*' })` 携带 `status` 字段直推前端。
 * 新增一档的正确顺序 = 改本数组 → 补 `ALLOWED_TRANSITIONS` 边 → 补 `STATUS_VARIANTS` →
 * 补 Python 对齐表(`apps/ai-service/app/services/dag_scheduler.py`)→ **同枚提交**补齐
 * `agents.kanban.<status>` 五语言词表(AGENTS §30:状态词汇是一等契约)。
 * 常驻尺子:`scripts/check-agent-status-vocabulary-parity.mjs`。
 */
export const AGENT_TASK_STATUSES = [
  'triage',
  'todo',
  'ready',
  'in_progress',
  'blocked',
  'done',
] as const

export type AgentTaskStatus = (typeof AGENT_TASK_STATUSES)[number]

/**
 * 第二域:workspace 进程内 agent 任务状态(`/api/workspace/agent/tasks`)。
 *
 * **它与上面的 Kanban 六态不是同一件事的两种写法,而是两个域** —— 值集合起来是
 * `running/completed/failed/canceled` 对 `triage/todo/ready/in_progress/blocked/done`,
 * 交集为空(本门 SV2 机器判这一条)。审计原文:
 * docs/d6-convergence-audit-2026-09-27.md §2.3"第四套 … 与 kanban 六态不同域不同名,无映射"。
 * 所以处置不是"把第四套并进六态"(那会改坏 `/api/workspace/agent/tasks` 的响应值),
 * 而是**把它也登记成一处、端内只引用**,免得第五份 `STATUS_CLASS` 靠 fallback 顶。
 *
 * ⚠️ 这四个值同样是对外契约(生产侧 `apps/api/src/services/workspace-ai-service.ts:335`
 * 的 `export type AgentTaskStatus = 'running' | 'completed' | 'failed' | 'canceled'` 直接
 * 落进响应),拼写不得改。注意同文件 :1483 另有 `BgAgentStatus` 写作 **`cancelled`(双 l)** ——
 * 那是第三个域的第三种拼写,不在本域射程,已按"同词不同义不得并置"登记为已知分叉。
 */
export const WORKSPACE_AGENT_TASK_STATUSES = ['running', 'completed', 'failed', 'canceled'] as const

export type WorkspaceAgentTaskStatus = (typeof WORKSPACE_AGENT_TASK_STATUSES)[number]

/**
 * 第二域(工作空间进程内任务态)的 i18n 键表 —— **键集由上面那张登记表推导**,不再抄一份成员清单:
 * 抄一份就等于多出第二处要同步的地方(守门 151 SV3 判的正是"端内再抄第二份成员清单"那一型)。
 * 词条五语言必须同批齐(AGENTS §30);漏一条的端上表现是徽章把 `agentTasks.statusFailed`
 * 原样回显给用户,看护在 `packages/types/tests/agent-status-vocabulary-labels.test.ts`
 * (它同时钉了"漏一条 ⇒ 判红"的构造面反例,所以这张表不是自证的)。
 */
export const WORKSPACE_AGENT_TASK_STATUS_LABEL_KEYS = Object.fromEntries(
  WORKSPACE_AGENT_TASK_STATUSES.map(
    (s) => [s, `agentTasks.status${s.charAt(0).toUpperCase()}${s.slice(1)}`] as const,
  ),
) as Record<WorkspaceAgentTaskStatus, string>

/**
 * 取第二域某一档的 i18n 键;登记表之外的值一律 null,不替未知值猜一档。
 * 刻意不让 `cancelled`(双 l)通过:那是第三域的拼写,认领它等于把两域在端内并成一张表
 * (拼写分叉的登记见本文件上方 `WORKSPACE_AGENT_TASK_STATUSES` 的注释)。
 */
export function workspaceAgentTaskStatusLabelKey(status: string): string | null {
  return Object.prototype.hasOwnProperty.call(WORKSPACE_AGENT_TASK_STATUS_LABEL_KEYS, status)
    ? WORKSPACE_AGENT_TASK_STATUS_LABEL_KEYS[status as WorkspaceAgentTaskStatus]
    : null
}

/**
 * D152(2026-09-29 立,用户拍板「六态」):会话内「目标(goal)」状态机的封闭集 ——
 * **第三个域**,与上面两个刻意不相交、也不得并集:
 *  · `AGENT_TASK_STATUSES` 是 Kanban 任务卡的六列(triage/todo/ready/in_progress/blocked/done),
 *    `blocked`/`done` 在此处**同词不同义**(那两列讲"这张卡卡住了/做完了",这里讲
 *    "这一会话的目标被阻塞/达成"),把两个域并起来等于改两套对外契约;
 *  · `WORKSPACE_AGENT_TASK_STATUSES` 是 workspace 进程内任务态(running/completed/…)。
 * 判据:`scripts/check-agent-status-vocabulary-parity.mjs` 的 SV2 要求登记域两两不相交,
 * 而 goal 域**不进**那张表(它没有跨语言第二副本 —— 服务端同一份值在
 * `apps/ai-service/app/services/session_store.py::GOAL_STATUSES`,两处同名常量由
 * `packages/shared/src/sse/__tests__/contract.test.ts` 的在位断言看护)。
 * 与 CLI 的 `budget_limited` / 预算帧 critical 档语义对齐(AGENTS §8)。
 * ⚠️ 新增一档必须同枚提交补齐 `chat.goal.status.*` 五语言词表(AGENTS §19/§30),
 *    不得端内硬编码中文。
 */
export const GOAL_STATUSES = [
  'active',
  'paused',
  'blocked',
  'done',
  'usageLimited',
  'budgetLimited',
] as const

/** 下行帧 `goal_updated` 额外允许的目标态:cleared(单帧承载清除,不建第二帧)。 */
export const GOAL_WIRE_STATUSES = [...GOAL_STATUSES, 'cleared'] as const

export type GoalStatus = (typeof GOAL_STATUSES)[number]
export type GoalWireStatus = (typeof GOAL_WIRE_STATUSES)[number]

// ---------------------------------------------------------------------------
// 状态机运行时常量(2026-09-11 2-2 P1:跨端单一来源)
// api(transition/admin PUT 校验)与 web(流转按钮禁用)共用,避免两处表漂移。
// ---------------------------------------------------------------------------

/** Kanban 6 列合法流转图(单一来源) */
export const ALLOWED_TRANSITIONS: Record<AgentTaskStatus, AgentTaskStatus[]> = {
  triage: ['todo', 'blocked', 'done'],
  todo: ['ready', 'blocked', 'done'],
  ready: ['in_progress', 'blocked'],
  in_progress: ['done', 'blocked'],
  blocked: ['todo', 'ready'],
  done: [],
}

/**
 * 旧表 status 兼容映射(读取时转换 legacy → Kanban)。
 * cancelled / quota_exceeded / preempted 为 subagent-dispatch 写入的终态,
 * 全部归一为 blocked(原先缺映射导致任务从看板消失)。
 */
export const LEGACY_STATUS_MAP: Record<string, AgentTaskStatus> = {
  pending: 'triage',
  running: 'in_progress',
  completed: 'done',
  failed: 'blocked',
  cancelled: 'blocked',
  quota_exceeded: 'blocked',
  preempted: 'blocked',
}

/** 过滤时 Kanban status → DB status 变体(含 legacy) */
export const STATUS_VARIANTS: Record<AgentTaskStatus, string[]> = {
  triage: ['triage', 'pending'],
  todo: ['todo'],
  ready: ['ready'],
  in_progress: ['in_progress', 'running'],
  blocked: ['blocked', 'failed', 'cancelled', 'quota_exceeded', 'preempted'],
  done: ['done', 'completed'],
}

/**
 * DB status(含 legacy 终态)→ Kanban status。
 *
 * G-463(2026-10-04 补注,行为**未变**):本函数的返回类型标注是 `AgentTaskStatus`,
 * 但实现对未登记值是**原样透传**并带 `as AgentTaskStatus` 断言 —— 编译期完全静默,
 * 运行时那个值不是任何一档。**刻意不在这里改签名**:本函数是既有对外契约的一环
 * (kanban 载荷逐字断言 + admin 广播 + 五端渲染),改签名会把"读侧"与"写侧"一起掀翻,
 * 远超本票射程。真正的收口是**所有需要判合法性的地方都改走已存在的
 * `statusOrUnrecognized` / `isAgentTaskStatus` / `isTransitionAllowedFromRaw`**,
 * 本函数只保留"归一"职责。
 *
 * ⚠️ 因此**禁止**把本函数的返回值直接当下标去查 `ALLOWED_TRANSITIONS` —— 那样会求值成
 * `undefined` 再 `.includes()` ⇒ `TypeError`。要判流转合法性请用 `isTransitionAllowedFromRaw`。
 */
export function mapStatus(raw: string): AgentTaskStatus {
  return LEGACY_STATUS_MAP[raw] ?? (raw as AgentTaskStatus)
}

/**
 * 被 `LEGACY_STATUS_MAP` 折叠进 `blocked` 的四种终态**成因**(2026-09-28 拍板:
 * **不动六档枚举**(那是落库列 + REST 校验 + SSE 载荷 + Python 调度器 + 五语言的对外契约),
 * 只在看板卡片上加一枚次级标记)。
 *
 * 为什么必须有这一层:这四档与"真的在等解阻塞"在折叠后完全同形,而它们的下一步动作相反 ——
 * 「已取消 / 配额超限 / 被抢占」重跑大概率就好,「待解阻塞」要先去解阻塞,**而「执行失败」要去
 * 读 errorMessage 查因**。用户按同一张脸决定重跑、去解阻塞、还是去查日志,是被状态显示指错了方向。
 *
 * ⚠️ **2026-10-05(G-1018245,用户拍板路 B)`failed` 由"不在册"改为"在册"**:
 * 09-28 首版只收了三种,`failed` 被有意排除,理由写在原 `terminationOf` 注释里 ——
 * 「把真失败说成被取消,比不标更糟」。该理由**本身仍然成立**(所以
 * `failed` 必须有自己的文案键 `terminatedFailed`,不许复用 `terminatedCancelled`),
 * 但它成立的方式是"给 failed 一个**独立的**键",而不是"让 failed 落回裸 blocked":
 * 排除出册的实测后果是 **`failed` 是四档里唯一在看板上完全不可点名的** —— 它与
 * 真的·阻塞同形、与三档终态也同形,用户在四张同形的脸里读不到任何成因。
 * 拍板同时否掉的是台账原写的另一条路(「六档变七档」):本轮实测 `agent_tasks.status`
 * 的写侧只有三处(`createTask` 写死 `triage`、transition 的 `z.enum` 六档、admin PUT),
 * `failed`/`cancelled`/`quota_exceeded`/`preempted` **无任何我方生产者**(纯历史/外部写入的
 * 兼容读侧),Python 调度器失败一律 `task.status = "blocked"`(`dag_scheduler.py` 的
 * `is_failed` 判据即此)⇒ 新增第七档会造出一个我方永不写入、只被 legacy 数据点亮的空面,
 * 且要动两处 REST `z.enum` 契约。故维持六档,只把四档成因补齐。
 */
export const COLLAPSED_TERMINATIONS = [
  'failed',
  'cancelled',
  'quota_exceeded',
  'preempted',
] as const
export type AgentTaskTermination = (typeof COLLAPSED_TERMINATIONS)[number]

/** 次级标记的 i18n 键(单一来源;`agents.kanban.*` 五语言必须同批齐,守门 151 同一条口径) */
export const TERMINATION_LABEL_KEYS: Record<AgentTaskTermination, string> = {
  // 四档各有自己的键,逐字不同:复用 `terminatedCancelled` 就会把"执行失败"说成"被取消",
  // 正是 09-28 排除 failed 时写下的那句「把真失败说成被取消,比不标更糟」。
  failed: 'agents.kanban.terminatedFailed',
  cancelled: 'agents.kanban.terminatedCancelled',
  quota_exceeded: 'agents.kanban.terminatedQuotaExceeded',
  preempted: 'agents.kanban.terminatedPreempted',
}

/**
 * 取原始状态里的终态成因;非终态(含 `blocked` 本身)一律返回 null。
 *
 * 仍然不为未知值猜测一档:库里出现四档之外的串,归`statusOrUnrecognized` 的"未识别"档
 * (见下方),不归这里 —— 两个出口的职责是正交的,不是同一判断的两个名字。
 */
export function terminationOf(raw: string | null | undefined): AgentTaskTermination | null {
  if (typeof raw !== 'string') return null
  return (COLLAPSED_TERMINATIONS as readonly string[]).includes(raw)
    ? (raw as AgentTaskTermination)
    : null
}

// ---------------------------------------------------------------------------
// "未识别"档(2026-09-28 立):落在六档之外的状态值的唯一归一出口
// ---------------------------------------------------------------------------

/**
 * **刻意不并进 `AGENT_TASK_STATUSES`,也刻意不进 `COLLAPSED_TERMINATIONS`**:
 *   · 六档值是落库列 + REST `z.enum` + SSE 载荷三重对外契约(见上方 AGENT_TASK_STATUSES 头注),
 *     加一档等于改对外契约;
 *   · `COLLAPSED_TERMINATIONS` 的语义是"被折叠进 blocked 的**已知**终态成因",
 *     把一个没人认得的值写成终态就是替它猜一个结论 —— 那正是 AGENTS §30
 *     「钩子无终态不得渲染成"完成"」点名的失效型。
 * 所以本档只做两件事:让外部写进来的未知状态**独立呈现**,并让它**只以一个计数**存在 ——
 * 既不被塞进任何已知列,也不被静默读成成功或失败。
 */
export const UNRECOGNIZED_STATUS = 'unrecognized' as const

export type UnrecognizedStatus = typeof UNRECOGNIZED_STATUS

/** 六档 ∪ 未识别档:只有"取呈现档位"这一维需要同时容纳两者 */
export type KanbanStatusBucket = AgentTaskStatus | UnrecognizedStatus

/** 未识别档的徽章文案键(与 TERMINATION_LABEL_KEYS 同一条规矩:键只在 types 有一份) */
export const UNRECOGNIZED_STATUS_LABEL_KEY = 'agents.kanban.unrecognizedStatus'

/**
 * 取 i18n 全键的点号末段(端内 `useTranslations('agents.kanban')` 已绑命名空间时用)。
 * 卡片与看板都要"未识别"这一枚标签,所以这段切片只许有这一份实现 ——
 * 两处各写一遍 `slice(lastIndexOf('.'))` 就是第二份真相,任一处改形态另一端只显示键名。
 */
export function i18nLeafKey(fullKey: string): string {
  return fullKey.slice(fullKey.lastIndexOf('.') + 1)
}

/** 原始值是否**逐字**落在六档内(不含 legacy 别名 —— 先过 mapStatus 再问这一句)。 */
export function isAgentTaskStatus(raw: string): raw is AgentTaskStatus {
  return (AGENT_TASK_STATUSES as readonly string[]).includes(raw)
}

export interface NormalizedKanbanStatus {
  /** 六档之一;不在六档内时恒为 UNRECOGNIZED_STATUS(绝不返回某个已知档顶替) */
  bucket: KanbanStatusBucket
  /** true = 原始值在六档之外(含空值与非字符串) */
  unrecognized: boolean
  /**
   * 仅未识别时出现:数据库里的原始状态串。用途只有两个 —— 报数与无障碍名称,
   * **不得**当可信文案直接渲染(它是外部可写的值,渲染进界面就是注入面)。
   */
  rawStatus?: string
}

/**
 * 任意状态值的唯一归一出口:先经 `LEGACY_STATUS_MAP` 归一(legacy 别名仍算已知档),
 * 落在六档内 ⇒ 返回该档;否则 ⇒ 返回未识别档并带上原值。
 *
 * 为什么必须由这里兜:`mapStatus` 对未知值是**原样透传**并带 `as AgentTaskStatus` 断言,
 * 编译期完全静默,而运行时那个值不是任何一档 —— 拿它去查 `STATUS_BADGE_CLASS` 得到
 * undefined、去 `t(status)` 会把原值当文案打出来。判不出时不猜,也不假装判得出。
 */
export function statusOrUnrecognized(raw: string | null | undefined): NormalizedKanbanStatus {
  if (typeof raw !== 'string' || raw.length === 0) {
    return { bucket: UNRECOGNIZED_STATUS, unrecognized: true }
  }
  const mapped = mapStatus(raw)
  if (isAgentTaskStatus(mapped)) return { bucket: mapped, unrecognized: false }
  return { bucket: UNRECOGNIZED_STATUS, unrecognized: true, rawStatus: raw }
}

/** 序列化面上的"未识别"判据:只看 `KanbanTask.rawStatus` 这一个可选字段(定义见该接口)。 */
export function isUnrecognizedKanbanTask(task: Pick<KanbanTask, 'rawStatus'>): boolean {
  return typeof task.rawStatus === 'string'
}

/** 未识别档计数(唯一出口):纯数组函数,所以不必挂载组件也能被用例钉住。 */
export function countUnrecognizedTasks(tasks: readonly Pick<KanbanTask, 'rawStatus'>[]): number {
  return tasks.reduce((n, t) => (isUnrecognizedKanbanTask(t) ? n + 1 : n), 0)
}

/**
 * 取某个原始状态值可流转到的目标档位;未知状态一律返回**空表**(而不是让调用方去查一个不存在的键)。
 *
 * G-463(2026-10-04):这一层是**为 `ALLOWED_TRANSITIONS` 的直接下标查表兜底**而存在的。
 * `mapStatus` 对未登记值是原样透传(见其头注),所以 `ALLOWED_TRANSITIONS[mapStatus(raw)]`
 * 在库里出现六档之外的值时求值为 `undefined`,再 `.includes()` 就是 `TypeError` ⇒
 * kanban transition 接口 500。本函数把"查不到 ⇒ 无合法流转"这个判断收到types 里,
 * 与 `isTransitionAllowed` 同一个口径(它本就带 `?.`),使全仓不再有第二处裸下标。
 */
export function allowedTransitionsFrom(raw: string): readonly AgentTaskStatus[] {
  const mapped = mapStatus(raw)
  if (!isAgentTaskStatus(mapped)) return []
  return ALLOWED_TRANSITIONS[mapped] ?? []
}

/** 流转合法性校验(transition / admin PUT 共用) */
export function isTransitionAllowed(from: AgentTaskStatus, to: AgentTaskStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * 任意原始值 ⇒ 流转合法性(transition / admin PUT 的**唯一**判定出口)。
 *
 * 与 `isTransitionAllowed` 的差别只有一处:入参是**原始状态串**而非已归一的档位,
 * 因此库里出现六档之外的值时,这里同样返回 false 而不是崩在 `.includes()` 上。
 * 内部复用 `isTransitionAllowed` 而非自己查表 ⇒ 两个出口永远同判,不会漂移。
 */
export function isTransitionAllowedFromRaw(fromRaw: string, to: AgentTaskStatus): boolean {
  const from = mapStatus(fromRaw)
  if (!isAgentTaskStatus(from)) return false
  return isTransitionAllowed(from, to)
}

/** Kanban 列定义(Web 工作台渲染用) */
export interface KanbanColumn {
  /** 列状态 */
  status: AgentTaskStatus
  /** 列标题(i18n key,如 'agents.kanban.triage') */
  titleKey: string
  /** 列内任务(按 priority 降序) */
  tasks: KanbanTask[]
}

/** Kanban 任务(跨端统一,对齐 packages/database agent_tasks 表;与 ai.ts AgentTask 区分,本类型面向 Kanban 工作台) */
export interface KanbanTask {
  /** 任务 ID(uuid) */
  id: string
  /** 关联 Agent ID */
  agentId: string
  /** 任务名(≤200 字符) */
  name: string
  /** 任务描述 */
  description?: string
  /** Kanban 状态(默认 triage) */
  status: AgentTaskStatus
  /**
   * 被折叠进 `blocked` 的终态成因(2026-09-28 拍板:六档枚举不动,加次级标记)。
   * 缺省 = 原始状态本身就是 blocked/failed 等,没有可点名的终态 —— 前端**不得**为消白标而猜一个。
   */
  termination?: AgentTaskTermination
  /**
   * 仅当原始 status 落在六档之外时出现("未识别"档的只报数载体;值 = 库里原始串)。
   * 刻意是**新增可选字段**:既有字段名与状态码一字未动(有用例当契约钉),而未知状态
   * 既不能不进账(静默消失),也不能被猜成某个已知档 —— 见 UNRECOGNIZED_STATUS 头注。
   * 前端取用只走 `isUnrecognizedKanbanTask` / `countUnrecognizedTasks`,不得直接当文案渲染。
   */
  rawStatus?: string
  /** 优先级(数值越大越优先,默认 0) */
  priority: number
  /** 任务负载(输入参数,JSON) */
  payload: Record<string, unknown>
  /** 任务结果(终态有值) */
  result?: Record<string, unknown>
  /** 计划执行时间(ISO,定时任务) */
  scheduledAt?: string
  /** 实际开始时间(ISO) */
  startedAt?: string
  /** 完成时间(ISO) */
  completedAt?: string
  /** 错误信息(status=blocked/done 且失败时有值) */
  errorMessage?: string
  /** 依赖任务 ID 列表(DAG 调度用,空=无依赖) */
  dependencies?: string[]
  /** 分配的 worker ID(in_progress 时有值) */
  workerId?: string
  /** 创建者 ID */
  createdBy?: string
  /** 创建时间(ISO) */
  createdAt: string
  /** 更新时间(ISO) */
  updatedAt: string
  /** 单任务超时秒数(覆盖 WorkerPoolConfig.taskTimeoutSeconds,不设用全局默认) */
  timeoutSeconds?: number
  /** 独立工作区路径(git worktree,空=用主仓库;P1-2 隔离;2-2 兼作工作区锁粒度) */
  workspacePath?: string
  /** worktree 分支名(如 subagent/<taskId>) */
  workspaceBranch?: string
  /** 所属团队 ID(2-2 团队任务板过滤维度) */
  teamId?: string
  /** 最近一次获取工作区锁的持有者(2-2,Redis 锁为执行权威,此字段仅展示/审计) */
  lockedBy?: string
  /** 最近一次获取工作区锁的时间(ISO,2-2) */
  lockedAt?: string
}

/** 资源限制配置(P1-3,CLI V8 heap + ai-service psutil/Job Object 共享) */
export interface WorkerResourceLimits {
  /** V8 old gen heap 上限 MB(CLI 专属,跨平台) */
  maxOldGenerationSizeMb?: number
  /** V8 young gen 上限 MB(CLI 专属) */
  maxYoungGenerationSizeMb?: number
  /** 进程内存上限 MB(ai-service psutil 监控 + POSIX setrlimit + Windows Job Object) */
  memoryMb?: number
  /** CPU 核心数上限(ai-service 软监控,Windows Job Object CPU rate) */
  cpuCores?: number
  /** CPU 累计时间上限秒(POSIX RLIMIT_CPU,Windows 不支持) */
  cpuSeconds?: number
}

/** 网络出站策略(P1-5,executor 入口白名单检查;完整隔离需 OS 沙箱) */
export interface NetworkEgressPolicy {
  /** 模式:'allowlist'=只允许白名单域名;'blocklist'=黑名单;'open'=不限制(默认) */
  mode: 'allowlist' | 'blocklist' | 'open'
  /** 域名列表(支持通配符 *.example.com) */
  domains?: string[]
  /** 是否允许访问 localhost/127.0.0.1(默认 true,开发环境需要) */
  allowLocalhost?: boolean
}

/** Worker Pool 配置(ai-service DAG 调度器 + cli 子进程池共享) */
export interface WorkerPoolConfig {
  /** 最大并发 worker 数(默认 4) */
  maxWorkers: number
  /** 单任务超时秒数(默认 300) */
  taskTimeoutSeconds: number
  /** 任务队列最大长度(默认 100,超限拒绝入队) */
  maxQueueSize: number
  /** 空闲 worker 存活秒数(cli 子进程用,默认 60) */
  idleWorkerTtlSeconds?: number
  /** 优先级抢占(true=高优先级任务可抢占低优先级 worker) */
  preemptive?: boolean
  /** 失败时是否保留 worktree 供调试(cli 专属,默认 false=失败也清理防磁盘泄漏) */
  keepWorktreeOnFailure?: boolean
  /** 资源限制(P1-3,不设=不限) */
  resourceLimits?: WorkerResourceLimits
  /** 网络出站策略(P1-5,不设=open 不限制) */
  networkEgressPolicy?: NetworkEgressPolicy
  /** worktree 源仓库路径(P1-2,空=不启用 worktree 隔离) */
  workspaceSourcePath?: string
  /** watchdog 心跳超时秒数(P1-1,默认 60,executor 超过此时长无心跳判定卡死) */
  heartbeatTimeoutSeconds?: number
}

/** Worker 状态(调度器内部跟踪) */
export interface WorkerState {
  /** Worker ID */
  workerId: string
  /** Worker 类型(ai-service-worker / cli-subprocess / api-dispatcher) */
  type: 'ai-service-worker' | 'cli-subprocess' | 'api-dispatcher'
  /** 当前状态(idle/busy/dead) */
  status: 'idle' | 'busy' | 'dead'
  /** 当前执行任务 ID(busy 时有值) */
  currentTaskId?: string
  /** 已完成任务数 */
  completedCount: number
  /** 失败任务数 */
  failedCount: number
  /** 启动时间(ISO) */
  startedAt: string
  /** 最后心跳时间(ISO) */
  lastHeartbeatAt: string
}

/** SSE 实时流事件(web 工作台订阅) */
export interface AgentSSEEvent {
  /** 事件类型 */
  type:
    | 'task_created' // 新任务入队
    | 'task_status_changed' // 状态流转
    | 'task_completed' // 完成
    | 'task_failed' // 失败
    | 'workspace_lock_acquired' // 工作区锁被获取(2-2)
    | 'workspace_lock_released' // 工作区锁被释放(2-2)
  // D44(2026-09-23 收口):task_progress / worker_status / dag_level_advanced / log
  // 为从未有生产点的死声明(WorkerPool._emit 只发 task_created/status_changed/
  // completed/failed;apps/api 无 broadcastSSEEvent 写出),已从本联合类型回收,parity 不再登记。
  /** 关联任务 ID */
  taskId?: string
  /** 关联 worker ID */
  workerId?: string
  /** 事件负载(类型相关) */
  payload: Record<string, unknown>
  /** 时间戳(ISO) */
  timestamp: string
}

/** 并行执行结果(DAG 调度器返回) */
export interface ParallelExecutionResult {
  /** 执行 ID(uuid) */
  executionId: string
  /** 总状态(success/partial/failed) */
  status: 'success' | 'partial' | 'failed'
  /** 所有任务结果(taskId -> result) */
  taskResults: Record<string, KanbanTask>
  /** 总耗时(ms) */
  totalDurationMs: number
  /** 并发 worker 数 */
  workerCount: number
  /** DAG 层级轨迹 */
  trace: Array<{
    level: number
    nodeIds: string[]
    status: 'success' | 'failed' | 'skipped'
    durationMs: number
  }>
}

/** CLI 子进程 spawn 请求(cli 端 SubagentSpawnRequest) */
export interface SubagentSpawnRequest {
  /** 子 agent 角色(researcher/coder/reviewer/planner/general) */
  persona: SubagentPersona
  /** 任务描述 */
  task: string
  /** 工作区路径(默认主 agent 工作区) */
  workspacePath?: string
  /** 模型覆盖 */
  model?: string
  /** 能力模式(默认 read-write) */
  capability?: CapabilityMode
  /** 隔离模式(默认 none,可选 worktree) */
  isolation?: IsolationMode
  /** 最大迭代次数(默认 25) */
  maxIterations?: number
  /** 超时秒数(默认 300) */
  timeoutSeconds?: number
}

/** CLI 子进程 spawn 响应 */
export interface SubagentSpawnResponse {
  /** 子 agent ID */
  subagentId: string
  /** 子进程 PID */
  pid: number
  /** 状态(spawned/running/completed/failed) */
  status: 'spawned' | 'running' | 'completed' | 'failed'
  /** 输出内容(completed 时有值) */
  output?: string
  /** 错误信息(failed 时有值) */
  error?: string
  /** 耗时(ms) */
  durationMs?: number
}

/** Kanban 任务流转请求(api 端) */
export interface KanbanTransitionRequest {
  /** 任务 ID */
  taskId: string
  /** 目标状态 */
  toStatus: AgentTaskStatus
  /** 操作者 ID(审计用) */
  operatedBy?: string
  /** 流转理由(可选,blocked 时必填) */
  reason?: string
}

/** Kanban 任务流转响应 */
export interface KanbanTransitionResponse {
  /** 任务 ID */
  taskId: string
  /** 流转前状态 */
  fromStatus: AgentTaskStatus
  /** 流转后状态 */
  toStatus: AgentTaskStatus
  /** 流转时间(ISO) */
  transitionedAt: string
  /** 是否合法流转(非法流转拒绝) */
  allowed: boolean
  /** 拒绝原因(allowed=false 时有值) */
  reason?: string
}

/** Git 工具参数(各操作特定参数用索引签名兜底) */
export interface GitToolArgs {
  operation: GitOperation
  cwd?: string
  [key: string]: unknown
}

/** Git 工具权限级别(对应 Tool.dangerLevel) */
export type GitToolPermission = 'read' | 'write' | 'dangerous'

// ============================================================================
// 多文件原子编辑契约(Wave 9,2026-07-22 立)
// 对标 OpenClaw multi-file atomic edit:atomic batch + checkpoint + rollback
// ============================================================================

/** 多文件原子编辑操作类型 */
export interface BatchEditOperation {
  type: 'create' | 'update' | 'delete'
  filePath: string
  /** create/update 时必填,delete 时忽略 */
  content?: string
  /** 编码(默认 utf-8) */
  encoding?: 'utf-8' | 'base64'
}

/** 多文件原子编辑请求 */
export interface BatchEditRequest {
  operations: BatchEditOperation[]
  /** true = 全部成功才提交,任一失败回滚(默认 true) */
  atomic?: boolean
  /** true = 只返回预览,不实际写入(默认 false) */
  dryRun?: boolean
  /** atomic=false 时需 confirm=true 才允许部分成功;delete 操作也需 confirm=true */
  confirm?: boolean
}

/** 多文件原子编辑结果 */
export interface BatchEditResult {
  success: boolean
  appliedCount: number
  totalCount: number
  operations: Array<{
    filePath: string
    type: string
    status: 'success' | 'failed' | 'rolled-back' | 'skipped'
    error?: string
    /** unified diff 预览 */
    diff?: string
  }>
  /** 是否执行了回滚 */
  rollbackPerformed?: boolean
  /** checkpoint ID(用于 batch_undo) */
  checkpointId?: string
}

// ============================================================================
// LSP workspace 级工具类型(2026-07-22 立,Wave 9 多语言 LSP 深化)
// 对标 OpenCode:workspace/symbol 全局符号搜索 + textDocument/rename + textDocument/codeAction
// ============================================================================

/** workspace/symbol 请求(全局符号搜索) */
export interface WorkspaceSymbolRequest {
  query: string
  limit?: number
  /** 限定语言,默认全部 */
  language?: string
}

/** workspace/symbol 结果项 */
export interface WorkspaceSymbolResult {
  name: string
  /** LSP SymbolKind 枚举值(1-26) */
  kind: number
  /** SymbolKind 可读名('Class' | 'Function' | 'Method' | 'Interface' | etc.) */
  kindName: string
  location: {
    uri: string
    range: {
      start: { line: number; character: number }
      end: { line: number; character: number }
    }
  }
  containerName?: string
}

/** textDocument/rename 请求(符号重命名) */
export interface SymbolRenameRequest {
  filePath: string
  /** 0-based 行号 */
  line: number
  /** 0-based 列号 */
  character: number
  newName: string
  /** true = 自动应用 edits,false = 只返回预览 */
  apply?: boolean
  /** apply=true 时必须 confirm=true 才执行 */
  confirm?: boolean
}

/** textDocument/rename 结果 */
export interface SymbolRenameResult {
  changes: Array<{
    filePath: string
    edits: Array<{
      range: {
        start: { line: number; character: number }
        end: { line: number; character: number }
      }
      newText: string
    }>
  }>
  applied: boolean
}

/** textDocument/codeAction 请求(快速修复/重构) */
export interface CodeActionRequest {
  filePath: string
  /** 0-based 行号 */
  line: number
  /** 0-based 列号 */
  character: number
  /** 'quickfix' | 'refactor' | 'refactor.extract' | 'refactor.inline' | 'refactor.rewrite' | 'source' | 'source.organizeImports' */
  kind?: string
}

/** textDocument/codeAction 结果项 */
export interface CodeActionResult {
  title: string
  kind: string
  /** WorkspaceEdit(LSP 标准,结构因 server 而异) */
  edit?: unknown
  command?: { title: string; command: string; arguments?: unknown[] }
  isPreferred?: boolean
}

// ============================================================================
// b76-08a(2026-09-30 立):连接级能力位 —— 宿主注入,客户端不得自报
// ============================================================================

/**
 * 五个**连接级能力位**字段名(对照上游 zcode zcodeAgentConnectionScope 的清单,逐字):
 * `connectionId` / `clientMode` / `deliveryProfile` / `subscriberScope` / `workflowRunDeltas`。
 *
 * 为什么它们不得出现在客户端自报的入参里:"认不认得键级增量""订阅可见性档位"
 * "投递档"是**连接**的事实,只可能来自连接握手(clientHello)与宿主的会话状态;
 * 订阅入参自选这些档,等于让调用方自己给自己授权(AGENTS §5 同型:身份/档位只能
 * 从承载层显式入参进来)。所以**转发前**一律先 delete 这五个键,再由宿主写真值;
 * 宿主暂无等值生产点的档(我方现无 clientMode 等的生产点),"摘除即终局"——
 * 客户端自报值消失,且没有第二来源把它补回来。
 *
 * 唯一注入口(两侧各一份是跨语言的必然,漂移由守门对账):
 *  - TS:`stripClientCapabilityFields`(本文件下方;api-client 的 fetchApi /
 *    fetchAiServiceJson 转发面调用);
 *  - Python:`apps/ai-service/app/routers/engine.py::_bind_principal`
 *    (JSON-RPC 四入口 HTTP 单发/批量/SSE/WS 共用的身份注入点)。
 * 守门:`node scripts/check-capability-field-not-client-supplied.mjs --self-test`。
 */
export const CONNECTION_CAPABILITY_FIELDS = [
  'connectionId',
  'clientMode',
  'deliveryProfile',
  'subscriberScope',
  'workflowRunDeltas',
] as const

export type ConnectionCapabilityField = (typeof CONNECTION_CAPABILITY_FIELDS)[number]

/**
 * 宿主注入口(TS 侧唯一出口):从客户端自报的参数对象里**摘除**全部连接级能力位。
 *
 * 返回浅拷贝而不改入参(调用方可能还持着原对象做展示);键被摘除后**不会**留下
 * `key: undefined` 残影 —— "字段不存在"与"字段为空"必须可分(与 D174 traceId
 * 的"缺席 ≠ 空值"同一条纪律)。
 */
export function stripClientCapabilityFields<T extends Record<string, unknown>>(params: T): T {
  const out: Record<string, unknown> = { ...params }
  for (const field of CONNECTION_CAPABILITY_FIELDS) {
    delete out[field]
  }
  return out as T
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
