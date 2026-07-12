'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { useChat } from '@/hooks/use-chat'
import { useWebSocket, type WSNotification, isAIResponse } from '@/hooks/use-websocket'
import { MessageList } from '@/components/chat/message-list'
import { MessageInput } from '@/components/chat/message-input'
import { ModelSelector } from '@/components/chat/model-selector'
import { ChatHeader } from '@/components/chat/chat-header'
import { useChatStore, type ChatMessage } from '@/stores/chat'
import { getConversation, getMessages } from '@/lib/chat-api'
import { ErrorBoundary, Loading } from '@/components/common'

function ChatContent() {
  const t = useTranslations('chat')
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlConversationId = searchParams.get('conversationId')

  const { messages, currentModel, isStreaming, sendMessage, stop, clearMessages, setModel } =
    useChat()

  // 接入 WebSocket 通知通道,监听 ai_response / chat_message 等实时推送
  // ai_response: 后端 callback worker 持久化 assistant 消息后推送,用于多端同步
  const { lastMessage } = useWebSocket()
  const lastWsRef = React.useRef<WSNotification | null>(null)

  React.useEffect(() => {
    if (!lastMessage || lastMessage === lastWsRef.current) return
    lastWsRef.current = lastMessage
    // 类型守卫确保是 ai_response 推送(编译期捕获字段名漂移)
    if (!isAIResponse(lastMessage)) return
    const { conversationId, message, clientMessageId } = lastMessage.data
    // 仅处理当前会话的通知
    const currentConv = useChatStore.getState().conversationId
    if (conversationId && currentConv && conversationId !== currentConv) return

    if (message) {
      // 服务端持久化的 assistant 消息推送过来
      // clientMessageId 是前端占位消息 ID(非 DB ID),用它匹配本地占位消息
      const store = useChatStore.getState()
      const placeholderId = clientMessageId ?? message.id
      const existing = store.messages.find((m) => m.id === placeholderId)
      if (existing) {
        // 替换本地占位消息:用服务端 DB id 替换前端 UUID + 更新内容
        useChatStore.setState({
          messages: store.messages.map((m) =>
            m.id === placeholderId
              ? {
                  id: message.id, // 替换为 DB 真实 ID
                  role: 'assistant' as const,
                  content: message.content,
                  createdAt: message.createdAt
                    ? new Date(message.createdAt).getTime()
                    : m.createdAt,
                  error: false,
                }
              : m,
          ),
        })
      } else if (message.role === 'assistant') {
        // 新消息(多设备同步场景:其他设备发的对话,本机收到 AI 回复)
        useChatStore.setState({
          messages: [
            ...store.messages,
            {
              id: message.id,
              role: 'assistant' as const,
              content: message.content,
              createdAt: message.createdAt ? new Date(message.createdAt).getTime() : Date.now(),
            },
          ],
        })
      }
    }
  }, [lastMessage])

  const setConversationId = useChatStore((s) => s.setConversationId)
  const [loadingHistory, setLoadingHistory] = React.useState(false)

  // 监听 URL conversationId 变化，加载历史会话或重置为新会话
  React.useEffect(() => {
    // 若 store 已同步到同一 conversationId（例如 use-chat 刚创建并 setConversationId），
    // 跳过加载，避免覆盖正在写入的消息
    if (urlConversationId === useChatStore.getState().conversationId) return

    let cancelled = false

    async function loadHistory(id: string) {
      setLoadingHistory(true)
      try {
        const [convRes, msgRes] = await Promise.all([getConversation(id), getMessages(id)])
        if (cancelled) return
        if (convRes.success && msgRes.success) {
          setConversationId(id)
          const hydrated: ChatMessage[] = msgRes.data.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: new Date(m.createdAt).getTime(),
          }))
          useChatStore.setState({ messages: hydrated, error: null })
        } else {
          // 加载失败：回退到新会话状态
          setConversationId(null)
          useChatStore.setState({ messages: [], error: null })
        }
      } catch {
        if (!cancelled) {
          setConversationId(null)
          useChatStore.setState({ messages: [], error: null })
        }
      } finally {
        if (!cancelled) setLoadingHistory(false)
      }
    }

    if (urlConversationId) {
      void loadHistory(urlConversationId)
    } else {
      // 无 conversationId：立即清空（不等待任何 API）
      setConversationId(null)
      useChatStore.setState({ messages: [], error: null })
    }

    return () => {
      cancelled = true
    }
  }, [urlConversationId, setConversationId])

  const hasMessages = messages.length > 0

  // 新建对话：立即清空 + 解绑 conversationId + 清除 URL 参数
  const handleNewChat = React.useCallback(() => {
    clearMessages()
    setConversationId(null)
    router.replace('/chat', { scroll: false })
  }, [clearMessages, setConversationId, router])

  return (
    // 抵消 main 容器的 padding，使聊天占满 header 以下的全高
    <div className="-m-4 flex h-[calc(100dvh-3.5rem)] flex-col md:-m-6 lg:-m-8">
      <ChatHeader
        currentModel={currentModel}
        onClear={handleNewChat}
        hasMessages={hasMessages}
        isStreaming={isStreaming}
        title={t('title')}
        clearLabel={t('clear')}
        clearConfirm={t('clearConfirm')}
        historyLabel={t('history')}
      />

      {/* 工具栏：模型选择 */}
      <div className="flex items-center gap-2 border-b bg-background/50 px-4 py-2">
        <ModelSelector
          value={currentModel}
          onChange={setModel}
          disabled={isStreaming}
          label={t('model')}
        />
      </div>

      {/* 消息区 */}
      <div className="min-h-0 flex-1">
        <MessageList
          messages={messages}
          isStreaming={isStreaming}
          isLoading={loadingHistory}
          emptyTitle={t('empty')}
          emptyHint={t('emptyHint')}
          assistantLabel={t('assistant')}
          loadingLabel={t('loading')}
          onTemplateSelect={(content) => {
            // 模板内容填入输入框（通过 useChat 的 setInput）
            useChatStore.setState({ draftInput: content })
          }}
        />
      </div>

      {/* 输入区 */}
      <MessageInput
        onSend={sendMessage}
        onStop={stop}
        isStreaming={isStreaming}
        placeholder={t('placeholder')}
        sendLabel={t('send')}
        stopLabel={t('stop')}
      />
    </div>
  )
}

export default function ChatPage() {
  // Next.js 15 要求 useSearchParams 必须被 Suspense 包裹
  return (
    <ErrorBoundary>
      <React.Suspense
        fallback={
          <div className="flex h-[calc(100dvh-3.5rem)] items-center justify-center">
            <Loading />
          </div>
        }
      >
        <ChatContent />
      </React.Suspense>
    </ErrorBoundary>
  )
}
