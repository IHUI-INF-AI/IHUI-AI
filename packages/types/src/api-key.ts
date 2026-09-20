// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 开发者 API Key 跨端契约(2026-07-22 立)。
 *
 * 解决问题:此前 permissions 字段为任意字符串数组,无枚举、无校验、无中间件。
 * 本文件定义权限点枚举 + 鉴权请求/响应类型,供 api / web / 共享层引用。
 *
 * 鉴权链路契约:
 * - 入站 header:`Authorization: Bearer ihui_xxx`(公开标识)或 `X-Api-Key: ihui_xxx`
 * - 可选 secret 校验:`X-Api-Secret: sk_xxx`(创建/轮换时返回,存储为 sha256 哈希)
 * - 鉴权中间件:authenticateApiKey + requireApiKeyPermission(perm)
 * - 配额:ApiKeyQuota.checkAndConsume,超限返回 429
 */

/**
 * API Key 权限点枚举。
 * 与 /v1/* 对外路由一一对应,新增端点必须同步新增权限点。
 *
 * 2026-07-22 扩展:从 7 个扩展到 27 个,覆盖全功能对外开放。
 */
export const API_KEY_PERMISSIONS = [
  // ===== Agent 类 =====
  /** 读取 Agent 列表/详情:GET /v1/agents, GET /v1/agents/:id */
  'agents:read',
  /** 调用 Agent:POST /v1/agents/:id/call, POST /v1/agents/execute */
  'agents:call',
  // ===== Chat / LLM 类 =====
  /** 读取 Chat 会话:GET /v1/chat/sessions */
  'chat:read',
  /** 发起 Chat 补全:POST /v1/chat/completions, POST /v1/chat/vision, POST /v1/chat/moa */
  'chat:write',
  // ===== Models 类 =====
  /** 读取模型列表/详情:GET /v1/models, GET /v1/models/:id */
  'models:read',
  /** 用户自定义模型配置:GET/POST/PUT/DELETE /v1/user/models */
  'models:write',
  // ===== Embeddings 类 =====
  /** Embedding 向量生成:POST /v1/embeddings */
  'embeddings:write',
  // ===== Files 类 =====
  /** 读取文件列表/详情/内容:GET /v1/files, GET /v1/files/:id, GET /v1/files/:id/content */
  'files:read',
  /** 上传/管理文件:POST /v1/files, DELETE /v1/files/:id, POST /v1/files/upload-init */
  'files:write',
  // ===== Audio 类 =====
  /** 读取音色/声纹:GET /v1/audio/voices, GET /v1/audio/speakers */
  'audio:read',
  /** TTS/ASR/语音对话/声纹注册:POST /v1/audio/speech, POST /v1/audio/transcriptions */
  'audio:write',
  // ===== Images 类 =====
  /** 文生图/图片编辑/修复/风格迁移:POST /v1/images/generations, POST /v1/images/edits */
  'images:write',
  // ===== Videos 类 =====
  /** 视频生成/编排:POST /v1/videos/generations, POST /v1/videos/compose */
  'videos:write',
  /** 视频任务查询:GET /v1/videos/tasks/:id */
  'videos:read',
  // ===== 3D 类 =====
  /** 3D 模型生成:POST /v1/3d/generations */
  'threed:write',
  // ===== Generation 队列类 =====
  /** 生成队列入队/取消/状态:POST /v1/generation/enqueue, GET /v1/generation/status/:id */
  'generation:write',
  // ===== Knowledge / RAG 类 =====
  /** 知识库文档/分块/搜索/RAG:GET /v1/knowledge/documents, POST /v1/knowledge/search */
  'knowledge:read',
  /** 文档入库/删除/知识图谱:POST /v1/knowledge/documents, DELETE /v1/knowledge/documents/:id */
  'knowledge:write',
  // ===== MCP Tools 类 =====
  /** MCP 工具/资源/提示词/技能查询:GET /v1/tools, GET /v1/resources, GET /v1/prompts */
  'tools:read',
  /** MCP 工具调用/sampling/slash 命令:POST /v1/tools/call, POST /v1/sampling */
  'tools:call',
  // ===== Memory 类 =====
  /** 记忆召回/语义搜索:GET /v1/memory, POST /v1/memory/search */
  'memory:read',
  /** 记忆保存/遗忘/Dream:POST /v1/memory, DELETE /v1/memory, POST /v1/memory/dream */
  'memory:write',
  // ===== Messages 类 =====
  /** 消息状态查询:GET /v1/messages/:id/status */
  'messages:read',
  /** 消息发布/订阅:POST /v1/messages, POST /v1/messages/subscribe */
  'messages:write',
  // ===== User / Workspace 类 =====
  /** 当前用户信息:GET /v1/me */
  'user:read',
  /** 工作区项目/文件:GET /v1/projects, GET /v1/projects/:id/files */
  'workspace:read',
  // ===== Workflows 类 =====
  /** 工作流定义查询:GET /v1/workflows/:id */
  'workflows:read',
  /** 工作流实例执行:POST /v1/workflows/instances, POST /v1/workflows/coze/run */
  'workflows:write',
  // ===== Stats 类 =====
  /** 使用量统计:GET /v1/usage, GET /v1/usage/:vendor */
  'stats:read',
  // ===== 2026-09-20 Agent 全面开放工程新增(O0 契约扩展) =====
  // 与 capability-catalog.ts 一一对应;每个新 scope 必须在目录里登记 dataClass/risk。
  // ===== Assistants / Threads / Runs 协议族 =====
  /** 助手读取:GET /v1/assistants, GET /v1/assistants/:id */
  'assistants:read',
  /** 助手创建/更新/删除:POST/PATCH/DELETE /v1/assistants/:id */
  'assistants:write',
  /** 会话线程读取:GET /v1/threads, GET /v1/threads/:id */
  'threads:read',
  /** 会话线程创建/删除:POST /v1/threads, DELETE /v1/threads/:id */
  'threads:write',
  /** Run 状态读取:GET /v1/threads/:id/runs/:runId */
  'runs:read',
  /** Run 创建/取消/提交:POST /v1/threads/:id/runs */
  'runs:write',
  // ===== Batch / Responses 协议族 =====
  /** 批任务读取:GET /v1/batches, GET /v1/batches/:id */
  'batches:read',
  /** 批任务创建/取消:POST /v1/batches */
  'batches:write',
  /** Responses 协议补全:POST /v1/responses */
  'responses:write',
  // ===== 实时 / 协议扩展 =====
  /** 实时语音/多模态长连接:WS /v1/realtime */
  'realtime:connect',
  /** 重排序:POST /v1/rerank */
  'rerank:write',
  /** 内容审核:POST /v1/moderations */
  'moderation:write',
  // ===== 代码 / Diff 能力 =====
  /** 代码库语义检索:POST /api/v1/codebase/search, GET /stats */
  'codebase:read',
  /** 代码库索引/删除:POST /api/v1/codebase/index, DELETE /repo/:id */
  'codebase:write',
  /** 补丁落盘:POST /api/v1/ai/apply-diff */
  'diff:apply',
  // ===== 执行类能力(高危) =====
  /** 沙箱命令执行:POST /api/sandbox/run(ai-service) */
  'sandbox:run',
  /** 浏览器自动化操作:browser_* 工具族 */
  'browser:operate',
  /** 本机 GUI 控制:computer_* 工具族(第三方 key 永不授予) */
  'computer:operate',
  // ===== Web 能力 =====
  /** URL 抓取/可读正文提取:fetch_url / fetch_readable / extract_web */
  'web:fetch',
  /** 站点地图与多页爬取:web_search / map_site / crawl_site */
  'search:web',
  // ===== 平台接入面 =====
  /** Webhook 订阅管理:/api/developer/webhooks/* */
  'webhooks:manage',
  /** 连接器/外部 MCP 读取:/api/connectors/*, /api/mcp/external/* */
  'connectors:read',
  /** 连接器/外部 MCP 注册与启停 */
  'connectors:write',
  /** 技能(Skill)清单读取 */
  'skills:read',
  /** 技能安装/启停/自定义 */
  'skills:write',
  /** 教育内容读取:edu_* 只读工具族 */
  'edu:read',
  /** 教育内容写入:edu_* 写工具族 */
  'edu:write',
  /** 以调用者身份对外发送消息(IM/邮件/站内信) */
  'im:send',
  /** 内容发布到第三方社媒(平台运营面) */
  'publish:operate',
  /** 自身账单/额度/用量读取:GET /v1/usage, GET /v1/billing/* */
  'billing:read',
  /** OAuth 应用与授权管理 */
  'oauth:manage',
  /** MCP server 接入(作为协议端点被外部 agent 连接) */
  'mcp:connect',
  /** 平台内部运维操作(db_query/git/定时任务/PR 审查等)—— 机器凭据永不放行 */
  'ops:execute',
] as const

/**
 * 新建 API Key 的默认权限集(2026-09-20 收紧)。
 *
 * 变更原因(O2):此前默认含 `chat:write`,任何新 key 开箱即可调用付费模型烧余额,
 * 在「向第三方 Agent 全面开放」的前提下等于把计费闸门交给陌生人。
 * 现默认仅开放只读元数据(models:read),写能力必须由创建者显式授予。
 * 注意:创建时显式传入合法权限数组将覆盖默认值;updateKey 不受影响(可显式清空)。
 */
export const DEFAULT_API_KEY_PERMISSIONS = ['models:read'] as const

/** 权限点类型(联合类型,编译期枚举校验)。 */
export type ApiKeyPermission = (typeof API_KEY_PERMISSIONS)[number]

/** 权限点集合(运行期校验用)。 */
export const API_KEY_PERMISSION_SET: ReadonlySet<string> = new Set(API_KEY_PERMISSIONS)

/**
 * 校验字符串是否为合法权限点。
 * 用于 Zod schema 与路由层运行期校验,拒绝任意字符串注入。
 */
export function isValidApiKeyPermission(value: string): value is ApiKeyPermission {
  return API_KEY_PERMISSION_SET.has(value)
}

/** API Key 状态。 */
export type ApiKeyStatus = 'active' | 'revoked'

/** 创建 API Key 请求体。 */
export interface CreateApiKeyRequest {
  name: string
  permissions: ApiKeyPermission[]
  /** 每分钟请求上限,默认 60。 */
  rateLimit?: number
  // --- P0-7 安全粒度字段(2026-07-31 立)---
  /** 过期时间(ISO 字符串,null = 永不过期) */
  expiresAt?: string | null
  /** IP 白名单(null/空 = 不限制),支持 CIDR */
  allowedIps?: string[] | null
  /** 模型白名单(null/空 = 不限制),支持通配符 gpt-4* */
  allowedModels?: string[] | null
  /** 单次请求 token 上限(null = 不限制) */
  maxTokensPerReq?: number | null
}

/** 更新 API Key 请求体(所有字段可选)。 */
export interface UpdateApiKeyRequest {
  name?: string
  permissions?: ApiKeyPermission[]
  rateLimit?: number
  status?: ApiKeyStatus
  // --- P0-7 安全粒度字段(2026-07-31 立)---
  expiresAt?: string | null
  allowedIps?: string[] | null
  allowedModels?: string[] | null
  maxTokensPerReq?: number | null
}

/** 创建 API Key 响应(secret 仅此一次返回)。 */
export interface CreateApiKeyResponse {
  apiKey: ApiKeyInfo
  /** 完整 secret,仅创建/轮换时返回,后续不可查询。 */
  secret: string
}

/** API Key 信息(脱敏后,不含 secret)。 */
export interface ApiKeyInfo {
  id: string
  name: string
  /** 公开标识 ihui_xxx,可展示。 */
  key: string
  permissions: ApiKeyPermission[]
  status: ApiKeyStatus
  lastUsedAt: string | null
  rateLimit: number
  createdAt: string
  updatedAt: string
  // --- P0-7 安全粒度字段(2026-07-31 立)---
  expiresAt: string | null
  allowedIps: string[] | null
  allowedModels: string[] | null
  maxTokensPerReq: number | null
}

/** 轮换 secret 响应。 */
export interface RotateApiKeyResponse {
  apiKey: ApiKeyInfo
  secret: string
}

/** API Key 配额信息。 */
export interface ApiKeyQuotaInfo {
  apiKeyId: string
  hourlyUsed: number
  dailyUsed: number
  hourlyLimit: number
  dailyLimit: number
  resetAt: string
}

/** 鉴权后注入到 request 的 API Key 上下文(后端内部使用)。 */
export interface AuthenticatedApiKey {
  id: string
  userId: string
  key: string
  permissions: ApiKeyPermission[]
  rateLimit: number
  // --- P0-7 安全粒度字段(2026-07-31 立)---
  /** 过期时间(Date 对象,null = 永不过期) */
  expiresAt: Date | null
  allowedIps: string[] | null
  allowedModels: string[] | null
  maxTokensPerReq: number | null
  // --- Key 级限流窗口 + IP 黑名单(2026-09-16/O2 2026-09-21,与 schema 同步)---
  /** IP 黑名单(jsonb 字符串数组,null = 无黑名单),命中即 403 */
  blockedIps: string[] | null
  /** 5 小时窗口最大请求数(null = 不限) */
  rateLimit5h: number | null
  /** 每日(UTC+8 自然日)最大请求数(null = 不限) */
  rateLimit1d: number | null
  /** 每周(UTC+8 周一~周日)最大请求数(null = 不限) */
  rateLimit7d: number | null
}

/** /v1/chat/completions 请求体(OpenAI 兼容格式子集)。 */
export interface V1ChatCompletionRequest {
  model: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  /** 是否流式返回,默认 false。 */
  stream?: boolean
  temperature?: number
  maxTokens?: number
}

/**
 * /v1/chat/completions 响应体(OpenAI 兼容格式)。
 *
 * P0-5m(2026-07-30):字段名严格遵循 OpenAI 协议(snake_case),
 * 确保 openai-python / openai-node SDK 可直接消费。
 */
export interface V1ChatCompletionResponse {
  id: string
  object: 'chat.completion'
  created: number
  model: string
  choices: Array<{
    index: number
    message: { role: 'assistant'; content: string }
    finish_reason: 'stop' | 'length'
  }>
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

/** /v1/models 响应体(OpenAI 兼容格式,字段名 snake_case)。 */
export interface V1ModelsResponse {
  object: 'list'
  data: Array<{
    id: string
    object: 'model'
    created: number
    owned_by: string
    /** 平台模型是否可用(有额度且 provider 健康)。BYOK/实时/降级路径恒为 true。OpenAI 客户端可忽略。 */
    available?: boolean
  }>
}

/** /v1/agents 响应体。 */
export interface V1AgentInfo {
  id: string
  name: string
  description: string
  capabilities: string[]
}

/** /v1/agents 列表响应。 */
export interface V1AgentsListResponse {
  object: 'list'
  data: V1AgentInfo[]
}

/** /v1/agents/:id/call 请求体。 */
export interface V1AgentCallRequest {
  input: string
  /** 可选会话 ID,用于多轮对话。 */
  sessionId?: string
}

/** /v1/agents/:id/call 响应体。 */
export interface V1AgentCallResponse {
  agentId: string
  sessionId: string
  output: string
  usage: { totalTokens: number }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
