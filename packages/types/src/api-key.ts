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
 * 前端(DeveloperKeyDialog / PermissionSelector)展示全部权限点供用户勾选,
 * 后端 isValidApiKeyPermission 用于过滤写入防御。部分权限点对应的 /v1/* 端点
 * 可能尚未实现(前瞻性枚举),不影响契约层类型安全。
 */
export const API_KEY_PERMISSIONS = [
  /** 读取 Agent 列表/详情:GET /v1/agents, GET /v1/agents/:id */
  'agents:read',
  /** 调用 Agent:POST /v1/agents/:id/call */
  'agents:call',
  /** 读取 Chat 会话:GET /v1/chat/sessions */
  'chat:read',
  /** 发起 Chat 补全:POST /v1/chat/completions */
  'chat:write',
  /** 读取模型列表:GET /v1/models */
  'models:read',
  /** 管理自定义模型:POST/PUT/DELETE /v1/models/* */
  'models:write',
  /** 生成 Embedding:POST /v1/embeddings */
  'embeddings:write',
  /** 读取文件列表/详情:GET /v1/files, GET /v1/files/:id */
  'files:read',
  /** 上传/管理文件:POST /v1/files, DELETE /v1/files/:id */
  'files:write',
  /** 读取音色列表:GET /v1/audio/voices */
  'audio:read',
  /** 语音合成/识别:POST /v1/audio/speech, POST /v1/audio/transcriptions */
  'audio:write',
  /** 生成/编辑图片:POST /v1/images/generations, POST /v1/images/edits */
  'images:write',
  /** 生成/编排视频:POST /v1/videos/generations */
  'videos:write',
  /** 查询视频任务:GET /v1/videos/:id */
  'videos:read',
  /** 生成 3D 模型:POST /v1/3d/generations */
  'threed:write',
  /** 生成队列入队/查询:POST /v1/generation/queue, GET /v1/generation/queue/:id */
  'generation:write',
  /** 读取知识库:GET /v1/knowledge */
  'knowledge:read',
  /** 管理知识库:POST/PUT/DELETE /v1/knowledge/* */
  'knowledge:write',
  /** 读取工具/资源:GET /v1/tools */
  'tools:read',
  /** 调用工具:POST /v1/tools/:id/call */
  'tools:call',
  /** 读取记忆:GET /v1/memory */
  'memory:read',
  /** 写入记忆:POST/PUT /v1/memory */
  'memory:write',
  /** 查询消息状态:GET /v1/messages/:id */
  'messages:read',
  /** 发布/订阅消息:POST /v1/messages, WS /v1/messages/subscribe */
  'messages:write',
  /** 读取当前用户:GET /v1/user */
  'user:read',
  /** 读取工作区:GET /v1/workspace */
  'workspace:read',
  /** 读取工作流:GET /v1/workflows */
  'workflows:read',
  /** 执行工作流:POST /v1/workflows/:id/execute */
  'workflows:write',
  /** 读取使用量统计:GET /v1/stats */
  'stats:read',
] as const

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

/** /v1/chat/completions 响应体(OpenAI 兼容格式)。 */
export interface V1ChatCompletionResponse {
  id: string
  object: 'chat.completion'
  created: number
  model: string
  choices: Array<{
    index: number
    message: { role: 'assistant'; content: string }
    finishReason: 'stop' | 'length'
  }>
  usage: { promptTokens: number; completionTokens: number; totalTokens: number }
}

/** /v1/models 响应体(OpenAI 兼容格式)。 */
export interface V1ModelsResponse {
  object: 'list'
  data: Array<{
    id: string
    object: 'model'
    created: number
    ownedBy: string
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
