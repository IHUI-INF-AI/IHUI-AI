import { t } from '@/utils/i18n'

/**
 * 统一AI对话Composable
 * 
 * 为AI对话框组件提供统一的状态管理和接口调用
 * 支持所有AI模式：Model、Agent、Agentic、MCP、Hybrid、Generation
 * 
 * @module composables/useUnifiedAIChat
 * @version 2.0.0
 */

import { ref, computed, onMounted, onUnmounted, type Ref, type ComputedRef } from 'vue'
import { ElMessage } from 'element-plus'
import {
  unifiedChatService,
  type UnifiedChatRequest,
  type UnifiedChatResponse,
  type AIChatMode,
  type GenerationType,
  type ChatMessageInput,
} from '@/api/services/unified-chat.service'
import type { ChatMessage, MessageStatus, TokenUsage } from '@/types/ai-platform.types'
import { logger } from '@/utils/logger'

// ============================================================================
// 类型定义
// ============================================================================

/** AI对话配置 */
export interface UnifiedAIChatConfig {
  /** 默认AI模式 */
  defaultMode?: AIChatMode
  /** 默认模型ID */
  defaultModelId?: string
  /** 默认Agent ID */
  defaultAgentId?: string
  /** 是否启用流式响应 */
  enableStream?: boolean
  /** 系统提示词 */
  systemPrompt?: string
  /** 温度参数 */
  temperature?: number
  /** 最大Token数 */
  maxTokens?: number
  /** 是否自动保存历史 */
  autoSaveHistory?: boolean
  /** 最大历史消息数 */
  maxHistoryMessages?: number
  /** 是否显示Token使用统计 */
  showTokenUsage?: boolean
  /** 消息发送后回调 */
  onMessageSent?: (message: ChatMessage) => void
  /** 消息接收后回调 */
  onMessageReceived?: (message: ChatMessage) => void
  /** 错误回调 */
  onError?: (error: Error) => void
}

/** AI对话状态 */
export interface UnifiedAIChatState {
  /** 消息列表 */
  messages: Ref<ChatMessage[]>
  /** 当前AI模式 */
  currentMode: Ref<AIChatMode>
  /** 当前模型ID */
  currentModelId: Ref<string | undefined>
  /** 当前Agent ID */
  currentAgentId: Ref<string | undefined>
  /** 是否正在发送 */
  isSending: Ref<boolean>
  /** 是否正在流式接收 */
  isStreaming: Ref<boolean>
  /** 当前会话ID */
  sessionId: Ref<string | undefined>
  /** 当前对话ID */
  conversationId: Ref<string | undefined>
  /** 输入内容 */
  inputContent: Ref<string>
  /** 附件文件 */
  attachedFiles: Ref<File[]>
  /** Token使用统计 */
  totalTokenUsage: Ref<TokenUsage>
  /** 错误信息 */
  lastError: Ref<string | undefined>
  /** 生成类型（generation模式） */
  generationType: Ref<GenerationType>
}

/** AI对话操作 */
export interface UnifiedAIChatActions {
  /** 发送消息 */
  sendMessage: (content?: string, files?: File[]) => Promise<void>
  /** 重试消息 */
  retryMessage: (messageId: string) => Promise<void>
  /** 停止生成 */
  stopGeneration: () => void
  /** 清空对话 */
  clearMessages: () => void
  /** 删除消息 */
  deleteMessage: (messageId: string) => void
  /** 编辑消息 */
  editMessage: (messageId: string, newContent: string) => void
  /** 切换AI模式 */
  switchMode: (mode: AIChatMode) => void
  /** 切换模型 */
  switchModel: (modelId: string) => void
  /** 切换Agent */
  switchAgent: (agentId: string) => void
  /** 设置系统提示词 */
  setSystemPrompt: (prompt: string) => void
  /** 设置生成类型 */
  setGenerationType: (type: GenerationType) => void
  /** 加载历史对话 */
  loadConversation: (conversationId: string) => Promise<void>
  /** 创建新对话 */
  createNewConversation: () => void
  /** 导出对话 */
  exportConversation: (format?: 'json' | 'markdown' | 'text') => string
}

/** AI对话计算属性 */
export interface UnifiedAIChatComputed {
  /** 是否有消息 */
  hasMessages: ComputedRef<boolean>
  /** 是否可以发送 */
  canSend: ComputedRef<boolean>
  /** 是否正在加载 */
  isLoading: ComputedRef<boolean>
  /** 最后一条消息 */
  lastMessage: ComputedRef<ChatMessage | undefined>
  /** 最后一条用户消息 */
  lastUserMessage: ComputedRef<ChatMessage | undefined>
  /** 最后一条AI消息 */
  lastAIMessage: ComputedRef<ChatMessage | undefined>
  /** 用户消息数量 */
  userMessageCount: ComputedRef<number>
  /** AI消息数量 */
  aiMessageCount: ComputedRef<number>
  /** 当前模式标签 */
  currentModeLabel: ComputedRef<string>
}

/** useUnifiedAIChat返回类型 */
export interface UnifiedAIChatReturn extends UnifiedAIChatState, UnifiedAIChatActions, UnifiedAIChatComputed {
  /** 配置 */
  config: Ref<UnifiedAIChatConfig>
}

// ============================================================================
// 辅助函数
// ============================================================================

/** 生成消息ID */
function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/** 生成会话ID */
function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/** 获取用户UUID */
function getUserUuid(): string {
  if (typeof window !== 'undefined') {
    return (
      (window as { userUuid?: string }).userUuid ||
      localStorage.getItem('userUuid') ||
      `user-${Date.now()}`
    )
  }
  return `user-${Date.now()}`
}

/** 模式标签映射 */
const MODE_LABELS: Record<AIChatMode, string> = {
  model: '模型对话',
  agent: '智能体',
  agentic: 'Agentic AI',
  mcp: 'MCP工具',
  hybrid: '混合模式',
  generation: '内容生成',
}

// ============================================================================
// Composable实现
// ============================================================================

export function useUnifiedAIChat(initialConfig: UnifiedAIChatConfig = {}): UnifiedAIChatReturn {
  // ========== 配置 ==========
  const config = ref<UnifiedAIChatConfig>({
    defaultMode: 'model',
    enableStream: true,
    temperature: 0.7,
    maxTokens: 2048,
    autoSaveHistory: true,
    maxHistoryMessages: 100,
    showTokenUsage: true,
    ...initialConfig,
  })

  // ========== 状态 ==========
  const messages = ref<ChatMessage[]>([])
  const currentMode = ref<AIChatMode>(config.value.defaultMode || 'model')
  const currentModelId = ref<string | undefined>(config.value.defaultModelId)
  const currentAgentId = ref<string | undefined>(config.value.defaultAgentId)
  const isSending = ref(false)
  const isStreaming = ref(false)
  const sessionId = ref<string | undefined>(generateSessionId())
  const conversationId = ref<string | undefined>()
  const inputContent = ref('')
  const attachedFiles = ref<File[]>([])
  const totalTokenUsage = ref<TokenUsage>({
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  })
  const lastError = ref<string | undefined>()
  const generationType = ref<GenerationType>('auto')
  const systemPrompt = ref(config.value.systemPrompt || '')
  
  // 内部状态
  const currentRequestId = ref<string | undefined>()
  const streamingMessageId = ref<string | undefined>()

  // ========== 计算属性 ==========
  const hasMessages = computed(() => messages.value.length > 0)
  
  const canSend = computed(() => {
    return !isSending.value && !isStreaming.value && (
      inputContent.value.trim().length > 0 || attachedFiles.value.length > 0
    )
  })
  
  const isLoading = computed(() => isSending.value || isStreaming.value)
  
  const lastMessage = computed(() => {
    return messages.value.length > 0 ? messages.value[messages.value.length - 1] : undefined
  })
  
  const lastUserMessage = computed(() => {
    return [...messages.value].reverse().find(m => m.role === 'user')
  })
  
  const lastAIMessage = computed(() => {
    return [...messages.value].reverse().find(m => m.role === 'assistant')
  })
  
  const userMessageCount = computed(() => {
    return messages.value.filter(m => m.role === 'user').length
  })
  
  const aiMessageCount = computed(() => {
    return messages.value.filter(m => m.role === 'assistant').length
  })
  
  const currentModeLabel = computed(() => MODE_LABELS[currentMode.value] || '对话')

  // ========== 核心方法 ==========

  /** 发送消息 */
  async function sendMessage(content?: string, files?: File[]): Promise<void> {
    const messageContent = content?.trim() || inputContent.value.trim()
    const messageFiles = files || attachedFiles.value
    
    if (!messageContent && messageFiles.length === 0) {
      return
    }
    
    // 重置状态
    lastError.value = undefined
    isSending.value = true
    
    // 创建用户消息
    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content: messageContent,
      status: 'sending',
      createTime: new Date().toISOString(),
      files: messageFiles.map(f => ({
        id: generateMessageId(),
        name: f.name,
        type: f.type,
        size: f.size,
        uploadedAt: new Date().toISOString(),
      })),
    }
    
    messages.value.push(userMessage)
    
    // 清空输入
    inputContent.value = ''
    attachedFiles.value = []
    
    // 创建AI消息占位符
    const aiMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'assistant',
      content: '',
      status: 'sending',
      createTime: new Date().toISOString(),
      isStreaming: config.value.enableStream,
      metadata: {
        mode: currentMode.value,
        model: currentModelId.value,
        agent: currentAgentId.value,
      },
    }
    
    messages.value.push(aiMessage)
    streamingMessageId.value = aiMessage.id
    
    try {
      // 构建请求
      const request: UnifiedChatRequest = {
        messages: buildMessageHistory(),
        mode: currentMode.value,
        sessionId: sessionId.value,
        conversationId: conversationId.value,
        userUuid: getUserUuid(),
        modelId: currentModelId.value,
        agentId: currentAgentId.value,
        temperature: config.value.temperature,
        maxTokens: config.value.maxTokens,
        systemPrompt: systemPrompt.value || undefined,
        stream: config.value.enableStream,
        generationType: currentMode.value === 'generation' ? generationType.value : undefined,
      }
      
      currentRequestId.value = aiMessage.id
      
      if (config.value.enableStream) {
        // 流式发送
        isStreaming.value = true
        
        await unifiedChatService.sendMessageStream(request, {
          onChunk: (chunk) => {
            const msg = messages.value.find(m => m.id === aiMessage.id)
            if (msg) {
              msg.content += chunk
              msg.status = 'streaming'
            }
          },
          onComplete: (response) => {
            updateMessageFromResponse(aiMessage.id, response)
            handleMessageComplete(userMessage, response)
          },
          onError: (error) => {
            handleMessageError(aiMessage.id, error)
          },
          onProgress: (progress, message) => {
            logger.debug('[UnifiedAIChat] Progress', { progress, message })
          },
        })
      } else {
        // 非流式发送
        const response = await unifiedChatService.sendMessage(request)
        
        if (response.success && response.data) {
          updateMessageFromResponse(aiMessage.id, response.data)
          handleMessageComplete(userMessage, response.data)
        } else {
          handleMessageError(aiMessage.id, new Error(response.message))
        }
      }
      
      // 更新用户消息状态
      const userMsg = messages.value.find(m => m.id === userMessage.id)
      if (userMsg) {
        userMsg.status = 'sent'
      }
      
      config.value.onMessageSent?.(userMessage)
    } catch (error) {
      logger.error('[UnifiedAIChat] Failed to send message', error)
      handleMessageError(aiMessage.id, error instanceof Error ? error : new Error(String(error)))
      
      // 更新用户消息状态为失败
      const userMsg = messages.value.find(m => m.id === userMessage.id)
      if (userMsg) {
        userMsg.status = 'failed'
      }
    } finally {
      isSending.value = false
      isStreaming.value = false
      streamingMessageId.value = undefined
      currentRequestId.value = undefined
    }
  }

  /** 重试消息 */
  async function retryMessage(messageId: string): Promise<void> {
    const messageIndex = messages.value.findIndex(m => m.id === messageId)
    if (messageIndex === -1) return
    
    const message = messages.value[messageIndex]
    
    // 如果是用户消息，重发该消息
    if (message.role === 'user') {
      // 删除该消息及其后的所有消息
      messages.value.splice(messageIndex)
      // 重新发送
      await sendMessage(message.content)
    } else {
      // 如果是AI消息，找到对应的用户消息重发
      const userMessageIndex = messages.value.slice(0, messageIndex).reverse().findIndex(m => m.role === 'user')
      if (userMessageIndex !== -1) {
        const actualIndex = messageIndex - 1 - userMessageIndex
        const userMessage = messages.value[actualIndex]
        // 删除用户消息及其后的所有消息
        messages.value.splice(actualIndex)
        // 重新发送
        await sendMessage(userMessage.content)
      }
    }
  }

  /** 停止生成 */
  function stopGeneration(): void {
    if (currentRequestId.value) {
      unifiedChatService.cancelRequest(currentRequestId.value)
      
      // 更新消息状态
      if (streamingMessageId.value) {
        const msg = messages.value.find(m => m.id === streamingMessageId.value)
        if (msg) {
          msg.isStreaming = false
          msg.status = 'sent'
          if (!msg.content) {
            msg.content = '（生成已停止）'
          }
        }
      }
      
      isSending.value = false
      isStreaming.value = false
      streamingMessageId.value = undefined
      currentRequestId.value = undefined
    }
  }

  /** 清空对话 */
  function clearMessages(): void {
    messages.value = []
    sessionId.value = generateSessionId()
    conversationId.value = undefined
    totalTokenUsage.value = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    }
    lastError.value = undefined
  }

  /** 删除消息 */
  function deleteMessage(messageId: string): void {
    const index = messages.value.findIndex(m => m.id === messageId)
    if (index !== -1) {
      messages.value.splice(index, 1)
    }
  }

  /** 编辑消息 */
  function editMessage(messageId: string, newContent: string): void {
    const message = messages.value.find(m => m.id === messageId)
    if (message) {
      message.content = newContent
      message.edited = true
      message.updateTime = new Date().toISOString()
    }
  }

  /** 切换AI模式 */
  function switchMode(mode: AIChatMode): void {
    currentMode.value = mode
    logger.info('[UnifiedAIChat] Switch mode', { mode })
  }

  /** 切换模型 */
  function switchModel(modelId: string): void {
    currentModelId.value = modelId
    logger.info('[UnifiedAIChat] Switch model', { modelId })
  }

  /** 切换Agent */
  function switchAgent(agentId: string): void {
    currentAgentId.value = agentId
    currentMode.value = 'agent'
    logger.info('[UnifiedAIChat] Switch agent', { agentId })
  }

  /** 设置系统提示词 */
  function setSystemPrompt(prompt: string): void {
    systemPrompt.value = prompt
  }

  /** 设置生成类型 */
  function setGenerationType(type: GenerationType): void {
    generationType.value = type
    if (type !== 'auto') {
      currentMode.value = 'generation'
    }
  }

  /** 加载历史对话 */
  async function loadConversation(convId: string): Promise<void> {
    try {
      const { getConversationMessages } = await import('@/api/chat/chat-history')
      const response = await getConversationMessages(convId, { limit: 100 })
      
      if (response.code === 200 && response.data?.messages) {
        conversationId.value = convId
        messages.value = response.data.messages.map((msg: { 
          id?: string
          role: string
          content: string
          createTime?: string
          metadata?: Record<string, unknown>
        }) => ({
          id: msg.id || generateMessageId(),
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
          status: 'sent' as MessageStatus,
          createTime: msg.createTime || new Date().toISOString(),
          metadata: msg.metadata,
        }))
      }
    } catch (error) {
      logger.error('[UnifiedAIChat] Failed to load conversation history', error)
      lastError.value = '加载对话历史失败'
      ElMessage.error(t('msg.use_unified_a_i_chat.加载对话历史失败'))
    }
  }

  /** 创建新对话 */
  function createNewConversation(): void {
    clearMessages()
  }

  /** 导出对话 */
  function exportConversation(format: 'json' | 'markdown' | 'text' = 'markdown'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(messages.value, null, 2)
      
      case 'markdown':
        return messages.value.map(m => {
          const role = m.role === 'user' ? '**用户**' : '**AI**'
          return `${role}:\n\n${m.content}\n\n---\n`
        }).join('\n')
      
      case 'text':
      default:
        return messages.value.map(m => {
          const role = m.role === 'user' ? '用户' : 'AI'
          return `[${role}]: ${m.content}`
        }).join('\n\n')
    }
  }

  // ========== 内部辅助方法 ==========

  /** 构建消息历史 */
  function buildMessageHistory(): ChatMessageInput[] {
    const maxMessages = config.value.maxHistoryMessages || 100
    const recentMessages = messages.value.slice(-maxMessages)
    
    return recentMessages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({
        role: m.role,
        content: m.content,
      }))
  }

  /** 更新消息从响应 */
  function updateMessageFromResponse(messageId: string, response: UnifiedChatResponse): void {
    const msg = messages.value.find(m => m.id === messageId)
    if (msg) {
      msg.content = response.content
      msg.status = response.status === 'success' ? 'sent' : 'failed'
      msg.isStreaming = false
      msg.metadata = {
        ...msg.metadata,
        ...response.metadata,
        processingTime: response.processingTime,
      }
      
      if (response.usage) {
        totalTokenUsage.value.promptTokens += response.usage.promptTokens
        totalTokenUsage.value.completionTokens += response.usage.completionTokens
        totalTokenUsage.value.totalTokens += response.usage.totalTokens
      }
      
      if (response.conversationId) {
        conversationId.value = response.conversationId
      }
      
      if (response.generationResult) {
        msg.metadata = {
          ...msg.metadata,
          generationResult: response.generationResult,
        }
      }
    }
  }

  /** 处理消息完成 */
  function handleMessageComplete(userMessage: ChatMessage, response: UnifiedChatResponse): void {
    config.value.onMessageReceived?.({
      id: response.id || generateMessageId(),
      role: 'assistant',
      content: response.content,
      status: 'sent',
      createTime: response.createTime ?? Date.now(),
      metadata: response.metadata,
    })
  }

  /** 处理消息错误 */
  function handleMessageError(messageId: string, error: Error): void {
    const msg = messages.value.find(m => m.id === messageId)
    if (msg) {
      msg.status = 'failed'
      msg.isStreaming = false
      msg.error = error.message
      msg.content = msg.content || `发送失败: ${error.message}`
    }
    
    lastError.value = error.message
    config.value.onError?.(error)
    
    ElMessage.error({
      message: error.message || '发送失败，请重试',
      duration: 3000,
    })
  }

  // ========== 生命周期 ==========

  onMounted(() => {
    logger.info('[UnifiedAIChat] Initialized', {
      mode: currentMode.value,
      modelId: currentModelId.value,
      agentId: currentAgentId.value,
    })
  })

  onUnmounted(() => {
    // 清理未完成的请求
    if (currentRequestId.value) {
      unifiedChatService.cancelRequest(currentRequestId.value)
    }
  })

  // ========== 返回 ==========

  return {
    // 配置
    config,
    
    // 状态
    messages,
    currentMode,
    currentModelId,
    currentAgentId,
    isSending,
    isStreaming,
    sessionId,
    conversationId,
    inputContent,
    attachedFiles,
    totalTokenUsage,
    lastError,
    generationType,
    
    // 计算属性
    hasMessages,
    canSend,
    isLoading,
    lastMessage,
    lastUserMessage,
    lastAIMessage,
    userMessageCount,
    aiMessageCount,
    currentModeLabel,
    
    // 操作
    sendMessage,
    retryMessage,
    stopGeneration,
    clearMessages,
    deleteMessage,
    editMessage,
    switchMode,
    switchModel,
    switchAgent,
    setSystemPrompt,
    setGenerationType,
    loadConversation,
    createNewConversation,
    exportConversation,
  }
}

export default useUnifiedAIChat
