import { ref, computed, onMounted, onUnmounted } from 'vue'
import { StorageManager } from '@/utils/storage'
import {
  getConversations,
  createConversation as _createConversation,
  updateConversationTitle as _updateConversationTitle,
  deleteConversation,
  getConversationMessages,
} from '@/api/chat/chat-history'
import {
  queryChatRecords,
  getChatHistoryMessages as _getChatHistoryMessages,
  deleteChatRecord as _deleteChatRecord,
  createChatRecord as _createChatRecord,
  type ChatRecord,
} from '@/api/services/chatHistory.service'
import { logger } from '@/utils/logger'
import type { ChatMessage } from '@/types/ai-platform.types'

export interface ConversationSession {
  id: string
  title: string
  messages: ChatMessage[]
  createTime: string
  _chatId?: string | number
}

export interface UseChatSessionOptions {
  maxHistoryMessages?: number
  autoSave?: boolean
  storageKey?: string
}

export function useChatSession(options: UseChatSessionOptions = {}) {
  const {
    maxHistoryMessages = 100,
    autoSave = true,
    storageKey = 'floating-chat-messages',
  } = options

  const messages = ref<ChatMessage[]>([])
  const currentConversationId = ref<string | null>(null)
  const conversationHistory = ref<ConversationSession[]>([])
  const modelChatHistory = ref<ConversationSession[]>([])
  const modelChatHistoryLoading = ref(false)
  const unreadCount = ref(0)

  const hasMessages = computed(() => messages.value.length > 0)
  const messageCount = computed(() => messages.value.length)

  function loadFromStorage(): void {
    const stored = StorageManager.getItem<ChatMessage[]>(storageKey)
    if (stored && stored.length > 0) {
      messages.value = stored
    }
  }

  function saveToStorage(): void {
    if (autoSave) {
      StorageManager.setItem(storageKey, messages.value)
    }
  }

  function addMessage(message: ChatMessage): void {
    messages.value.push(message)
    if (messages.value.length > maxHistoryMessages) {
      messages.value = messages.value.slice(-maxHistoryMessages)
    }
    saveToStorage()
  }

  function updateMessage(messageId: string, updates: Partial<ChatMessage>): void {
    const index = messages.value.findIndex(m => m.id === messageId)
    if (index !== -1) {
      messages.value[index] = { ...messages.value[index], ...updates }
      saveToStorage()
    }
  }

  function deleteMessage(messageId: string): void {
    const index = messages.value.findIndex(m => m.id === messageId)
    if (index !== -1) {
      messages.value.splice(index, 1)
      saveToStorage()
    }
  }

  function clearMessages(): void {
    messages.value = []
    currentConversationId.value = null
    saveToStorage()
  }

  async function loadConversationHistory(modelName?: string): Promise<void> {
    if (modelChatHistoryLoading.value) return
    modelChatHistoryLoading.value = true

    try {
      if (modelName) {
        const response = await queryChatRecords({ model_name: modelName, page: 1, size: 50 })
        const records = extractRecords(response)
        modelChatHistory.value = records.map(record => ({
          id: String(record.id || record.chatId),
          title: record.title || record.question?.slice(0, 50) || 'Untitled conversation',
          messages: [],
          createTime: record.createTime || record.createdAt || new Date().toISOString(),
          _chatId: record.id || record.chatId,
        }))
      } else {
        const response = await getConversations({ page: 1, pageSize: 50 })
        conversationHistory.value = (response.data?.conversations || []).map((conv: { id: string; title?: string; createTime?: string; createdAt?: string }) => ({
          id: conv.id,
          title: conv.title || 'Untitled conversation',
          messages: [],
          createTime: conv.createTime || conv.createdAt || new Date().toISOString(),
        }))
      }
    } catch (error) {
      logger.error('[useChatSession] Failed to load chat history:', error)
    } finally {
      modelChatHistoryLoading.value = false
    }
  }

  function extractRecords(response: any): ChatRecord[] {
    if (!response) return []
    const resp = response as { data?: ChatRecord[] | { list?: ChatRecord[] }; list?: ChatRecord[] }
    if (Array.isArray(resp.data)) return resp.data
    if (resp.data?.list) return resp.data.list
    if (resp.list) return resp.list
    return []
  }

  async function selectConversation(conversationId: string): Promise<void> {
    currentConversationId.value = conversationId
    try {
      const response = await getConversationMessages(conversationId, { limit: maxHistoryMessages })
      if (response.data?.messages) {
        messages.value = response.data.messages.map((msg: { id?: string; role?: string; content?: string; createTime?: string }) => ({
          id: msg.id || `msg-${Date.now()}`,
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content || '',
          createTime: msg.createTime || new Date().toISOString(),
          status: 'sent' as const,
        }))
        saveToStorage()
      }
    } catch (error) {
      logger.error('[useChatSession] Failed to load chat messages:', error)
    }
  }

  async function deleteConversationFromHistory(conversationId: string): Promise<void> {
    try {
      await deleteConversation(conversationId)
      conversationHistory.value = conversationHistory.value.filter(c => c.id !== conversationId)
      modelChatHistory.value = modelChatHistory.value.filter(c => c.id !== conversationId)
      if (currentConversationId.value === conversationId) {
        clearMessages()
      }
    } catch (error) {
      logger.error('[useChatSession] Failed to delete chat:', error)
      throw error
    }
  }

  onMounted(() => {
    loadFromStorage()
  })

  onUnmounted(() => {
    saveToStorage()
  })

  return {
    messages,
    currentConversationId,
    conversationHistory,
    modelChatHistory,
    modelChatHistoryLoading,
    unreadCount,
    hasMessages,
    messageCount,
    addMessage,
    updateMessage,
    deleteMessage,
    clearMessages,
    loadConversationHistory,
    selectConversation,
    deleteConversationFromHistory,
    loadFromStorage,
    saveToStorage,
  }
}

export default useChatSession
