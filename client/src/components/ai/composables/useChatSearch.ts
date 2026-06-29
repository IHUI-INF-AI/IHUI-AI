import { ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ChatMessage } from '@/types/ai-platform.types'

/** 搜索结果项 */
export interface SearchResult {
  id: string
  preview: string
  createTime: string
}

/** useChatSearch 依赖的外部上下文 */
interface UseChatSearchOptions {
  /** 消息列表（用于搜索过滤） */
  messages: Ref<ChatMessage[]>
  /** 消息元素引用 Map（用于滚动定位） */
  messageRefs: Ref<Map<string, HTMLElement>>
  /** 消息容器引用（用于判断可见性） */
  messagesContainerRef: Ref<HTMLElement | null>
  /** 警告提示函数 */
  showWarning: (msg: string) => void
}

/**
 * 聊天搜索逻辑 composable
 *
 * 从 AIChat.vue 抽取的搜索栏相关状态与方法：
 * - showSearchBar: 搜索栏显示/隐藏
 * - searchQuery: 搜索关键词
 * - searchResults: 搜索结果列表
 * - selectedMessageId: 当前选中的消息 ID（滚动定位高亮）
 * - toggleSearch: 切换搜索栏显示
 * - handleSearch: 执行搜索
 * - scrollToMessage: 滚动到指定消息
 */
export function useChatSearch(options: UseChatSearchOptions) {
  const { messages, messageRefs, messagesContainerRef, showWarning } = options
  const { t } = useI18n()

  const showSearchBar = ref(false)
  const searchQuery = ref('')
  const searchResults = ref<SearchResult[]>([])
  const selectedMessageId = ref<string | null>(null)

  /** 切换搜索栏显示状态：关闭时清空关键词与结果 */
  const toggleSearch = () => {
    showSearchBar.value = !showSearchBar.value
    if (!showSearchBar.value) {
      searchQuery.value = ''
      searchResults.value = []
    }
  }

  /** 执行搜索：按关键词过滤消息内容，生成预览（前 100 字符） */
  const handleSearch = () => {
    if (!searchQuery.value) {
      searchResults.value = []
      return
    }
    const query = searchQuery.value.toLowerCase()
    searchResults.value = messages.value
      .filter((msg) => msg.content.toLowerCase().includes(query))
      .map((msg) => ({
        id: msg.id,
        preview: msg.content.substring(0, 100),
        createTime: String(msg.createTime),
      }))
  }

  /** 滚动到指定消息：平滑滚动到消息中心，高亮 2 秒后取消 */
  const scrollToMessage = (messageId: string) => {
    if (!messageId) return

    const element = messageRefs.value.get(messageId)
    if (element && messagesContainerRef.value) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      selectedMessageId.value = messageId
      setTimeout(() => {
        selectedMessageId.value = null
      }, 2000)
    } else {
      showWarning(t('floatingChat.messageNotFound'))
    }
  }

  return {
    showSearchBar,
    searchQuery,
    searchResults,
    selectedMessageId,
    toggleSearch,
    handleSearch,
    scrollToMessage,
  }
}
