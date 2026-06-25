/**
 * API 服务统一导出
 * 基于全栈开发规划，提供统一的 API 服务接口
 */

// Agentic AI 服务
export * from './agentic.service'

// 认证服务 - 只导出 auth.service 中独有的，避免与 user.service 重复
export {
  login,
  register,
  logout,
  refreshToken,
  verifyToken,
  sendVerificationCode,
  resetPassword,
  type LoginRequest,
  type RegisterRequest,
  type AuthToken,
  type LoginResponse,
} from './auth/auth.service'

// 文件服务
export * from './file.service'

// AI内容生成服务
export * from './aiGeneration.service'

// 变量管理服务
export * from './variables.service'

// OAuth应用管理服务
export * from './oauthApps.service'

// 对话历史服务
export {
  queryChatRecords,
  createChatRecord,
  deleteChatRecord,
  updateChatMark,
  getChatHistoryMessages,
  type ChatRecord,
  type CreateChatRecordRequest,
  type QueryChatRecordsRequest,
  type UpdateChatMarkRequest,
  type ChatHistoryMessage,
  type GetChatMessagesRequest,
  type GetChatMessagesResponse,
} from './chatHistory.service'

// 大模型聊天服务（避免ChatMessage冲突，只导出需要的，排除ChatMessage）
export {
  createQwenWebSocket,
  createQwenOmniWebSocket,
  createZhipuWebSocket,
  createDeepSeekWebSocket,
  createDoubaoWebSocket,
  createCozeWebSocket,
  chatLuyala,
  chatOpenRouter,
  chatCozeSSE,
  type ChatStreamEvent,
  type QwenWebSocketRequest,
  type CozeWebSocketRequest,
  type CozeSSERequest,
  type LuyalaChatRequest,
  type LuyalaChatResponse,
  type OpenRouterChatRequest,
  type OpenRouterChatResponse,
  type LLMChatRequest as ChatRequest,
} from './llmChat.service'

// 统一AI聊天服务
export * from './unified-chat.service'

// 统一AI生成服务（图片、视频、音频、3D、视觉分析）
// 注意：GenerationType 已在 unified-chat.service 中导出，这里重命名为 MediaGenerationType
export {
  type GenerationType as MediaGenerationType,
  type GenerationProvider,
  type TaskStatus,
  type UnifiedGenerationRequest,
  type UnifiedGenerationResponse,
  type GenerationWebSocketCallbacks,
  unifiedGenerationService,
  generateContent,
  generateContentStream,
  getGenerationTaskStatus,
  cancelGenerationTask,
} from './unified-generation.service'

// Coze 流式聊天服务
export { streamChat } from './cozeChatStream.service'
