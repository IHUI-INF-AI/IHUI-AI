import { ref, computed, type Ref } from 'vue'
import type { ChatMessage } from '@/types/ai-platform.types'
import type { Model } from '@/types/api'

/** 本地会话历史项类型 */
export interface ConversationItem {
  id: string
  title: string
  messages: ChatMessage[]
  createTime: string
}

/** 大模型模式会话历史项类型（含后端 chatId） */
export interface ModelChatItem extends ConversationItem {
  _chatId?: string | number
}

/** AI 模式类型（与 AIChat.vue 的 currentAIMode 保持一致） */
type AIMode = 'model' | 'agent' | 'agentic' | 'mcp' | 'hybrid' | 'auto' | 'generation'

/** useChatHistory 依赖的外部上下文 */
interface UseChatHistoryOptions {
  /** 当前 AI 模式（用于决定展示哪个历史列表） */
  currentAIMode: Ref<AIMode>
  /** 当前选中的模型（大模型模式下按模型拉取历史） */
  selectedModel: Ref<Model | null>
}

/**
 * 聊天历史 composable
 *
 * 从 AIChat.vue 抽取的会话历史相关状态：
 * - conversationHistory: 本地/openclaw 会话历史
 * - modelChatHistory: 大模型模式下的历史（来自 chatHistory.service）
 * - modelChatHistoryLoading: 大模型历史加载中
 * - currentConversationId: 当前会话 ID
 * - displayedConversationHistory: 当前展示的历史列表（根据模式自动切换）
 *
 * 注意：历史加载/选择/删除等方法因与 AIChat.vue 其他逻辑深度耦合，保留在 AIChat.vue 中。
 */
export function useChatHistory(options: UseChatHistoryOptions) {
  const { currentAIMode, selectedModel } = options

  const conversationHistory = ref<ConversationItem[]>([])
  /** 大模型模式下的历史对话（来自 chatHistory.service，按 model_name 查询） */
  const modelChatHistory = ref<ModelChatItem[]>([])
  const modelChatHistoryLoading = ref(false)
  const currentConversationId = ref<string | null>(null)

  /** 当前展示的历史列表：大模型模式下按所选模型拉取 chatHistory.service 的对话，否则用本地/openclaw 历史 */
  const displayedConversationHistory = computed(() => {
    if (currentAIMode.value === 'model' && selectedModel.value) {
      return modelChatHistory.value
    }
    return conversationHistory.value
  })

  return {
    conversationHistory,
    modelChatHistory,
    modelChatHistoryLoading,
    currentConversationId,
    displayedConversationHistory,
  }
}
