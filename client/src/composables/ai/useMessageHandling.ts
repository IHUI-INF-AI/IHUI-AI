import { ref, computed } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { logger } from '@/utils/logger'
import { ClipboardManager } from '@/utils/clipboard'
import type { ChatMessage } from '@/types/ai-platform.types'

export interface UseMessageHandlingOptions {
  onMessageEdit?: (messageId: string, newContent: string) => void
  onMessageDelete?: (messageId: string) => void
  onMessageReply?: (message: ChatMessage) => void
}

export function useMessageHandling(options: UseMessageHandlingOptions = {}) {
  const selectedMessageId = ref<string | null>(null)
  const editingMessageId = ref<string | null>(null)
  const editContent = ref('')
  const quotedMessage = ref<ChatMessage | null>(null)
  const thinkingVisibleMap = ref<Map<string, boolean>>(new Map())

  const isEditing = computed(() => editingMessageId.value !== null)
  const isQuoting = computed(() => quotedMessage.value !== null)

  function selectMessage(messageId: string | null): void {
    selectedMessageId.value = messageId
  }

  function startEdit(message: ChatMessage): void {
    editingMessageId.value = message.id
    editContent.value = message.content
  }

  function cancelEdit(): void {
    editingMessageId.value = null
    editContent.value = ''
  }

  function saveEdit(messageId: string): void {
    if (editContent.value.trim()) {
      options.onMessageEdit?.(messageId, editContent.value.trim())
    }
    cancelEdit()
  }

  function deleteMessage(messageId: string): void {
    options.onMessageDelete?.(messageId)
  }

  function replyToMessage(message: ChatMessage): void {
    quotedMessage.value = message
    options.onMessageReply?.(message)
  }

  function cancelReply(): void {
    quotedMessage.value = null
  }

  async function copyMessage(message: ChatMessage): Promise<void> {
    try {
      await ClipboardManager.copy(message.content)
      logger.info('[useMessageHandling] Message already copied')
    } catch (error) {
      logger.error('[useMessageHandling] Failed to copy message:', error)
    }
  }

  function formatMessage(content: string): string {
    try {
      const html = marked.parse(content) as string
      return DOMPurify.sanitize(html)
    } catch {
      return DOMPurify.sanitize(content)
    }
  }

  function toggleThinkingVisibility(messageId: string): void {
    const current = thinkingVisibleMap.value.get(messageId) ?? false
    thinkingVisibleMap.value.set(messageId, !current)
  }

  function isThinkingVisible(messageId: string): boolean {
    return thinkingVisibleMap.value.get(messageId) ?? false
  }

  function getAssistantDisplayContent(message: ChatMessage): string {
    if (message.metadata?.content) {
      return message.metadata.content as string
    }
    return message.content
  }

  function getAssistantThinkingContent(message: ChatMessage): string | null {
    if (message.metadata?.thinking) {
      return message.metadata.thinking as string
    }
    if (message.metadata?.reasoning_content) {
      return message.metadata.reasoning_content as string
    }
    return null
  }

  function getAssistantImages(message: ChatMessage): string[] {
    const images: string[] = []
    if (message.metadata?.images) {
      images.push(...(message.metadata.images as string[]))
    }
    if (message.metadata?.image_url) {
      const url = message.metadata.image_url
      if (typeof url === 'string') {
        images.push(url)
      } else if (Array.isArray(url)) {
        images.push(...url)
      }
    }
    if (message.metadata?.image_urls) {
      images.push(...(message.metadata.image_urls as string[]))
    }
    return images
  }

  function getAssistantVideos(message: ChatMessage): string[] {
    const videos: string[] = []
    if (message.metadata?.videoUrl) {
      videos.push(message.metadata.videoUrl as string)
    }
    if (message.metadata?.video_url) {
      videos.push(message.metadata.video_url as string)
    }
    if (message.metadata?.video_urls) {
      videos.push(...(message.metadata.video_urls as string[]))
    }
    return videos
  }

  function getAssistantContentVisible(message: ChatMessage): boolean {
    return message.metadata?.contentVisible !== false
  }

  function toggleAssistantContentVisibility(message: ChatMessage): void {
    if (message.metadata) {
      message.metadata.contentVisible = !getAssistantContentVisible(message)
    }
  }

  return {
    selectedMessageId,
    editingMessageId,
    editContent,
    quotedMessage,
    isEditing,
    isQuoting,
    selectMessage,
    startEdit,
    cancelEdit,
    saveEdit,
    deleteMessage,
    replyToMessage,
    cancelReply,
    copyMessage,
    formatMessage,
    toggleThinkingVisibility,
    isThinkingVisible,
    getAssistantDisplayContent,
    getAssistantThinkingContent,
    getAssistantImages,
    getAssistantVideos,
    getAssistantContentVisible,
    toggleAssistantContentVisibility,
  }
}

export default useMessageHandling
