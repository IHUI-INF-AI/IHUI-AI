'use client'

import * as React from 'react'

import { useChatStore, type ChatMessage } from '@/stores/chat'

export interface UseGlobalChatReturn {
  open: boolean
  messages: ChatMessage[]
  conversationId: string | null
  isStreaming: boolean
  openChat: (conversationId?: string) => void
  closeChat: () => void
  toggleChat: () => void
  clear: () => void
}

/** 全局聊天 Hook，管理悬浮聊天面板的开关与当前会话 */
export function useGlobalChat(): UseGlobalChatReturn {
  const messages = useChatStore((s) => s.messages)
  const conversationId = useChatStore((s) => s.conversationId)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const setConversationId = useChatStore((s) => s.setConversationId)
  const clearMessages = useChatStore((s) => s.clearMessages)

  const [open, setOpen] = React.useState(false)

  const openChat = React.useCallback(
    (convId?: string) => {
      if (convId) setConversationId(convId)
      setOpen(true)
    },
    [setConversationId],
  )

  const closeChat = React.useCallback(() => setOpen(false), [])
  const toggleChat = React.useCallback(() => setOpen((o) => !o), [])
  const clear = React.useCallback(() => {
    clearMessages()
    setConversationId(null)
  }, [clearMessages, setConversationId])

  return {
    open,
    messages,
    conversationId,
    isStreaming,
    openChat,
    closeChat,
    toggleChat,
    clear,
  }
}
