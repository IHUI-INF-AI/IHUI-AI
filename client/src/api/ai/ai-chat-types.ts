/**
 * AI聊天接口类型定义
 * 
 * 定义所有AI聊天相关的接口参数和响应类型
 * 确保前后端参数对接的一致性
 * 
 * @module api/ai-chat-types
 * @version 1.0.0
 */

// ============================================================================
// 后端API接口参数映射
// ============================================================================

/**
 * FastAPI聊天接口参数
 * 对应后端 /api/v1/chat/completions
 */
export interface FastAPIChatRequest {
  messages: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
  model?: string
  temperature?: number
  max_tokens?: number
  user_uuid?: string
  stream?: boolean
}

export interface FastAPIChatResponse {
  id: string
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

/**
 * FastAPI任务创建接口参数
 * 对应后端 /api/v1/tasks
 */
export interface FastAPICreateTaskRequest {
  user_uuid: string
  user_input: string
  context?: Record<string, unknown>
  priority?: 1 | 2 | 3 | 4 // 1=低, 2=普通, 3=高, 4=紧急
}

export interface FastAPITaskResponse {
  task_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  result?: unknown
  error?: string
  progress?: number
  started_at?: string
  completed_at?: string
}

/**
 * Coze聊天接口参数
 * 对应后端 /cozeZhsApi/chat 和 /cozeZhsApi/chat/stream
 */
export interface CozeChatRequest {
  bot_id: string
  user_id: string
  query: string
  conversation_id?: string
  chat_history?: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
  additional_messages?: Array<{
    role: string
    content: string
    content_type?: string
  }>
  stream?: boolean
}

export interface CozeChatResponse {
  conversation_id?: string
  message_id?: string
  content?: string
  role?: string
  status?: string
}

/**
 * Coze流式事件类型
 */
export interface CozeStreamEvent {
  event?: string
  data?: {
    content?: string
    conversation_id?: string
    id?: string
    role?: string
    type?: string
  }
  error?: {
    message?: string
    code?: string
  }
}

/**
 * 通义千问WebSocket接口参数
 * 对应后端 /cozeZhsApi/ws/qwen/stream
 */
export interface QwenWebSocketMessage {
  type: 'chat'
  data: {
    user_uuid: string
    query: string
    chat_id?: string
    temperature?: number
    max_tokens?: number
  }
}

export interface QwenWebSocketResponse {
  type: 'chunk' | 'done' | 'error'
  content?: string
  error?: string
  usage?: {
    total_tokens?: number
  }
}

/**
 * 智谱AI WebSocket接口参数
 * 对应后端 /cozeZhsApi/ws/zhipu/stream
 */
export interface ZhipuWebSocketMessage {
  type: 'chat'
  data: {
    user_uuid: string
    query: string
    chat_id?: string
  }
}

/**
 * DeepSeek WebSocket接口参数
 * 对应后端 /cozeZhsApi/ws/chatdeepseek/stream
 */
export interface DeepSeekWebSocketMessage {
  type: 'chat'
  data: {
    user_uuid: string
    query: string
    chat_id?: string
  }
}

/**
 * 豆包 WebSocket接口参数
 * 对应后端 /cozeZhsApi/ws/doubao/streamDou
 */
export interface DoubaoWebSocketMessage {
  user_uuid: string
  query: string
  chat_id?: string
}

/**
 * 统一AI调用接口参数
 * 对应后端 /api/unified-ai/invoke
 */
export interface UnifiedAIInvokeRequest {
  type: 'model' | 'agent' | 'agentic' | 'mcp' | 'hybrid'
  capabilityId?: string
  input: unknown
  context?: {
    userMessage?: string
    conversationHistory?: Array<{ role: string; content: string }>
    currentData?: unknown
    preferences?: Record<string, unknown>
  }
  options?: {
    timeout?: number
    retry?: boolean
    fallback?: UnifiedAIInvokeRequest
    parallel?: boolean
    temperature?: number
    maxTokens?: number
    stream?: boolean
  }
}

export interface UnifiedAIInvokeResponse {
  success: boolean
  data?: unknown
  error?: string
  capabilityType: string
  capabilityId: string
  metadata?: {
    latency?: number
    tokensUsed?: number
    cost?: number
    model?: string
    agent?: string
    tools?: string[]
  }
  timestamp: number
}

// ============================================================================
// 会话管理接口
// ============================================================================

/**
 * 创建会话接口参数
 * 对应后端 /api/developer/ai/chat/sessions
 */
export interface CreateSessionRequest {
  title?: string
  modelId?: string
  metadata?: Record<string, unknown>
}

export interface ChatSession {
  id: string
  title: string
  modelId?: string
  modelName?: string
  messageCount: number
  lastMessage?: string
  lastMessageTime?: string
  createTime: string
  updateTime: string
}

/**
 * 获取会话消息接口参数
 * 对应后端 /api/developer/ai/chat/sessions/:id/messages
 */
export interface GetSessionMessagesRequest {
  page?: number
  pageSize?: number
}

export interface SessionMessage {
  id: string
  sessionId?: string
  content: string
  modelId: string
  modelName: string
  role?: 'user' | 'assistant'
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  metadata?: Record<string, unknown>
  createTime: string
}

// ============================================================================
// MCP工具接口
// ============================================================================

/**
 * MCP工具调用接口参数
 */
export interface MCPToolCallRequest {
  serverId: string
  toolName: string
  params: Record<string, unknown>
}

export interface MCPToolCallResponse {
  success: boolean
  result?: unknown
  error?: string
  executionTime?: number
}

/**
 * MCP服务器信息
 */
export interface MCPServer {
  id: string
  name: string
  description?: string
  status: 'online' | 'offline' | 'error'
  capabilities?: {
    tools?: MCPTool[]
    resources?: MCPResource[]
  }
}

export interface MCPTool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

export interface MCPResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

// ============================================================================
// Agent接口
// ============================================================================

/**
 * Agent调用接口参数
 */
export interface AgentCallRequest {
  agentId: string
  input: string
  context?: {
    user_uuid?: string
    conversation_id?: string
    chat_history?: Array<{ role: string; content: string }>
  }
  stream?: boolean
}

export interface AgentCallResponse {
  success: boolean
  content?: string
  conversationId?: string
  messageId?: string
  metadata?: {
    agent?: string
    tools?: string[]
    executionTime?: number
  }
}

// ============================================================================
// 内容生成接口
// ============================================================================

/**
 * AI内容生成接口参数
 * 对应后端 /cozeZhsApi/ai/generate
 */
export interface AIGenerateRequest {
  prompt: string
  modelId: string
  type: 'text' | 'image' | 'audio' | 'video' | 'code'
  parameters?: {
    temperature?: number
    maxTokens?: number
    topP?: number
    frequencyPenalty?: number
    presencePenalty?: number
    // 图像生成参数
    width?: number
    height?: number
    steps?: number
    negativePrompt?: string
    seed?: number
    // 视频生成参数
    duration?: number
    fps?: number
    // 音频生成参数
    voice?: string
    speed?: number
    [key: string]: unknown
  }
}

export interface AIGenerateResponse {
  id: string
  type: string
  content: string
  url?: string
  thumbnailUrl?: string
  modelId: string
  modelName: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  metadata?: Record<string, unknown>
  timestamp: string
}

// ============================================================================
// 模型管理接口
// ============================================================================

/**
 * 获取模型列表接口
 * 对应后端 /ihui-ai-api/llm/models-unify（Python 后端）
 */
export interface GetModelsRequest {
  is_del?: 0 | 1
  type?: number // 0=多模态, 1=文本, 2=图片, 3=视频, 4=音频, 5=数字人
  page?: number
  pageSize?: number
}

export interface AIModelInfo {
  id: string
  name: string
  displayName?: string
  provider: string
  description?: string
  category: 'talk' | 'image' | 'video' | 'audio'
  isAvailable: boolean
  supportsStreaming?: boolean
  supportsImages?: boolean
  supportsAudio?: boolean
  supportsVideo?: boolean
  icon?: string
  usageCount?: number
  rating?: number
  tags?: string[]
  // 扩展标记
  isUniversal?: boolean
  isDigitalHuman?: boolean
  is_new?: number
  is_top?: number
  // 扩展字段
  modelCode?: string
  source?: string
  remark?: string
  type?: number | string
}

// ============================================================================
// 错误类型
// ============================================================================

/**
 * API错误响应
 */
export interface APIErrorResponse {
  code: number
  message: string
  error?: string
  details?: Record<string, unknown>
  timestamp?: number
}

/**
 * WebSocket错误
 */
export interface WebSocketError {
  type: 'error'
  code?: string
  message: string
  recoverable?: boolean
}

// ============================================================================
// 通用类型
// ============================================================================

/**
 * 分页参数
 */
export interface PaginationParams {
  page?: number
  pageSize?: number
}

/**
 * 分页响应
 */
export interface PaginationResponse<T> {
  list: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

/**
 * API响应包装
 */
export interface ApiResponse<T> {
  code: number
  success: boolean
  message: string
  data: T
  timestamp: number
}

// ============================================================================
// 类型守卫
// ============================================================================

export function isFastAPIChatResponse(data: unknown): data is FastAPIChatResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'choices' in data &&
    Array.isArray((data as FastAPIChatResponse).choices)
  )
}

export function isCozeStreamEvent(data: unknown): data is CozeStreamEvent {
  return (
    typeof data === 'object' &&
    data !== null &&
    ('event' in data || 'data' in data || 'error' in data)
  )
}

export function isAPIErrorResponse(data: unknown): data is APIErrorResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'code' in data &&
    'message' in data &&
    typeof (data as APIErrorResponse).code === 'number'
  )
}
