'use client'

import * as React from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Sparkles, X, Plus, Cpu } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useChat } from '@/hooks/use-chat'
import { useWebSocket, type WSNotification, isAIResponse } from '@/hooks/use-websocket'
import { MessageList } from '@/components/chat/message-list'
import { MessageInput } from '@/components/chat/message-input'
import { ModelSelector } from '@/components/chat/model-selector'
import { useChatStore, type ChatMessage } from '@/stores/chat'
import { useAiPanelStore } from '@/stores/ai-panel'
import { getConversation, getMessages } from '@/lib/chat-api'

/** 全局 AI docked 侧边面板(对齐旧架构 .ai-side-panel 设计)。
 * - 默认 display:none,由 useAiPanelStore.open 控制
 * - 紧贴 Sidebar 右侧(flex 顺序:Sidebar → AISidePanel → main)
 * - 内嵌 ChatHeader + ModelSelector + MessageList + MessageInput
 * - 右侧 6px 拖拽手柄调整宽度(320-720px)
 * - 监听 URL conversationId 自动加载历史
 * - 监听 WebSocket ai_response 多端同步
 */
export function AISidePanel() {
  const t = useTranslations('chat')
  const tc = useTranslations('aiChat')
  const tcommon = useTranslations('common')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlConversationId = searchParams.get('conversationId')

  const { open, width, isResizing, closePanel, setWidth, setResizing } = useAiPanelStore()
  const { messages, currentModel, isStreaming, sendMessage, stop, clearMessages, setModel } =
    useChat()

  const { lastMessage } = useWebSocket()
  const lastWsRef = React.useRef<WSNotification | null>(null)
  const [loadingHistory, setLoadingHistory] = React.useState(false)

  // WebSocket ai_response 多端同步
  React.useEffect(() => {
    if (!lastMessage || lastMessage === lastWsRef.current) return
    lastWsRef.current = lastMessage
    if (!isAIResponse(lastMessage)) return
    const { conversationId, message, clientMessageId } = lastMessage.data
    const currentConv = useChatStore.getState().conversationId
    if (conversationId && currentConv && conversationId !== currentConv) return

    if (message) {
      const store = useChatStore.getState()
      const placeholderId = clientMessageId ?? message.id
      const existing = store.messages.find((m) => m.id === placeholderId)
      if (existing) {
        useChatStore.setState({
          messages: store.messages.map((m) =>
            m.id === placeholderId
              ? {
                  id: message.id,
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

  // 监听 URL conversationId 变化加载历史会话
  React.useEffect(() => {
    if (!open) return
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
      setConversationId(null)
      useChatStore.setState({ messages: [], error: null })
    }

    return () => {
      cancelled = true
    }
  }, [urlConversationId, setConversationId, open])

  const handleNewChat = React.useCallback(() => {
    clearMessages()
    setConversationId(null)
    // 仅当当前在 /chat 路由时清除 URL(避免影响其他路由)
    if (pathname?.startsWith('/chat')) {
      router.replace('/chat', { scroll: false })
    }
  }, [clearMessages, setConversationId, router, pathname])

  // 全局快捷键 Ctrl+Shift+N:新建对话
  React.useEffect(() => {
    if (!open) return
    const onNewChat = () => handleNewChat()
    window.addEventListener('global-shortcut:new-chat', onNewChat)
    return () => window.removeEventListener('global-shortcut:new-chat', onNewChat)
  }, [handleNewChat, open])

  // 拖拽调整宽度
  const handleResizeStart = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      setResizing(true)
      const startX = e.clientX
      const startWidth = useAiPanelStore.getState().width
      const onMove = (ev: PointerEvent) => {
        const delta = ev.clientX - startX
        setWidth(startWidth + delta)
      }
      const onUp = () => {
        setResizing(false)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [setResizing, setWidth],
  )

  if (!open) return null

  return (
    <aside
      aria-label={tc('title')}
      style={{ width, transition: isResizing ? 'none' : 'width 0.2s cubic-bezier(0.4,0,0.2,1)' }}
      className="relative z-[calc(var(--z-base)+5)] flex shrink-0 flex-col my-2 ml-2 overflow-hidden rounded-xl bg-shell-panel"
    >
      {/* 标题栏 */}
      <header className="flex h-14 shrink-0 items-center gap-2 px-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="break-words text-sm font-semibold">{tc('title')}</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Cpu className="h-3 w-3" />
            <span className="break-words">{currentModel}</span>
            {isStreaming && (
              <span className="ml-1 inline-flex items-center gap-1 text-primary">
                <span className="h-1.5 w-1.5 animate-pulse rounded-sm bg-primary" />
                {t('generating')}
              </span>
            )}
          </span>
        </div>
        <button
          type="button"
          onClick={handleNewChat}
          disabled={isStreaming}
          aria-label={tc('newConversation')}
          title={tc('newConversation')}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={closePanel}
          aria-label={tcommon('close')}
          title={tcommon('close')}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {/* 工具栏:模型选择 */}
      <div className="flex items-center gap-2 px-3 py-2">
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

      {/* 右侧拖拽手柄 */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={tcommon('resize')}
        onPointerDown={handleResizeStart}
        className={cn(
          'absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize',
          'before:absolute before:left-1/2 before:top-0 before:h-full before:w-px before:-translate-x-1/2 before:bg-transparent before:transition-colors before:content-[""]',
          'hover:before:bg-primary',
          isResizing && 'before:bg-primary',
        )}
      />
    </aside>
  )
}

export default AISidePanel
