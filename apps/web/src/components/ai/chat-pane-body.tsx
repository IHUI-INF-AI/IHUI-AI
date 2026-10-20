// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 票60 步序四(2026-10-20):非根窗格的聊天主体。
 *
 * 根窗格仍由 AISidePanel 的单例主体承载(全局会话/侧栏状态在那一份上);
 * 非根窗格各自挂 ChatPaneProvider + 本组件,读写都落在该窗格的独立 chat store。
 *
 * 历史加载只覆盖首屏 + 向上翻页(与根窗格同一 getMessages keyset 通道);
 * 根窗格那套 LRU 缓存 / 断点续传 / 导入来源横幅仍留在 AISidePanel,本组件不复制。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { getConversation, getMessages } from '@ihui/api-client'
import { MessageInput } from '@/components/chat/message-input'
import { MessageList } from '@/components/chat/message-list/MessageList'
import { QuestionDialog } from '@/components/chat/question-dialog'
import { useChat } from '@/hooks/use-chat'
import { hydrateHistoryMessages } from '@/hooks/use-chat/history-message'
import { noteRuntimeCapabilities } from '@/hooks/use-chat/runtime-capabilities'
import { useApplyDiff } from '@/hooks/use-apply-diff'
import { judgePageAdvance } from '@/lib/pagination-stall'
import { parsePendingQuestion } from '@/lib/pending-question'
import { usePaneChatStore } from '@/stores/chat-pane-context'
import { useModeStore } from '@/stores/mode'

export interface ChatPaneBodyProps {
  /** 布局树叶 id(= chat-panes 注册表键) */
  paneId: string
  /** 该窗格承载的会话 id(来自布局树) */
  conversationId: string
}

export function ChatPaneBody({ paneId, conversationId }: ChatPaneBodyProps) {
  const t = useTranslations('chat')
  const chatStore = usePaneChatStore()
  const currentMode = useModeStore((s) => s.currentMode)
  const {
    messages,
    isStreaming,
    currentModel,
    pendingQuestion,
    sendMessage,
    sendAnswer,
    skipQuestion,
    stop,
    setModel,
  } = useChat()
  const { applyDiff, rejectDiff, applyAllDiffs, rejectAllDiffs, applyDiffSelection } =
    useApplyDiff()
  const subAgentActivities = chatStore((s) => s.subAgentActivities)

  const [loadingHistory, setLoadingHistory] = React.useState(false)
  const [loadingMoreHistory, setLoadingMoreHistory] = React.useState(false)
  const [hasMoreHistory, setHasMoreHistory] = React.useState(false)
  const oldestCursorRef = React.useRef<string | null>(null)
  const requestSeqRef = React.useRef(0)

  React.useEffect(() => {
    const seq = ++requestSeqRef.current
    let cancelled = false
    const prevConversationId = chatStore.getState().conversationId
    // 切到另一条会话先清空旧消息,避免把上一窗格内容当成新会话的基线;
    // 同一会话重挂载则保留(可能是流式中途的本地消息),下面的守卫会防止覆盖。
    chatStore.setState(
      prevConversationId === conversationId
        ? { conversationId, error: null }
        : { conversationId, messages: [], error: null, isStreaming: false },
    )
    setLoadingHistory(true)
    setHasMoreHistory(false)
    oldestCursorRef.current = null
    const localBefore = chatStore.getState().messages

    void (async () => {
      try {
        const [convRes, msgRes] = await Promise.all([
          getConversation(conversationId),
          getMessages(conversationId, { direction: 'initial', pageSize: 50 }),
        ])
        if (cancelled || seq !== requestSeqRef.current) return
        if (!convRes.success || !msgRes.success) return
        const hydrated = hydrateHistoryMessages(msgRes.data.messages)
        // 拉取期间窗格内已有本地写入(流式首帧/新消息)时不覆盖。
        if (chatStore.getState().messages === localBefore) {
          chatStore.setState({ messages: hydrated, error: null })
        }
        oldestCursorRef.current = msgRes.data.nextCursor
        setHasMoreHistory(msgRes.data.hasMore)
        const meta = convRes.data.conversation.metadata as { pendingQuestion?: unknown } | null
        noteRuntimeCapabilities(meta)
        const pending = parsePendingQuestion(meta?.pendingQuestion)
        if (pending) chatStore.getState().setPendingQuestion(pending)
        else chatStore.getState().clearPendingQuestion()
      } catch {
        // 拉取失败保留当前消息,不阻塞输入
      } finally {
        if (!cancelled && seq === requestSeqRef.current) setLoadingHistory(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [conversationId, chatStore])

  const handleLoadMoreHistory = React.useCallback(async () => {
    const cursor = oldestCursorRef.current
    if (!cursor || loadingMoreHistory || !hasMoreHistory) return
    setLoadingMoreHistory(true)
    try {
      const res = await getMessages(conversationId, { cursor, direction: 'older', pageSize: 50 })
      if (!res.success) return
      const older = hydrateHistoryMessages(res.data.messages)
      const advance = judgePageAdvance({
        requestCursor: cursor,
        responseCursor: res.data.nextCursor,
        responseHasMore: res.data.hasMore,
        rows: older,
      })
      if (advance.retryable) {
        setHasMoreHistory(false)
        return
      }
      if (older.length === 0) {
        setHasMoreHistory(false)
        oldestCursorRef.current = null
        return
      }
      chatStore.setState((s) => ({ messages: [...older, ...s.messages] }))
      oldestCursorRef.current = res.data.nextCursor
      setHasMoreHistory(res.data.hasMore)
    } finally {
      setLoadingMoreHistory(false)
    }
  }, [conversationId, chatStore, loadingMoreHistory, hasMoreHistory])

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden"
      data-chat-pane-body={paneId}
    >
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
          onApplyDiff={applyDiff}
          onRejectDiff={rejectDiff}
          onApplyAllDiffs={applyAllDiffs}
          onRejectAllDiffs={rejectAllDiffs}
          onApplyPartialDiff={applyDiffSelection}
          onTemplateSelect={(content) => chatStore.setState({ draftInput: content })}
          subAgentActivities={subAgentActivities}
          stepBudget={
            subAgentActivities.length > 0
              ? {
                  used: subAgentActivities.reduce((sum, a) => sum + a.completedSteps.length, 0),
                  total: 60,
                }
              : undefined
          }
        />
      </div>

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
      />

      <QuestionDialog question={pendingQuestion} onSubmit={sendAnswer} onSkip={skipQuestion} />
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
