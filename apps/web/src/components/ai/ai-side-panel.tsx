'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Sparkles, X, Plus, Cpu } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useChat } from '@/hooks/use-chat'
import { useWebSocket, type WSNotification, isAIResponse } from '@/hooks/use-websocket'
import { MessageList } from '@/components/chat/message-list'
import { MessageInput } from '@/components/chat/message-input'
import { useChatStore, type ChatMessage } from '@/stores/chat'
import { useAiPanelStore } from '@/stores/ai-panel'
import { getConversation, getMessages } from '@/lib/chat-api'

/** 全局 AI docked 侧边面板(对齐旧架构 .ai-side-panel 设计)。
 * - 默认 display:none,由 useAiPanelStore.open 控制
 * - 紧贴 Sidebar 右侧(flex 顺序:Sidebar → AISidePanel → main)
 * - 内嵌 ChatHeader + ModelSelector + MessageList + MessageInput
 * - 右侧 6px 拖拽手柄调整宽度(320-720px)
 * - 当前会话完全由 useChatStore.conversationId 驱动,不再依赖 URL ?conversationId=
 *   (AI 面板是全局 docked 组件,与 Sidebar 同性质,不应影响 URL 与右侧工作区)
 * - 监听 WebSocket ai_response 多端同步
 */
export function AISidePanel() {
  const t = useTranslations('chat')
  const tc = useTranslations('aiChat')
  const tcommon = useTranslations('common')

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
  // 从 store 订阅当前会话(取代原 URL ?conversationId= 同步逻辑)
  const storeConversationId = useChatStore((s) => s.conversationId)

  // 监听 store.conversationId 变化加载历史会话
  // (AI 面板是全局 docked 组件,与 Sidebar 同性质;不再依赖 URL ?conversationId=,
  // 会话 ID 完全由 useChatStore 维护,切换会话由历史项点击 / 新建对话 等动作触发)
  React.useEffect(() => {
    if (!open) return

    let cancelled = false

    async function loadHistory(id: string) {
      setLoadingHistory(true)
      try {
        const [convRes, msgRes] = await Promise.all([getConversation(id), getMessages(id)])
        if (cancelled) return
        if (convRes.success && msgRes.success) {
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

    if (storeConversationId) {
      void loadHistory(storeConversationId)
    } else {
      useChatStore.setState({ messages: [], error: null })
    }

    return () => {
      cancelled = true
    }
  }, [storeConversationId, setConversationId, open])

  const handleNewChat = React.useCallback(() => {
    clearMessages()
    setConversationId(null)
  }, [clearMessages, setConversationId])

  // 全局快捷键 Ctrl+Shift+N:新建对话
  React.useEffect(() => {
    if (!open) return
    const onNewChat = () => handleNewChat()
    window.addEventListener('global-shortcut:new-chat', onNewChat)
    return () => window.removeEventListener('global-shortcut:new-chat', onNewChat)
  }, [handleNewChat, open])

  // 拖拽调整宽度
  // 关闭态下拖拽手柄:先 openPanel 再开始 resize,实现"拖拽即打开"
  const handleResizeStart = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      const store = useAiPanelStore.getState()
      if (!store.open) {
        store.openPanel()
      }
      setResizing(true)
      const startX = e.clientX
      const startWidth = store.width
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

  // 关闭态:仅渲染拖拽手柄(可拖拽打开),不渲染整个面板内容
  if (!open) {
    return (
      <div className="relative my-2 mr-2 shrink-0 z-[calc(var(--z-base)+5)]" style={{ width: 0 }}>
        {/* 右侧拖拽手柄:外层 8px 命中区 right-[-4px] 居中跨越容器右边缘,
          内层 0.5px 线 left-[calc(50%-0.25px)] -translate-x-1/2 居中在命中区中心,与容器右边缘重合。
          关闭态容器 width:0,命中区相对容器右边定位,线居中在容器右边。
          0.5px 线在 2x DPR 高分屏渲染为 1 物理像素;子像素 calc 避免奇数像素容器模糊。
          默认 opacity:0 完全隐藏,仅 hover 或拖拽时显现渐变色。 */}
        <div
          onPointerDown={handleResizeStart}
          className="group absolute right-[-4px] top-3 bottom-3 z-20 w-2 cursor-col-resize"
        >
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={tcommon('resize')}
            className={cn(
              'absolute left-[calc(50%-0.25px)] top-0 bottom-0 w-0.5 -translate-x-1/2 resize-handle-line',
              isResizing && 'is-resizing',
            )}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      // 全局 docked 面板(与 Sidebar 同性质,参与 MainShell 的 flex 布局):
      // - relative 定位在 flex 容器中占据自身宽度,通过 mr-2 与右侧 work-area 形成可见间距
      // - shrink-0 防止被 flex 压缩,宽度由 useAiPanelStore.width 控制(320-720px)
      // - my-2 与 work-area 的 my-2 垂直对齐,顶部/底部留出 8px 间距
      // - z-[calc(var(--z-base)+5)] 高于常规内容层,低于 modal/PWA 提示层
      className="relative my-2 mr-2 shrink-0 z-[calc(var(--z-base)+5)]"
      style={{ width, transition: isResizing ? 'none' : 'width 0.2s cubic-bezier(0.4,0,0.2,1)' }}
    >
      <aside
        aria-label={tc('title')}
        className="flex h-full flex-col overflow-hidden rounded-xl bg-shell-panel"
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
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={closePanel}
            aria-label={tcommon('close')}
            title={tcommon('close')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

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
          model={currentModel}
          onModelChange={setModel}
          modelLabel={t('model')}
        />
      </aside>
      {/* 右侧拖拽手柄:外层 8px 命中区 right-[-4px] 居中跨越 aside 右边缘(左右各 4px),
        内层 0.5px 线 left-[calc(50%-0.25px)] -translate-x-1/2 居中在命中区中心,与 aside 右边缘重合。
        手柄置于 aside 外层(父 div),避免 overflow-hidden 裁剪命中区。
        0.5px 线在 2x DPR 高分屏渲染为 1 物理像素;子像素 calc 避免奇数像素容器模糊。
        默认 opacity:0 完全隐藏,仅 hover 或拖拽时显现渐变色。 */}
      <div
        onPointerDown={handleResizeStart}
        className="group absolute right-[-4px] top-3 bottom-3 z-20 w-2 cursor-col-resize"
      >
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={tcommon('resize')}
          className={cn(
            'absolute left-[calc(50%-0.25px)] top-0 bottom-0 w-0.5 -translate-x-1/2 resize-handle-line',
            isResizing && 'is-resizing',
          )}
        />
      </div>
    </div>
  )
}

export default AISidePanel
