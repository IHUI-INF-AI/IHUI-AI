'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { streamChat, formatSSEError } from '@ihui/api-client'

import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import { useLoginDialogStore } from '@/stores/login-dialog'
import { createConversation, sendMessage as persistMessage } from '@/lib/chat-api'
import { logger } from '@/lib/logger'

export interface UseChatReturn {
  messages: ReturnType<typeof useChatStore.getState>['messages']
  currentModel: string
  isStreaming: boolean
  error: string | null
  sendMessage: (content: string) => Promise<void>
  stop: () => void
  clearMessages: () => void
  setModel: (model: string) => void
}

/** 后台持久化消息，失败仅打日志，不阻塞流式体验 */
async function persistMessageSafe(
  conversationId: string,
  content: string,
  role: 'user' | 'assistant',
) {
  const res = await persistMessage(conversationId, content, role)
  if (!res.success) {
    logger.error(`[chat] persist ${role} message failed:`, res.error)
    // 用户可见提示(非阻塞 toast),让用户知道消息未保存到服务端
    toast.error('消息保存失败', {
      description: res.error || '网络异常,本次对话未被服务端记录',
    })
  }
}

export function useChat(): UseChatReturn {
  const messages = useChatStore((s) => s.messages)
  const currentModel = useChatStore((s) => s.currentModel)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const error = useChatStore((s) => s.error)

  const router = useRouter()
  const abortRef = React.useRef<AbortController | null>(null)

  const sendMessage = React.useCallback(
    async (content: string) => {
      const text = content.trim()
      if (!text) return

      const store = useChatStore.getState()
      if (store.isStreaming) return

      const model = store.currentModel

      // 1. 若无 conversationId，先创建会话并同步 URL
      let conversationId = store.conversationId
      if (!conversationId) {
        const createRes = await createConversation({ model })
        if (!createRes.success) {
          store.setError(createRes.error)
          return
        }
        conversationId = createRes.data.conversation.id
        store.setConversationId(conversationId)
        const sp = new URLSearchParams(window.location.search)
        sp.set('conversationId', conversationId)
        router.replace(`/chat?${sp.toString()}`, { scroll: false })
      }

      // 2. 持久化用户消息(后台 fire-and-forget,不阻塞流式响应)
      void persistMessageSafe(conversationId, text, 'user')

      const history = store.messages
        .filter((m) => !m.error && (m.role === 'user' || m.role === 'assistant') && m.content)
        .map((m) => ({ role: m.role, content: m.content }))

      store.addMessage({ role: 'user', content: text, model })
      const assistantId = store.addMessage({ role: 'assistant', content: '', model })

      store.setStreaming(true)
      store.setError(null)

      const controller = new AbortController()
      abortRef.current = controller

      // 首 token 超时:15s 内未收到任何内容则中止
      let firstTokenReceived = false
      const timeoutId = setTimeout(() => {
        if (!firstTokenReceived) {
          controller.abort()
        }
      }, 15000)

      // 从 auth store 获取 userId(用于回调链路关联)
      const userId = useAuthStore.getState().user?.id ?? ''

      try {
        await streamChat({
          model,
          messages: [...history, { role: 'user', content: text }],
          signal: controller.signal,
          metadata: {
            conversationId,
            userId,
            messageId: assistantId,
          },
          onDelta: (delta) => {
            firstTokenReceived = true
            useChatStore.getState().appendToMessage(assistantId, delta)
          },
          onReasoning: (delta) => {
            useChatStore.getState().appendReasoningToMessage(assistantId, delta)
          },
          onError: (errMsg) => {
            const formatted = formatSSEError(errMsg)
            useChatStore.getState().setMessageError(assistantId, formatted.message)
            useChatStore.getState().setError(formatted.message)
            if (formatted.severity === 'auth') {
              useLoginDialogStore.getState().open('login')
            }
            const toastDesc =
              formatted.severity === 'auth' ? formatted.message : formatted.rawMessage
            if (formatted.severity === 'ratelimit') {
              toast.warning(formatted.title, { description: toastDesc })
            } else {
              toast.error(formatted.title, { description: toastDesc })
            }
          },
        })
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          if (!firstTokenReceived) {
            const formatted = formatSSEError(err, 'AI 响应超时(15 秒内未收到任何内容),请稍后重试')
            useChatStore.getState().setMessageError(assistantId, formatted.message)
            useChatStore.getState().setError(formatted.message)
          }
        } else {
          const formatted = formatSSEError(err)
          useChatStore.getState().setMessageError(assistantId, formatted.message)
          useChatStore.getState().setError(formatted.message)
          if (formatted.severity === 'auth') {
            useLoginDialogStore.getState().open('login')
          }
          if (formatted.severity === 'ratelimit') {
            toast.warning(formatted.title, { description: formatted.message })
          } else if (formatted.severity === 'network') {
            toast.error(formatted.title, { description: formatted.message })
          } else {
            toast.error(formatted.title, { description: formatted.rawMessage })
          }
        }
      } finally {
        clearTimeout(timeoutId)
        abortRef.current = null
        useChatStore.getState().setStreaming(false)
      }
    },
    [router],
  )

  const stop = React.useCallback(() => {
    abortRef.current?.abort()
  }, [])

  // 组件卸载时中止进行中的流式请求,避免后台僵尸请求
  React.useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const clearMessages = useChatStore((s) => s.clearMessages)
  const setModel = useChatStore((s) => s.setModel)

  return {
    messages,
    currentModel,
    isStreaming,
    error,
    sendMessage,
    stop,
    clearMessages,
    setModel,
  }
}
