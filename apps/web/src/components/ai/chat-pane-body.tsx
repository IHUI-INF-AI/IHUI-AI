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
 * 切换会话的 LRU 与翻页态走同一出口 `useConversationPaneCache`(键含窗格身份),
 * 导入来源横幅走同一组件 `ImportProvenanceSlot` —— 都是"接现成出口",本组件不另写一份。
 * 断点续传仍只在根主体(P1-6 的 pendingResume 取数面是单例 store,窗格化属后续票)。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { getConversation, getMessages } from '@ihui/api-client'
import { ImportProvenanceSlot } from '@/components/ai/import-source-banner'
import { MessageInput } from '@/components/chat/message-input'
import { MessageList } from '@/components/chat/message-list/MessageList'
import { QuestionDialog } from '@/components/chat/question-dialog'
import { useChat } from '@/hooks/use-chat'
import { useConversationPaneCache } from '@/hooks/use-conversation-pane-cache'
import { hydrateHistoryMessages } from '@/hooks/use-chat/history-message'
import { noteRuntimeCapabilities } from '@/hooks/use-chat/runtime-capabilities'
import { useApplyDiff } from '@/hooks/use-apply-diff'
import { judgePageAdvance } from '@/lib/pagination-stall'
import { parsePendingQuestion } from '@/lib/pending-question'
import { usePaneChatStore } from '@/stores/chat-pane-context'
import { useModeStore } from '@/stores/mode'
import type { ImportProvenance } from '@ihui/shared/import-analysis'
import { readImportProvenance } from '@ihui/shared/import-analysis'

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
  // 窗格化的会话缓存 + 翻页态(与根窗格同一出口,键含窗格身份 ⇒ 两窗格各走各的)
  const {
    read: readCache,
    write: writeCache,
    patch: patchCache,
    resetPager,
    oldestCursorRef,
    hasMoreHistory,
    setHasMoreHistory,
    loadingMoreHistory,
    setLoadingMoreHistory,
  } = useConversationPaneCache()

  const [loadingHistory, setLoadingHistory] = React.useState(false)
  const [importProvenance, setImportProvenance] = React.useState<ImportProvenance | null>(null)
  const requestSeqRef = React.useRef(0)

  React.useEffect(() => {
    const seq = ++requestSeqRef.current
    let cancelled = false
    const prevConversationId = chatStore.getState().conversationId
    const switching = prevConversationId !== conversationId
    // 命中本窗格缓存 ⇒ 同步恢复(不闪空列表、不进 loadingHistory),后台仍复核最新页;
    // 未命中才清空 —— 切到另一条会话时避免把上一窗格内容当成新会话的基线,
    // 同一会话重挂载则保留(可能是流式中途的本地消息),下面的守卫会防止覆盖。
    const cached = readCache(conversationId)
    const restoredMessages = cached
      ? cached.messages
      : switching
        ? []
        : chatStore.getState().messages
    chatStore.setState(
      switching
        ? { conversationId, messages: restoredMessages, error: null, isStreaming: false }
        : { conversationId, messages: restoredMessages, error: null },
    )
    setImportProvenance(null)
    resetPager(cached ? cached.oldestCursor : null, cached ? cached.hasMore : false)
    setLoadingHistory(cached === null)
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
        resetPager(msgRes.data.nextCursor, msgRes.data.hasMore)
        writeCache(conversationId, {
          messages: hydrated,
          hasMore: msgRes.data.hasMore,
          oldestCursor: msgRes.data.nextCursor,
        })
        const meta = convRes.data.conversation.metadata as { pendingQuestion?: unknown } | null
        noteRuntimeCapabilities(meta)
        const pending = parsePendingQuestion(meta?.pendingQuestion)
        if (pending) chatStore.getState().setPendingQuestion(pending)
        else chatStore.getState().clearPendingQuestion()
        // 导入来源必须等消息就位后再算(发言人/时间跨度是从正文现算的),与根窗格同一判据。
        const prov = readImportProvenance(convRes.data.conversation.metadata, hydrated)
        setImportProvenance(prov.kind === 'imported' ? prov.provenance : null)
      } catch {
        // 拉取失败保留当前消息,不阻塞输入
      } finally {
        if (!cancelled && seq === requestSeqRef.current) setLoadingHistory(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [conversationId, chatStore, readCache, writeCache, resetPager])

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
        resetPager(null, false)
        return
      }
      chatStore.setState((s) => ({ messages: [...older, ...s.messages] }))
      resetPager(res.data.nextCursor, res.data.hasMore)
      patchCache(conversationId, chatStore.getState().messages)
    } finally {
      setLoadingMoreHistory(false)
    }
  }, [
    conversationId,
    chatStore,
    oldestCursorRef,
    loadingMoreHistory,
    hasMoreHistory,
    patchCache,
    resetPager,
    setHasMoreHistory,
    setLoadingMoreHistory,
  ])

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden"
      data-chat-pane-body={paneId}
    >
      <div className="relative min-h-0 flex-1">
        {/* D28 补齐层:导入会话的来源交代(与根窗格同一组件、同一显示条件;自建会话整块不渲染) */}
        {importProvenance && <ImportProvenanceSlot provenance={importProvenance} />}
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
