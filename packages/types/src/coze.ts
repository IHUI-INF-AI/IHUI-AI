/**
 * Coze 跨端共享类型定义
 * 各端 Coze 客户端禁止本地定义类型,必须 import 本文件。
 * 字段命名与 Coze 官方 API 保持一致(snake_case),token/baseUrl/botId/timeout 为本地配置。
 */

/** Coze 客户端配置(PAT 直连 Coze 官方 API) */
export interface CozeConfig {
  /** Coze 个人访问令牌(PAT) */
  token: string
  /** API 基础地址,默认 https://api.coze.cn */
  baseUrl: string
  /** 默认 Bot ID */
  botId: string
  /** 请求超时(ms) */
  timeout: number
}

/** 对话消息(请求体) */
export interface CozeChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  content_type?: 'text' | 'object_string'
  /** Coze 消息类型,如 question / answer */
  type?: string
  meta_data?: Record<string, unknown>
}

/** 创建对话请求参数 */
export interface CozeCreateChatOptions {
  bot_id?: string
  user_id: string
  conversation_id?: string
  additional_messages?: CozeChatMessage[]
  custom_variables?: Record<string, unknown>
  parameters?: Record<string, unknown>
  auto_save_history?: boolean
}

/** Token 用量统计 */
export interface CozeUsage {
  input_count?: number
  output_count?: number
  token_count?: number
}

/** 创建对话响应 */
export interface CozeChatCreated {
  id: string
  conversation_id: string
  status: string
  usage?: CozeUsage
}

/** 对话状态查询响应 */
export interface CozeChatStatus {
  status: string
  usage?: CozeUsage
  last_error?: string
  completed_at?: number
}

/** 对话消息列表项 */
export interface CozeChatMessageItem {
  id: string
  type: string
  content: string
  content_type: string
  created_at: number
}

/** Workflow 运行结果 */
export interface CozeWorkflowRunResult {
  execute_id: string
  debug_url?: string
  data?: unknown
}

/** 流式对话回调处理器 */
export interface CozeStreamChatHandlers {
  onDelta?: (delta: string) => void
  onDone?: () => void
  onError?: (err: Error) => void
}
