'use client'

/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- 手柄 role="separator" 配合 onPointerDown
   是可拖拽交互元素,但 jsx-a11y 默认把 separator 视为非交互元素,需 Tab 聚焦做无障碍。 */

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { X, Plus, Minus, Pin, PanelLeft, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { useChat } from '@/hooks/use-chat'
import {
  useWebSocket,
  type WSNotification,
  isAIResponse,
  isAIQuestion,
  isAIQuestionAnswered,
} from '@/hooks/use-websocket'
import { MessageList } from '@/components/chat/message-list'
import { MessageInput } from '@/components/chat/message-input'
import { AgentTaskProgressPane } from '@/components/ai/agent-task-progress-pane'
import { QuestionDialog } from '@/components/chat/question-dialog'
import { BrandIcon, inferVendor } from '@/components/ai/brand-icon'
import { WorkspaceSelector } from '@/components/ai/workspace-selector'
import { Tooltip } from '@/components/feedback'
import { WorkspacePermissionDialog } from '@/components/workspace/workspace-permission-dialog'
import { useChatStore, type ChatMessage } from '@/stores/chat'
import { useAiPanelStore } from '@/stores/ai-panel'
import { useModeStore } from '@/stores/mode'
import { useLoginDialogStore } from '@/stores/login-dialog'
import { getConversation, getMessages } from '@ihui/api-client'
import type { ChatMode } from '@ihui/types'
import { parsePendingQuestion } from '@/lib/pending-question'
import { fetchApi } from '@/lib/api'
import { useIsMobile } from '@/hooks/use-media-query'

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

  // 性能修复(2026-07-25):全解构 → 单字段 selector。
  // zustand action 函数引用稳定,不会触发重渲染;state 字段(open/width/isResizing)
  // 只在对应字段变化时触发本组件重渲染,activeWorkspace 变化不再让本组件重渲染。
  const open = useAiPanelStore((s) => s.open)
  const width = useAiPanelStore((s) => s.width)
  const isResizing = useAiPanelStore((s) => s.isResizing)
  const closePanel = useAiPanelStore((s) => s.closePanel)
  const setWidth = useAiPanelStore((s) => s.setWidth)
  const setResizing = useAiPanelStore((s) => s.setResizing)
  const activeWorkspace = useAiPanelStore((s) => s.activeWorkspace)
  const setActiveWorkspace = useAiPanelStore((s) => s.setActiveWorkspace)
  const pendingPermissionSetup = useAiPanelStore((s) => s.pendingPermissionSetup)
  const setPendingPermissionSetup = useAiPanelStore((s) => s.setPendingPermissionSetup)
  // 浮窗模式状态(2026-07-30)
  const floatMode = useAiPanelStore((s) => s.floatMode)
  const floatMinimized = useAiPanelStore((s) => s.floatMinimized)
  const floatCollapsed = useAiPanelStore((s) => s.floatCollapsed)
  const floatPosition = useAiPanelStore((s) => s.floatPosition)
  const setFloatMode = useAiPanelStore((s) => s.setFloatMode)
  const setFloatMinimized = useAiPanelStore((s) => s.setFloatMinimized)
  const setFloatCollapsed = useAiPanelStore((s) => s.setFloatCollapsed)
  const setFloatPosition = useAiPanelStore((s) => s.setFloatPosition)
  const openPanel = useAiPanelStore((s) => s.openPanel)
  const {
    messages,
    currentModel,
    isStreaming,
    pendingQuestion,
    sendMessage,
    sendAnswer,
    skipQuestion,
    stop,
    clearMessages,
    setModel,
  } = useChat()
  const subAgentActivities = useChatStore((s) => s.subAgentActivities)
  // ChatMode 4 态(2026-07-28 移除独立 PlanActToggle):订阅 currentMode 用于动态切换输入框 placeholder
  const currentMode = useModeStore((s) => s.currentMode)
  // 登录弹窗打开状态(2026-07-31 立,双重保险):
  // AgentTaskProgressPane 内部已订阅 isLoginOpen 并 return null,但用户反馈"修了好几遍"
  // 仍未生效(可能 HMR 边界 / 父组件未订阅导致 zustand 通知链断裂)。
  // 父组件 AISidePanel 也订阅 isLoginOpen,登录弹窗打开时不渲染 AgentTaskProgressPane,
  // 双重保险确保 pane 不会浮在 z-modal(2000) 遮罩之上清晰高亮显示。
  const isLoginOpen = useLoginDialogStore((s) => s.isOpen)
  const { lastMessage } = useWebSocket()
  const lastWsRef = React.useRef<WSNotification | null>(null)

  // 移动端深度适配(2026-07-31 立):
  // - useIsMobile 检测 <768px 视口,SSR 安全(默认 false,客户端 mount 后修正)
  // - 移动端自动切换到浮窗 FAB 模式(不破坏桌面端 docked 体验)
  // - 浮窗展开时全屏覆盖(利用现有 floatMode,移动端样式覆盖)
  const isMobile = useIsMobile()

  // 移动端自动切换:进入移动端视口时,自动设为浮窗 FAB 模式
  // - 仅在 floatMode=false(docked)时触发,避免覆盖用户已手动切换的浮窗状态
  // - 桌面端恢复时不自动切回 docked(保留用户持久化的 floatMode 偏好)
  React.useEffect(() => {
    if (isMobile && !floatMode) {
      setFloatMode(true)
      setFloatMinimized(true)
      setFloatCollapsed(false)
    }
  }, [isMobile, floatMode, setFloatMode, setFloatMinimized, setFloatCollapsed])
  const [loadingHistory, setLoadingHistory] = React.useState(false)
  const [conversationTitle, setConversationTitle] = React.useState<string | null>(null)
  const [workspaceName, setWorkspaceName] = React.useState<string | null>(null)
  // 分页状态(2026-07-25 立,#8 滚动到顶部加载更多历史)
  // - hasMoreHistory:当前会话是否还有更早的消息可加载
  // - oldestCursor:下一页 before 游标(当前已加载消息中最旧一条的 id)
  // - loadingMoreHistory:防止滚动到顶部重复触发
  const [hasMoreHistory, setHasMoreHistory] = React.useState(false)
  const oldestCursorRef = React.useRef<string | null>(null)
  const [loadingMoreHistory, setLoadingMoreHistory] = React.useState(false)
  // #11 切换会话 LRU 缓存(2026-07-25 立):
  // 缓存最近 5 个会话的 messages + 分页状态,切回会话时同步从缓存恢复(无闪烁),
  // 后台异步拉取最新消息对比更新。用 Map 维护插入顺序,delete + set 重新插入实现 LRU。
  // - conversationCacheRef:Map<conversationId, { messages, hasMore, oldestCursor }>
  // - prevConversationIdRef:跟踪上一次会话 ID,切换时把旧会话状态写入缓存
  const conversationCacheRef = React.useRef<
    Map<string, { messages: ChatMessage[]; hasMore: boolean; oldestCursor: string | null }>
  >(new Map())
  const prevConversationIdRef = React.useRef<string | null>(null)
  // P3 修复:组件卸载时清空会话 LRU 缓存,释放消息数据引用
  // (LRU 上限 5 个会话,每个会话含完整 messages 数组,长期运行累积大量消息数据)
  React.useEffect(() => {
    return () => {
      conversationCacheRef.current.clear()
    }
  }, [])
  // 性能修复(2026-07-25):原 const pathname = usePathname() 订阅在 AISidePanel 根,
  // 导致每次路由切换 AISidePanel 整树重渲染(连带 MessageList/MessageInput/ModelSelector 等)。
  // 改为下推到 <WorkspaceNameSync> 子组件,pathname 订阅只触发子组件(渲染 null,无开销)。
  // 父组件通过 setWorkspaceName callback 接收项目名,不订阅 pathname。

  // 同步 AISidePanel 占据宽度(含右侧 8px 视觉间距)到 :root 的 --ai-panel-width CSS 变量。
  // 2026-07-30:AI 面板已移入 flex 流,不再需要 padding-left 避让。
  // --ai-panel-width 仍保留供 ScrollDownButton(marketing 页面)计算居中偏移。
  // - open=true:占位 = width + 8px(面板宽度 + 右侧间距)
  // - open=false:占位 = 0(仅渲染 width:0 的拖拽手柄,不占视觉空间)
  React.useEffect(() => {
    const occupy = open ? width + 8 : 0
    document.documentElement.style.setProperty('--ai-panel-width', `${occupy}px`)
    return () => {
      // 卸载时复位,避免残留 CSS 变量导致内容区永久避让
      document.documentElement.style.setProperty('--ai-panel-width', '0px')
    }
  }, [open, width])

  // WebSocket 多端同步:统一处理 ai_response / ai_question / chat_question_answered 三种事件
  // - ai_response:其他端 AI 回复 → append/replace assistant 消息(原有逻辑)
  // - ai_question:其他端 AI 主动提问 → setPendingQuestion 弹窗(P2 新增)
  // - chat_question_answered:其他端用户已回答 → clearPendingQuestion 关闭弹窗(P2 新增)
  React.useEffect(() => {
    if (!lastMessage || lastMessage === lastWsRef.current) return
    lastWsRef.current = lastMessage
    const currentConv = useChatStore.getState().conversationId

    // P2 多端同步:AI 主动提问(其他端收到 ai_question → 弹窗)
    if (isAIQuestion(lastMessage)) {
      const { conversationId, question } = lastMessage.data
      // 仅处理当前会话的事件(其他会话的提问不弹窗,避免干扰)
      if (conversationId && currentConv && conversationId !== currentConv) return
      // 运行时 Zod 校验:WS payload 可能因客户端版本差异 / 中间件篡改而异常,
      // 校验失败时不弹窗(避免脏数据进 store 导致 UI 崩溃)
      const pending = parsePendingQuestion(question)
      if (pending) {
        useChatStore.getState().setPendingQuestion(pending)
      }
      return
    }

    // P2 多端同步:AI 提问已回答(其他端收到 chat_question_answered → 关闭弹窗)
    if (isAIQuestionAnswered(lastMessage)) {
      const { conversationId, questionId } = lastMessage.data
      if (conversationId && currentConv && conversationId !== currentConv) return
      const pending = useChatStore.getState().pendingQuestion
      // 仅关闭匹配 questionId 的弹窗(避免误关其他提问)
      if (pending && pending.questionId === questionId) {
        useChatStore.getState().clearPendingQuestion()
      }
      return
    }

    // AI 回复多端同步(原有逻辑)
    if (!isAIResponse(lastMessage)) return
    const { conversationId, message, clientMessageId } = lastMessage.data
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
  // #11 LRU 缓存(2026-07-25 立):
  // - 切换会话前:把旧会话的 messages + 分页状态存入 conversationCacheRef(LRU delete+set)
  // - 缓存命中:同步从缓存恢复 store.messages(无闪烁),后台异步拉取最新消息对比更新
  // - 缓存未命中:正常拉取,拉取后写入缓存
  // - LRU 淘汰:cache.size > 5 时删除最早(Map.keys().next().value)
  React.useEffect(() => {
    if (!open) return

    // 切换会话前保存旧会话到缓存(LRU:delete + set 重新插入)
    const prevId = prevConversationIdRef.current
    if (prevId && prevId !== storeConversationId) {
      const currentStore = useChatStore.getState()
      if (currentStore.messages.length > 0) {
        conversationCacheRef.current.delete(prevId)
        conversationCacheRef.current.set(prevId, {
          messages: currentStore.messages,
          hasMore: hasMoreHistory,
          oldestCursor: oldestCursorRef.current,
        })
        // LRU 淘汰:超过 5 个会话时删除最早使用的
        while (conversationCacheRef.current.size > 5) {
          const oldestKey = conversationCacheRef.current.keys().next().value
          if (oldestKey) conversationCacheRef.current.delete(oldestKey)
        }
      }
    }
    prevConversationIdRef.current = storeConversationId

    let cancelled = false

    async function loadHistory(id: string) {
      // 缓存命中:同步从缓存恢复(无闪烁),后台异步拉取最新消息对比更新
      const cached = conversationCacheRef.current.get(id)
      if (cached) {
        // LRU 更新:delete + set 重新插入到末尾(最近使用)
        conversationCacheRef.current.delete(id)
        conversationCacheRef.current.set(id, cached)
        // 同步填充 store(无 loading 状态,无闪烁)
        useChatStore.setState({ messages: cached.messages, error: null })
        setHasMoreHistory(cached.hasMore)
        oldestCursorRef.current = cached.oldestCursor
        setLoadingHistory(false)

        // 后台异步拉取最新消息对比更新(不阻塞 UI,完成后覆盖缓存数据)
        void (async () => {
          try {
            const [convRes, msgRes] = await Promise.all([
              getConversation(id),
              getMessages(id, { pageSize: 50 }),
            ])
            if (cancelled) return
            if (convRes.success && msgRes.success) {
              const hydrated: ChatMessage[] = msgRes.data.messages.map((m) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                createdAt: new Date(m.createdAt).getTime(),
              }))
              // 仅当当前仍在该会话时才更新 store(避免覆盖用户已切换到的新会话)
              if (useChatStore.getState().conversationId === id) {
                useChatStore.setState({ messages: hydrated, error: null })
                setConversationTitle(convRes.data.conversation.title || null)
                oldestCursorRef.current = msgRes.data.nextCursor
                setHasMoreHistory(msgRes.data.hasMore)
              }
              // 更新缓存为最新数据
              conversationCacheRef.current.delete(id)
              conversationCacheRef.current.set(id, {
                messages: hydrated,
                hasMore: msgRes.data.hasMore,
                oldestCursor: msgRes.data.nextCursor,
              })
              // 恢复挂起提问(从 metadata)
              const meta = convRes.data.conversation.metadata as {
                pendingQuestion?: unknown
              } | null
              const pending = parsePendingQuestion(meta?.pendingQuestion)
              if (pending) {
                useChatStore.getState().setPendingQuestion(pending)
              } else {
                useChatStore.getState().clearPendingQuestion()
              }
            }
          } catch {
            // 后台拉取失败时保留缓存数据,不阻塞用户
          }
        })()
        return
      }

      // 缓存未命中:正常拉取
      setLoadingHistory(true)
      try {
        // #8 分页加载:默认 page=1 返回最新 pageSize 条(后端 offset 模式按 desc + reverse)
        const [convRes, msgRes] = await Promise.all([
          getConversation(id),
          getMessages(id, { pageSize: 50 }),
        ])
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
          // 记录分页游标:oldestCursor = 当前最旧一条 id,hasMoreHistory = 是否还有更早历史
          oldestCursorRef.current = msgRes.data.nextCursor
          setHasMoreHistory(msgRes.data.hasMore)

          // 写入缓存(LRU:delete + set,淘汰超 5 个的最早会话)
          conversationCacheRef.current.delete(id)
          conversationCacheRef.current.set(id, {
            messages: hydrated,
            hasMore: msgRes.data.hasMore,
            oldestCursor: msgRes.data.nextCursor,
          })
          while (conversationCacheRef.current.size > 5) {
            const oldestKey = conversationCacheRef.current.keys().next().value
            if (oldestKey) conversationCacheRef.current.delete(oldestKey)
          }

          // P2 多端同步:从 conversation.metadata.pendingQuestion 恢复挂起状态
          // 场景:用户 A 在 web 提问后刷新页面 / 切换会话再切回 / 在其他端打开同一会话
          // 后端 /chat/questions 已把 pendingQuestion 写入 conversation.metadata(merge 模式)
          // 这里读取并还原弹窗,让用户能继续回答(不丢失挂起态)
          //
          // 运行时 Zod 校验:防止 DB metadata 被其他端写入异常结构 / 被外部篡改 / 字段
          // 类型不匹配导致前端崩溃。校验失败时降级为 clearPendingQuestion(不弹窗)。
          const meta = convRes.data.conversation.metadata as {
            pendingQuestion?: unknown
          } | null
          const pending = parsePendingQuestion(meta?.pendingQuestion)
          if (pending) {
            useChatStore.getState().setPendingQuestion(pending)
          } else {
            // 无挂起提问或数据非法时清空(避免上一会话的弹窗残留 / 脏数据崩溃)
            useChatStore.getState().clearPendingQuestion()
          }
        } else {
          setConversationId(null)
          useChatStore.setState({ messages: [], error: null })
          setConversationTitle(null)
          useChatStore.getState().clearPendingQuestion()
        }
      } catch {
        if (!cancelled) {
          setConversationId(null)
          useChatStore.setState({ messages: [], error: null })
          setConversationTitle(null)
          useChatStore.getState().clearPendingQuestion()
        }
      } finally {
        if (!cancelled) setLoadingHistory(false)
      }
    }

    if (storeConversationId) {
      // 重置分页状态(防止上一会话的游标残留)
      oldestCursorRef.current = null
      setHasMoreHistory(false)

      // 2026-07-27 修复 React Hydration 失败导致 AI 回复未渲染:
      // 原 chat.ts onRehydrateStorage 在 persist 初始化时同步把 recentMessages.messages
      // 赋给 state.messages,因 localStorage 同步 API,赋值发生在 React hydration 之前,
      // 导致 SSR(messages=[]) 与客户端 hydration(messages=50 条) 不一致 → hydration mismatch
      // → React 丢弃服务端 DOM 重建 → store 状态错乱 → onDelta 更新旧引用 → AI 回复不渲染。
      // 修复:onRehydrateStorage 移除 messages 赋值,改为此处 useEffect(hydration 后) 预填充。
      // 条件:仅当 messages 为空(首次加载/无缓存)且 recentMessages 匹配当前会话时预填充,
      // 避免覆盖缓存命中的数据(loadHistory 内部会先检查缓存)。
      const currentStore = useChatStore.getState()
      if (
        currentStore.messages.length === 0 &&
        currentStore.recentMessages &&
        currentStore.recentMessages.conversationId === storeConversationId &&
        Array.isArray(currentStore.recentMessages.messages)
      ) {
        useChatStore.setState({
          messages: currentStore.recentMessages.messages,
          error: null,
        })
      }

      void loadHistory(storeConversationId)
    } else {
      useChatStore.setState({ messages: [], error: null })
      setConversationTitle(null)
      oldestCursorRef.current = null
      setHasMoreHistory(false)
    }

    return () => {
      cancelled = true
    }
    // hasMoreHistory 用于切换会话前保存旧会话到缓存,但不放入依赖:
    // 避免 hasMoreHistory 变化触发 loadHistory 重载(分页加载由 handleLoadMoreHistory +
    // messages 同步 effect 处理缓存更新)
  }, [storeConversationId, setConversationId, open]) // eslint-disable-line react-hooks/exhaustive-deps -- hasMoreHistory 故意不放入依赖,避免其变化触发 loadHistory 重载

  // #11 LRU 缓存同步(2026-07-25 立):
  // messages 变化时(用户发送新消息、收到 AI 回复、流式增量、WebSocket 多端同步等)
  // 同步更新当前会话缓存的 messages + 分页状态,确保下次切回时数据是最新的。
  // hasMoreHistory 变化时也同步(分页加载在 handleLoadMoreHistory 已单独处理,此处兜底)。
  // messages 从 useChatStore.getState() 获取最新值(避免闭包陈旧值),但依赖数组
  // 仍需包含 messages 以触发 effect(组件重渲染时 messages 引用变化触发依赖)。
  React.useEffect(() => {
    if (!storeConversationId) return
    const cached = conversationCacheRef.current.get(storeConversationId)
    if (!cached) return
    const currentMsgs = useChatStore.getState().messages
    // 引用相同则跳过(避免无变化时重复写入)
    if (cached.messages === currentMsgs) return
    cached.messages = currentMsgs
    cached.hasMore = hasMoreHistory
    cached.oldestCursor = oldestCursorRef.current
  }, [storeConversationId, messages, hasMoreHistory])

  // #8 滚动到顶部加载更多历史消息(before 游标分页)
  // - 由 MessageList 在 scrollTop 接近 0 时触发
  // - 加载完成后 prepend 到 messages 头部,并保持视觉滚动位置(由 MessageList 内部处理)
  const handleLoadMoreHistory = React.useCallback(async () => {
    const convId = useChatStore.getState().conversationId
    const cursor = oldestCursorRef.current
    if (!convId || !cursor || loadingMoreHistory || !hasMoreHistory) return
    setLoadingMoreHistory(true)
    try {
      const res = await getMessages(convId, { before: cursor, pageSize: 50 })
      if (!res.success) return
      const older = res.data.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: new Date(m.createdAt).getTime(),
      }))
      if (older.length === 0) {
        setHasMoreHistory(false)
        oldestCursorRef.current = null
        return
      }
      // prepend 到 messages 头部(时间正序,older 也是正序且早于当前所有消息)
      useChatStore.setState((s) => ({ messages: [...older, ...s.messages] }))
      oldestCursorRef.current = res.data.nextCursor
      setHasMoreHistory(res.data.hasMore)
      // #11 LRU 缓存同步(2026-07-25 立):分页加载更多后,更新缓存的 messages + oldestCursor + hasMore
      const cached = conversationCacheRef.current.get(convId)
      if (cached) {
        cached.messages = useChatStore.getState().messages
        cached.oldestCursor = res.data.nextCursor
        cached.hasMore = res.data.hasMore
      }
    } finally {
      setLoadingMoreHistory(false)
    }
  }, [loadingMoreHistory, hasMoreHistory])

  const handleNewChat = React.useCallback(() => {
    clearMessages()
    setConversationId(null)
    setConversationTitle(null)
    oldestCursorRef.current = null
    setHasMoreHistory(false)
  }, [clearMessages, setConversationId])

  // 标题显示优先级(用户规则):
  //   1. 用户在 AI 面板手动添加的本地工作区 → 显示 workspace.name(参考 Trae/Codex 顶部 project selector)
  //   2. workspace 项目页 → 显示项目文件夹名(选择项目文件时显示项目文件夹名)
  //   3. 已加载任务 → 显示任务名称(只是单纯对话时显示对话任务命名)
  //   4. 兜底 → 显示"空工作区"(没有选择项目时显示空工作区)
  const displayTitle =
    activeWorkspace?.name ?? workspaceName ?? conversationTitle ?? tc('emptyWorkspace')

  // 全局快捷键 Ctrl+Shift+N:新建任务
  React.useEffect(() => {
    if (!open) return
    const onNewChat = () => handleNewChat()
    window.addEventListener('global-shortcut:new-chat', onNewChat)
    return () => window.removeEventListener('global-shortcut:new-chat', onNewChat)
  }, [handleNewChat, open])

  // Alt+P / Option+P 快捷键:切换 Plan/Act 模式(2026-07-25 立,对标 Trae SOLO Plan 快捷键)
  // 2026-07-28 升级:Plan/Act 概念合并到 ChatMode,Alt+P 改为在 ChatMode.plan ↔ ChatMode.build 间切换
  // - 仅当 AI 面板打开时生效,避免污染其他页面
  // - 不在输入框聚焦时触发(避免与 Alt+字母 输入特殊字符冲突)
  // - 与 /plan /act 斜杠命令联动(两入口都走 ChatMode)
  React.useEffect(() => {
    if (!open) return
    const onAltP = (e: KeyboardEvent) => {
      if (!e.altKey || e.key !== 'p' || e.ctrlKey || e.metaKey || e.shiftKey) return
      // 避免在 textarea/input 聚焦时触发(用户可能用 Alt 组合输入特殊字符)
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable)
      ) {
        return
      }
      e.preventDefault()
      // ChatMode:plan ↔ build 切换(语义对齐:plan=只读分析,build=正常执行)
      const next: ChatMode = useModeStore.getState().currentMode === 'plan' ? 'build' : 'plan'
      useModeStore.getState().setMode(next)
    }
    window.addEventListener('keydown', onAltP)
    return () => window.removeEventListener('keydown', onAltP)
  }, [open])

  // Ctrl+1/2/3/4 切换 ChatMode 4态(2026-07-28 立,补全三通道)
  // - 仅当 AI 面板打开时生效,避免污染其他页面
  // - Ctrl+数字 不与打字冲突,故无需排除 textarea/input 聚焦场景
  // - 与 /build /plan /review /spec 斜杠命令 + AI 自动判断三入口联动
  //   (2026-07-28 移除 4 按钮后,4 按钮入口废弃,保留 /命令 + Ctrl 快捷键 + AI 自动判断)
  // - Ctrl+数字 在浏览器默认切换 tab,需 preventDefault 阻止
  React.useEffect(() => {
    if (!open) return
    const onModeShortcut = (e: KeyboardEvent) => {
      // 仅匹配纯 Ctrl+数字(排除 Shift/Alt/Meta 组合,避免与浏览器其他快捷键冲突)
      if (!e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return
      const keyMap: Record<string, ChatMode> = {
        '1': 'build',
        '2': 'plan',
        '3': 'review',
        '4': 'spec',
      }
      const target = keyMap[e.key]
      if (!target) return
      e.preventDefault()
      const labelMap: Record<ChatMode, string> = {
        build: t('modeBuild'),
        plan: t('modePlan'),
        review: t('modeReview'),
        spec: t('modeSpec'),
      }
      const label = labelMap[target]
      const modeStore = useModeStore.getState()
      if (modeStore.currentMode === target) {
        toast.info(t('modeAlreadyActive', { mode: label }))
        return
      }
      modeStore.setMode(target)
      toast.success(t('modeSwitched', { mode: label }))
    }
    window.addEventListener('keydown', onModeShortcut)
    return () => window.removeEventListener('keydown', onModeShortcut)
  }, [open, t])

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

  // ==================== 浮窗拖拽逻辑(2026-07-30)====================
  // 浮窗模式下面板 position:fixed,通过 header 拖拽改变 floatPosition。
  // 使用 ref 记录拖拽起始坐标,pointermove 更新 store,pointerup 清理监听。
  const floatDragStart = React.useRef<{ x: number; y: number; px: number; py: number } | null>(null)

  const handleFloatDragStart = React.useCallback(
    (e: React.PointerEvent) => {
      if (!floatMode || floatMinimized) return
      // 只响应左键 + 拖拽区域(不是按钮)
      const target = e.target as HTMLElement
      if (target.closest('button, a, input, textarea, select')) return

      e.preventDefault()
      const startX = floatPosition.x < 0 ? window.innerWidth - width - 24 : floatPosition.x
      const startY = floatPosition.y < 0 ? 8 : floatPosition.y
      floatDragStart.current = { x: startX, y: startY, px: e.clientX, py: e.clientY }

      const onMove = (ev: PointerEvent) => {
        if (!floatDragStart.current) return
        const dx = ev.clientX - floatDragStart.current.px
        const dy = ev.clientY - floatDragStart.current.py
        const newX = Math.max(
          8,
          Math.min(window.innerWidth - width - 8, floatDragStart.current.x + dx),
        )
        const newY = Math.max(8, Math.min(window.innerHeight - 120, floatDragStart.current.y + dy))
        setFloatPosition({ x: newX, y: newY })
      }
      const onUp = () => {
        floatDragStart.current = null
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [floatMode, floatMinimized, floatPosition, width, setFloatPosition],
  )

  // 性能修复(2026-07-25):WorkspaceNameSync 子组件渲染 null,内部订阅 usePathname,
  // 把项目名通过 onNameChange callback 回传给父组件(setWorkspaceName)。
  // pathname 变化只触发子组件重渲染,不触发 AISidePanel 根重渲染。
  const workspaceNameSync = <WorkspaceNameSync onNameChange={setWorkspaceName} />

  // 浮窗最小化态(或浮窗模式 + 面板关闭):渲染 FAB 按钮
  if (floatMode && (floatMinimized || !open)) {
    return (
      <>
        {workspaceNameSync}
        <button
          type="button"
          onClick={() => {
            setFloatMinimized(false)
            setFloatCollapsed(false)
            openPanel()
          }}
          aria-label={tc('title')}
          className={cn(
            'fixed z-sticky flex items-center justify-center rounded-xl border border-border bg-card shadow-lg transition-all hover:scale-105 hover:shadow-xl',
            // 移动端:FAB 更大(56px 适合触屏),固定右下角
            isMobile
              ? 'h-14 w-14 bottom-4 right-4'
              : // 桌面端:48px FAB,位置由 floatPosition 控制
                'h-12 w-12',
          )}
          style={
            isMobile
              ? undefined
              : {
                  left: floatPosition.x < 0 ? 'auto' : `${floatPosition.x}px`,
                  right: floatPosition.x < 0 ? '24px' : 'auto',
                  top: floatPosition.y < 0 ? '8px' : `${floatPosition.y}px`,
                }
          }
        >
          <BrandIcon
            vendor={inferVendor(currentModel)}
            size={isMobile ? 26 : 22}
            className="text-primary"
          />
        </button>
      </>
    )
  }

  // 浮窗折叠态:只显示输入框 + 展开按钮,点击展开拉出完整面板
  // 用户交互:Pin → 折叠态(只看输入框)→ 点击展开 → 完整面板(对话历史+header)
  // 2026-07-30:工具条与输入卡片融合(共享 border + bg-card),不再占独立行;
  // 按钮无额外 px,左间距 = 容器 px-1.5(6px)= 上下 py-1.5(6px),四向一致。
  // 2026-07-31 移动端适配:移动端折叠态全屏覆盖(与完整面板一致的 inset-0),
  // 避免小屏上小浮窗遮挡内容且难以操作。
  if (floatMode && floatCollapsed) {
    return (
      <>
        {workspaceNameSync}
        <div
          data-testid="ai-panel-root"
          className={cn(
            'ai-panel-root fixed z-sticky',
            isMobile
              ? 'inset-0' // 移动端:全屏覆盖
              : 'ai-float-glow rounded-xl', // 桌面端:浮窗 + 品牌色光晕
          )}
          style={
            isMobile
              ? undefined
              : {
                  width,
                  left: floatPosition.x < 0 ? 'auto' : `${floatPosition.x}px`,
                  right: floatPosition.x < 0 ? '24px' : 'auto',
                  top: floatPosition.y < 0 ? '8px' : `${floatPosition.y}px`,
                }
          }
        >
          <aside
            aria-label={tc('title')}
            className={cn(
              'flex flex-col overflow-hidden bg-shell-panel',
              isMobile ? 'h-full w-full' : 'rounded-xl',
            )}
          >
            {/* 输入区(直接渲染 MessageInput,无 MessageList)
                floatHeader = 浮窗按钮(展开/停靠/最小化),与 AgentProgressTrigger 同行渲染在输入卡片内 */}
            <MessageInput
              onSend={sendMessage}
              onStop={stop}
              isStreaming={isStreaming}
              placeholder={currentMode === 'plan' ? t('placeholderPlan') : t('placeholder')}
              sendLabel={t('send')}
              stopLabel={t('stop')}
              model={currentModel}
              onModelChange={setModel}
              modelLabel={t('model')}
              onFloatDragStart={handleFloatDragStart}
              onTriggerClick={() => setFloatCollapsed(false)}
              floatHeader={
                <>
                  <button
                    type="button"
                    onClick={() => setFloatCollapsed(false)}
                    aria-label={tc('floatMode')}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-md py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                    <span>{tc('floatMode')}</span>
                  </button>
                  <Tooltip content={tc('dockPanel')}>
                    <button
                      type="button"
                      onClick={() => {
                        setFloatMode(false)
                        setFloatCollapsed(false)
                      }}
                      aria-label={tc('dockPanel')}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <PanelLeft className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip>
                  <Tooltip content={tc('minimize')}>
                    <button
                      type="button"
                      onClick={() => setFloatMinimized(true)}
                      aria-label={tc('minimize')}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip>
                </>
              }
            />
          </aside>
        </div>
      </>
    )
  }

  // 关闭态:仅渲染拖拽手柄(可拖拽打开),不渲染整个面板内容。
  // 2026-07-30 彻底根治:容器从 fixed 改为 flex 子元素(relative + shrink-0),
  // width:0 使容器在 flex 流中不占视觉空间;手柄 right-[-12px] 跨越容器右边缘 8px 命中。
  // py-2 与 MainShell 的 pt-2/mb-2 垂直对齐(8px 上下间距)。
  // 2026-07-31 移动端适配:加 hidden lg:block 让 docked 关闭态(手柄)在 < 1024px 隐藏,
  // 避免 AISidePanel 在 mobile 视口下占 400px 宽把 work-area 推到 viewport 外。
  // mobile 下 AI 面板入口改用浮窗 FAB(由 floatMode 路径独立渲染,不受此规则影响)。
  if (!open) {
    return (
      <>
        {workspaceNameSync}
        <div className="relative hidden h-full shrink-0 py-2 mr-1.5 lg:block" style={{ width: 0 }}>
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
      </>
    )
  }

  return (
    <>
      {workspaceNameSync}
      <div
        // AI 面板容器(最外层,DevTools 可选中)
        // - docked 模式:relative + shrink-0 + py-2,flex 流内布局,mr-1.5 固定 6px 间距
        // - float 模式(桌面):fixed 定位,z-sticky,可拖拽,品牌色微光浮窗视觉(ai-float-glow)
        //   rounded-xl 匹配内层 aside 圆角(光晕跟随圆角呈圆弧),去掉 py-2(浮窗无需上下间距)
        // - float 模式(移动):fixed inset-0 全屏覆盖,无光晕无圆角,最大化可用空间
        // data-testid="ai-panel-root":全局唯一最外层容器标识,DevTools / E2E 可直接选中
        // 2026-07-31 移动端深度适配:移动端浮窗展开时全屏覆盖(inset-0),
        // 解决 400px 浮窗在 390px 视口溢出问题,同时提供最佳移动端对话体验。
        data-testid="ai-panel-root"
        className={cn(
          'ai-panel-root',
          floatMode
            ? isMobile
              ? 'fixed inset-0 z-sticky' // 移动端浮窗:全屏覆盖
              : 'fixed z-sticky ai-float-glow rounded-xl' // 桌面端浮窗:品牌色光晕
            : 'relative hidden h-full shrink-0 lg:block mr-1.5 py-2',
        )}
        style={
          floatMode
            ? isMobile
              ? undefined // 移动端:无定位 style,全屏由 inset-0 控制
              : {
                  width,
                  left: floatPosition.x < 0 ? 'auto' : `${floatPosition.x}px`,
                  right: floatPosition.x < 0 ? '24px' : 'auto',
                  top: floatPosition.y < 0 ? '8px' : `${floatPosition.y}px`,
                  height: 'min(600px, calc(100vh - 100px))',
                  transition: isResizing ? 'none' : 'width 0.2s cubic-bezier(0.4,0,0.2,1)',
                }
            : { width, transition: isResizing ? 'none' : 'width 0.2s cubic-bezier(0.4,0,0.2,1)' }
        }
      >
        <aside
          aria-label={tc('title')}
          // Pane 默认锚点(2026-07-29 立):AgentTaskProgressPane 用这个 data-testid 找到 AI 面板容器
          // 作为 Pane 默认位置的视口坐标系锚点,空消息时也能定位(不再依赖 message-list-inline-panel)
          data-testid="ai-side-panel-aside"
          // AI 面板必须有独立 bg-shell-panel 背景:
          // 1) 卡片感:AI 面板作为独立 flex 子元素,需要自己的背景色形成卡片视觉边界;
          // 2) 暗色模式下的遮罩一致性:登录/SSO/认证授权弹窗打开时,z-modal=2000 遮罩(z-50 Dialog 也会盖)叠加在 AI 面板之上,
          //    若 AI 面板透明,内容透到变暗的 work-area 上,视觉上像"AI 面板高亮"未被遮罩盖住;有 bg-shell-panel 后,
          //    AI 面板背景独立变暗,真正"暗下去到背景里"。
          // 之前 commit 5d378c22e 担心"深色背景下默认滚动条轨道透出深色",但 message-list 已加 hover-scroll
          // (scrollbar-width: none + ::-webkit-scrollbar { display: none })完全隐藏滚动条,不会透色,
          // 恢复 bg-shell-panel 安全。
          className={cn(
            'flex h-full flex-col overflow-hidden bg-shell-panel',
            // 移动端全屏浮窗:无圆角;桌面端浮窗/docked:保持 rounded-xl
            isMobile && floatMode ? 'rounded-none' : 'rounded-xl',
          )}
        >
          {/* 标题栏(浮窗模式下可拖拽,移动端全屏模式禁用拖拽) */}
          <header
            onPointerDown={floatMode && !isMobile ? handleFloatDragStart : undefined}
            className={cn(
              'flex h-14 shrink-0 items-center gap-2 px-3',
              // 2026-07-19 中文 + 图标垂直对齐:主标题 span 视觉居中
              '[&>div>span:first-child]:translate-y-[var(--text-vcenter-offset)]',
              // 浮窗模式(桌面端):header 可拖拽,非交互区域 cursor-move
              // 移动端全屏模式:不可拖拽
              floatMode && !isMobile && 'cursor-move',
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
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
              <span className="flex min-w-0 items-center gap-1">
                <span className="whitespace-nowrap text-sm font-semibold">{displayTitle}</span>
                {/* 工作区选择器(参考 Trae/Codex 顶部 project selector):
                  空工作区时显示 FolderPlus 入口,已绑定时显示 Folder 入口可切换/清除 */}
                <WorkspaceSelector />
              </span>
            </div>
            {/* Plan/Act 模式切换(2026-07-24 立,对标 Trae Work plan/act toggle + Codex)
              2026-07-28 移除:PlanActToggle 按钮与 sidebar ModeSwitcher 4 态(ChatMode build/plan/review/spec)
              语义重叠,统一用 ModeSwitcher 控制。当前 mode 视觉指示由 sidebar ModeSwitcher 高亮态承载,
              切换入口:ModeSwitcher 4 态按钮 + Ctrl+1/2/3/4 快捷键 + /build /plan /review /spec 斜杠命令 +
              Alt+P 快捷键(plan ↔ build)。AI 面板 header 释放 32px 空间,布局更紧凑。
              2026-07-28 v2:移除 sidebar 4 按钮后,ModeSwitcher 文件已删除,模式视觉指示由
              message-input.tsx 的 CurrentModeBadge 承载(输入区上方小徽章),
              切换入口:/build /plan /review /spec 斜杠命令 + Ctrl+1-4 快捷键 + AI 自动判断(发送时)。
              Alt+P 快捷键保留(plan ↔ build 二选一场景,2026-07-28 仍有效)。 */}
            <Tooltip content={tc('newConversation')}>
              <button
                type="button"
                onClick={handleNewChat}
                disabled={isStreaming}
                aria-label={tc('newConversation')}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
              </button>
            </Tooltip>
            {/* 派发 Subagent 按钮(2026-07-28 移除):
              subagent 现已改为自动派发(主 agent 在对话流中调用 dispatch_subagent 工具时,
              后端发 subagent_spawn/end SSE 事件 → 前端进度面板自动展示生命周期),
              无需用户手动触发,移除手动派发按钮。 */}
            {/* 浮窗模式切换按钮(2026-07-30):
                - docked 模式:显示 Pin 图标,点击切换到浮窗折叠态(只显示输入框)
                - float 模式:显示 PanelLeft(停靠) + Minus(最小化)两个按钮 */}
            {floatMode ? (
              <>
                <Tooltip content={tc('dockPanel')}>
                  <button
                    type="button"
                    onClick={() => {
                      setFloatMode(false)
                      setFloatMinimized(false)
                    }}
                    aria-label={tc('dockPanel')}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <PanelLeft className="h-4 w-4" />
                  </button>
                </Tooltip>
                <Tooltip content={tc('minimize')}>
                  <button
                    type="button"
                    onClick={() => setFloatMinimized(true)}
                    aria-label={tc('minimize')}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                </Tooltip>
              </>
            ) : (
              <Tooltip content={tc('floatMode')}>
                <button
                  type="button"
                  onClick={() => {
                    setFloatMode(true)
                    setFloatMinimized(false)
                    setFloatCollapsed(true)
                    openPanel()
                  }}
                  aria-label={tc('floatMode')}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Pin className="h-4 w-4" />
                </button>
              </Tooltip>
            )}
            <Tooltip content={tcommon('close')}>
              <button
                type="button"
                onClick={closePanel}
                aria-label={tcommon('close')}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </Tooltip>
          </header>

          {/* 消息区(v6.3:加 relative 让 popover 可定位到本容器右上角) */}
          <div className="relative min-h-0 flex-1">
            <MessageList
              messages={messages}
              isStreaming={isStreaming}
              isLoading={loadingHistory}
              emptyTitle={t('empty')}
              emptyHint={t('emptyHint')}
              assistantLabel={t('assistant')}
              loadingLabel={t('loading')}
              hasMoreHistory={hasMoreHistory}
              loadingMoreHistory={loadingMoreHistory}
              onLoadMoreHistory={handleLoadMoreHistory}
              onTemplateSelect={(content) => {
                useChatStore.setState({ draftInput: content })
              }}
              // Phase 18.2: 传递 subAgentActivities 到 MessageList,
              // Trae Work 风格 inline 渲染在最后一条 AI 消息下方(而非 AI 面板底部)
              subAgentActivities={subAgentActivities}
              // Phase 18.4: step budget(从 store 派生,目前用固定 60 上限)
              stepBudget={
                subAgentActivities.length > 0
                  ? {
                      used: subAgentActivities.reduce((sum, a) => sum + a.completedSteps.length, 0),
                      total: 60,
                    }
                  : undefined
              }
            />
            {/* Agent 任务进度 popover(v14:absolute 锚定到本容器右上角,不再 fixed 到视口)
                由 store.open 联动显隐,trigger 在 MessageInput 上方居中切换 store
                双重保险(2026-07-31):父组件 AISidePanel 也检查 isLoginOpen,
                登录弹窗打开时不渲染 pane,避免 z-popover(2001) 浮在 z-modal(2000) 遮罩之上 */}
            {!isLoginOpen && <AgentTaskProgressPane />}
          </div>

          {/* Sub-agent 活动流:已移至 MessageList 中 inline 渲染(Phase 18.2,Trae Work 风格)
            历史:此区域之前独立在 AI 面板底部,但 Trae Work 的 subagent 卡片是 inline 在对话流中。
            为保持视觉一致性,所有 subagent 卡片现在统一在最后一条 AI 消息下方展示。 */}

          {/* 输入区 */}
          <MessageInput
            onSend={sendMessage}
            onStop={stop}
            isStreaming={isStreaming}
            // 2026-07-28 升级:placeholder 切换依据从 planMode 改为 ChatMode
            // - ChatMode.plan → placeholderPlan(只读分析提示)
            // - 其他(build/review/spec)→ placeholder(默认)
            placeholder={currentMode === 'plan' ? t('placeholderPlan') : t('placeholder')}
            sendLabel={t('send')}
            stopLabel={t('stop')}
            model={currentModel}
            onModelChange={setModel}
            modelLabel={t('model')}
          />

          {/* AI 主动提问弹窗:挂起对话,等用户回答后续流 */}
          <QuestionDialog question={pendingQuestion} onSubmit={sendAnswer} onSkip={skipQuestion} />
          {/* 工作区权限确认弹窗(2026-07-25 立,深度对标 Codex):
            用户绑定新工作区但 perm=null 时,WorkspaceSelector 写入 pendingPermissionSetup,
            这里弹 Dialog 让用户主动选择权限模式(完全访问/请求批准/替我审批),
            用户在弹窗中保存后:回写 activeWorkspace.mode + 清空 pendingPermissionSetup。 */}
          {pendingPermissionSetup && (
            <WorkspacePermissionDialog
              open={!!pendingPermissionSetup}
              onOpenChange={(open) => {
                if (!open) setPendingPermissionSetup(null)
              }}
              workspacePath={pendingPermissionSetup.path}
              workspaceName={pendingPermissionSetup.name}
              techStack={pendingPermissionSetup.techStack}
              onSaved={(perm) => {
                // 弹窗保存成功:回写 store.activeWorkspace.mode(已绑定 workspace 的 mode)
                if (activeWorkspace && activeWorkspace.path === perm.workspacePath) {
                  setActiveWorkspace({ ...activeWorkspace, mode: perm.mode })
                }
                setPendingPermissionSetup(null)
              }}
            />
          )}
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
          className={cn(
            'group absolute right-[-4px] top-3 bottom-3 z-20 w-2 cursor-col-resize outline-none',
            // 移动端浮窗全屏模式:隐藏拖拽手柄(全屏无需调整宽度)
            isMobile && floatMode && 'hidden',
          )}
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
    </>
  )
}

/**
 * WorkspaceNameSync 子组件(性能修复 2026-07-25)。
 *
 * 设计目的:把 usePathname 订阅从 AISidePanel 根下推到本子组件,
 * 避免每次路由切换 AISidePanel 整树重渲染(连带 MessageList /
 * MessageInput / ModelSelector 等重渲染)。
 *
 * - 内部订阅 usePathname + useEffect 拉取 workspace 项目名
 * - 通过 onNameChange callback 回传给父组件(setWorkspaceName)
 * - 渲染 null,无视觉开销
 * - 若 activeWorkspace 已绑定则跳过拉取(原逻辑保留)
 */
function WorkspaceNameSync({ onNameChange }: { onNameChange: (name: string | null) => void }) {
  const pathname = usePathname()

  React.useEffect(() => {
    if (!pathname) {
      onNameChange(null)
      return
    }
    const m = pathname.match(/^\/workspace\/([^/]+)/)
    if (!m) {
      onNameChange(null)
      return
    }
    // activeWorkspace 已绑定时跳过 URL 项目名拉取,避免无谓网络请求
    if (useAiPanelStore.getState().activeWorkspace) {
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
          onNameChange(res.data.project.name)
        } else {
          onNameChange(null)
        }
      } catch {
        if (!cancelled) onNameChange(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pathname, onNameChange])

  return null
}

export default AISidePanel
