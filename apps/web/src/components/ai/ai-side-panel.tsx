'use client'

/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- 手柄 role="separator" 配合 onPointerDown
   是可拖拽交互元素,但 jsx-a11y 默认把 separator 视为非交互元素,需 Tab 聚焦做无障碍。 */

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { X, Plus } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useChat } from '@/hooks/use-chat'
import { useWebSocket, type WSNotification, isAIResponse } from '@/hooks/use-websocket'
import { MessageList } from '@/components/chat/message-list'
import { MessageInput } from '@/components/chat/message-input'
import { BrandIcon, inferVendor } from '@/components/ai/brand-icon'
import { useChatStore, type ChatMessage } from '@/stores/chat'
import { useAiPanelStore } from '@/stores/ai-panel'
import { getConversation, getMessages } from '@/lib/chat-api'
import { fetchApi } from '@/lib/api'

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
  const [conversationTitle, setConversationTitle] = React.useState<string | null>(null)
  const [workspaceName, setWorkspaceName] = React.useState<string | null>(null)
  const pathname = usePathname()

  // 从 URL 检测当前是否处于 workspace 项目页(/workspace/[id]),并拉取项目名
  // 用于 AI 面板标题显示"项目文件夹名"(用户规则:选择项目文件时显示项目文件夹名)
  React.useEffect(() => {
    if (!pathname) {
      setWorkspaceName(null)
      return
    }
    const m = pathname.match(/^\/workspace\/([^/]+)/)
    if (!m) {
      setWorkspaceName(null)
      return
    }
    const projectId = m[1]!
    let cancelled = false
    void (async () => {
      try {
        const res = await fetchApi<{ project: { id: string; name: string } }>(
          `/api/workspace/projects/${encodeURIComponent(projectId)}`,
        )
        if (cancelled) return
        if (res.success && res.data?.project?.name) {
          setWorkspaceName(res.data.project.name)
        } else {
          setWorkspaceName(null)
        }
      } catch {
        if (!cancelled) setWorkspaceName(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pathname])

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
          setConversationTitle(convRes.data.conversation.title || null)
        } else {
          setConversationId(null)
          useChatStore.setState({ messages: [], error: null })
          setConversationTitle(null)
        }
      } catch {
        if (!cancelled) {
          setConversationId(null)
          useChatStore.setState({ messages: [], error: null })
          setConversationTitle(null)
        }
      } finally {
        if (!cancelled) setLoadingHistory(false)
      }
    }

    if (storeConversationId) {
      void loadHistory(storeConversationId)
    } else {
      useChatStore.setState({ messages: [], error: null })
      setConversationTitle(null)
    }

    return () => {
      cancelled = true
    }
  }, [storeConversationId, setConversationId, open])

  const handleNewChat = React.useCallback(() => {
    clearMessages()
    setConversationId(null)
    setConversationTitle(null)
  }, [clearMessages, setConversationId])

  // 标题显示优先级(用户规则):
  //   1. workspace 项目页 → 显示项目文件夹名(选择项目文件时显示项目文件夹名)
  //   2. 已加载任务 → 显示任务名称(只是单纯对话时显示对话任务命名)
  //   3. 兜底 → 显示"空工作区"(没有选择项目时显示空工作区)
  const displayTitle = workspaceName ?? conversationTitle ?? tc('emptyWorkspace')

  // 全局快捷键 Ctrl+Shift+N:新建任务
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

  // 关闭态:仅渲染拖拽手柄(可拖拽打开),不渲染整个面板内容。
  // 容器 fixed 定位紧贴 Sidebar 右侧(left:var(--sidebar-width) 由 Sidebar 同步到 :root),
  // width:0 使容器自身不占视觉空间;手柄 right-[-12px] 跨越容器右边缘 8px 命中。
  // z-40 高于 work-area 内容层,低于 modal/PWA 提示层(modal/PWA 全部 z-50)。
  if (!open) {
    return (
      <div
        className="fixed top-2 bottom-2 left-[var(--sidebar-width,130px)] z-40"
        style={{ width: 0 }}
      >
        {/* 右侧拖拽手柄(关闭态):命中区 right-[-12px] w-2(8px),完全位于 work-area 一侧
          (容器右边缘 +4px ~ +12px),与 Sidebar 自身手柄(Sidebar 右边缘 -4px ~ +4px)空间错开,
          两个手柄各保留完整 8px 命中区,互不重叠冲突。
          原因:AISidePanel 容器 z-[calc(var(--z-base)+5)]=z-6 创建 stacking context,
          其内手柄 z-20 只在容器内有效,整体低于 Sidebar 手柄(根 context z-20)。
          若关闭态手柄与 Sidebar 手柄位置重合(都跨越 Sidebar 右边缘),会被 Sidebar 手柄完全遮挡,
          "拖拽即打开"失效。空间错开后,关闭态手柄在 work-area 一侧(+4~+12)可正常触发。
          内层 0.5px 线居中在命中区中心(容器右边缘 +8px 处),hover 时显现提示可拖拽打开 AI 面板。
          0.5px 线在 2x DPR 高分屏渲染为 1 物理像素;子像素 calc 避免奇数像素容器模糊。
          默认 opacity:0 完全隐藏,仅 hover 或拖拽时显现渐变色。 */}
        {/* 右侧拖拽手柄(关闭态):separator + onPointerDown = 实际可拖拽手柄,需 Tab 聚焦做无障碍可达性;
          文件顶部已有 eslint-disable 块注释覆盖此规则,此处不再重复行级注释。 */}
        <div
          onPointerDown={handleResizeStart}
          tabIndex={0}
          role="separator"
          aria-orientation="vertical"
          aria-label={tcommon('resize')}
          className="group absolute right-[-12px] top-3 bottom-3 z-20 w-2 cursor-col-resize outline-none"
        >
          <div
            className={cn(
              'absolute left-[calc(50%-0.25px)] top-0 bottom-0 w-0.5 -translate-x-1/2 resize-handle-line',
              isResizing && 'is-resizing',
            )}
          />
          {/* 关闭态 hover 竖向提示:文字从上至下显示"点击或向右拉出AI工作区",
            默认隐藏,hover/focus-within 命中区时与手柄渐变线同步 fade-in + translateX 弹出。
            CSS 类 .ai-panel-handle-tooltip 在 globals.css 中定义。
            pointer-events: none 保证不拦截手柄的点击/拖拽。
            通过 group:focus-within 让键盘 Tab 聚焦 separator 时也显示,实现无障碍可达性。 */}
          <div aria-hidden="true" className="ai-panel-handle-tooltip">
            {tc('handleHint')}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      // 全局 fixed 面板(与 Sidebar 同性质,作为 MainShell 的兄弟节点而非 flex 子元素):
      // - fixed 定位紧贴 Sidebar 右侧(left:var(--sidebar-width) 跟随 Sidebar 折叠/展开/拖拽)
      // - top-2 bottom-2 与 work-area 的 my-2 垂直对齐,顶部/底部留出 8px 间距
      // - mr-2 在可见面板右边缘与 work-area 内容间形成 8px 视觉间距
      // - z-40 高于 work-area 内容层,低于 modal/PWA 提示层(modal/PWA 全部 z-50)
      // - width 由 useAiPanelStore.width 控制(320-720px);不挤压右侧 work-area 宽度
      className="fixed top-2 bottom-2 left-[var(--sidebar-width,130px)] mr-2 z-40"
      style={{ width, transition: isResizing ? 'none' : 'width 0.2s cubic-bezier(0.4,0,0.2,1)' }}
    >
      <aside
        aria-label={tc('title')}
        className="flex h-full flex-col overflow-hidden rounded-xl bg-shell-panel"
      >
        {/* 标题栏 */}
        <header
          className={cn(
            'flex h-14 shrink-0 items-center gap-2 px-3',
            // 2026-07-19 中文 + 图标垂直对齐:主标题 span 视觉居中
            '[&>div>span:first-child]:translate-y-[var(--text-vcenter-offset)]',
          )}
        >
          {/* 图标:使用当前模型对应的厂商图标(替代通用 Sparkles)
              用户规则:这个图标应该显示对应项目图标或者模型图标
              容器去掉背景色,只显示内部图标本体(2026-07-19 用户反馈) */}
          <div className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/80">
            <BrandIcon
              vendor={inferVendor(currentModel)}
              size={18}
              className="text-foreground/80"
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="break-words text-sm font-semibold">{displayTitle}</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <BrandIcon
                vendor={inferVendor(currentModel)}
                size={12}
                className="text-muted-foreground"
              />
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
        tabIndex={0}
        role="separator"
        aria-orientation="vertical"
        aria-label={tcommon('resize')}
        className="group absolute right-[-4px] top-3 bottom-3 z-20 w-2 cursor-col-resize outline-none"
      >
        <div
          className={cn(
            'absolute left-[calc(50%-0.25px)] top-0 bottom-0 w-0.5 -translate-x-1/2 resize-handle-line',
            isResizing && 'is-resizing',
          )}
        />
        {/* 打开态手柄提示:文字"拖拽调整宽度"竖向显示,默认隐藏,
            hover/focus-within 命中区时与手柄渐变线同步 fade-in + translateX 弹出。
            CSS 类 .ai-panel-resize-tooltip 在 globals.css 中定义,定位在面板内(手柄左侧)
            避免遮挡 work-area。pointer-events: none 不拦截手柄的点击/拖拽。 */}
        <div aria-hidden="true" className="ai-panel-resize-tooltip">
          {tc('resizeHandleHint')}
        </div>
      </div>
    </div>
  )
}

export default AISidePanel
