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
 * 断点续传(片3,2026-10-21 起):本窗格的历史结算后同样走 `useResumeBranch`(其内部即
 * `autoResumeAfterHistory`),捕获/续接/收尾全部落在该窗格的 store 实例 —— 与根窗格同一份
 * 编排出口,不另写一套。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'

import { getConversation, getMessages } from '@ihui/api-client'
import { toast } from '@/components/common'
import { ImportProvenanceSlot } from '@/components/ai/import-source-banner'
import { MessageInput } from '@/components/chat/message-input'
import { MessageList } from '@/components/chat/message-list/MessageList'
import { QuestionDialog } from '@/components/chat/question-dialog'
import { useChat } from '@/hooks/use-chat'
import { useConversationPaneCache } from '@/hooks/use-conversation-pane-cache'
import { hydrateHistoryMessages } from '@/hooks/use-chat/history-message'
import { useResumeBranch } from '@/hooks/use-chat/resume-stream'
import { noteRuntimeCapabilities } from '@/hooks/use-chat/runtime-capabilities'
import { useApplyDiff } from '@/hooks/use-apply-diff'
import { judgePageAdvance } from '@/lib/pagination-stall'
import { parsePendingQuestion } from '@/lib/pending-question'
import { usePaneChatStore } from '@/stores/chat-pane-context'
import { usePaneModeStore } from '@/stores/mode'
import type { ImportProvenance } from '@ihui/shared/import-analysis'
import { readImportProvenance } from '@ihui/shared/import-analysis'

/** 「用场景分析」弹窗:与根窗格同一组件、同一懒加载边界(210 条模板正文 ≈493KB 不进窗格 chunk) */
const ImportAnalysisDialog = dynamic(
  () => import('@/components/ai/import-analysis-dialog').then((m) => m.ImportAnalysisDialog),
  { ssr: false },
)
/** 工具面板(tab 托盘):与根窗格同一组件、同一懒加载边界;展开态与数据面都按窗格走(片3) */
const AiSidePanelTools = dynamic(
  () => import('@/components/ai/ai-side-panel-tools').then((m) => m.AiSidePanelTools),
  { ssr: false },
)

export interface ChatPaneBodyProps {
  /** 布局树叶 id(= chat-panes 注册表键) */
  paneId: string
  /** 该窗格承载的会话 id(来自布局树) */
  conversationId: string
}

/**
 * 窗格侧 recentMessages 预填充判据(G-935 缺口B,与根主体 ai-side-panel.tsx:803-814 同口径)。
 * - 缓存命中不得覆盖(内存 LRU 比持久快照新);
 * - 仅 messages 为空时填,避免抹掉同会话重挂载保留的本地半截流;
 * - recentMessages 必须属于当前会话且 messages 是数组。
 */
export function shouldPrefillRecentMessages(
  state: {
    readonly messages: readonly unknown[]
    readonly recentMessages: { conversationId: string; messages: readonly unknown[] } | null
  },
  conversationId: string,
  cacheHit: boolean,
): boolean {
  return (
    !cacheHit &&
    state.messages.length === 0 &&
    state.recentMessages !== null &&
    state.recentMessages.conversationId === conversationId &&
    Array.isArray(state.recentMessages.messages)
  )
}

export function ChatPaneBody({ paneId, conversationId }: ChatPaneBodyProps) {
  const t = useTranslations('chat')
  const tcommon = useTranslations('common')
  const chatStore = usePaneChatStore()
  // 票60 普查批:模式档按窗格分家(此前直读根单例 ⇒ 切档把根窗格一起切走)
  const modeStore = usePaneModeStore()
  const currentMode = modeStore((s) => s.currentMode)
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
  // 「用场景分析」开合(与根窗格同判据:只有导入会话才有入口,自建会话不挂空壳弹窗)
  const [analysisOpen, setAnalysisOpen] = React.useState(false)
  const requestSeqRef = React.useRef(0)
  // P1-6 续接(片3,2026-10-21):与根主体共用同一份编排出口 useResumeBranch ——
  // 捕获/结算后续接/中止三条时序只在一处实现(§0.6),本窗格只负责在历史 effect 里挂三个点。
  const resume = useResumeBranch(chatStore, paneId, t)

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
    // G-935 缺口B:窗格 store 的 recentMessages(半截流快照)先回填,再捕获续接候选。
    // 根主体同口径(ai-side-panel.tsx:803-814);缓存命中不覆盖(内存 LRU 更新)。
    const currentStore = chatStore.getState()
    const recent = currentStore.recentMessages
    if (recent && shouldPrefillRecentMessages(currentStore, conversationId, cached !== null)) {
      chatStore.setState({
        messages: recent.messages,
        error: null,
      })
    }
    const localBefore = chatStore.getState().messages
    // 续接候选在远端快照覆盖 messages 之前捕获(未落库的本地助手消息不在快照里)
    resume.capture(conversationId)

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
        if (!cancelled && seq === requestSeqRef.current) {
          setLoadingHistory(false)
          // 历史结算之后才续接(覆盖前会把未落库的本地消息整条抹掉)
          resume.runAfterHistory(conversationId)
        }
      }
    })()

    return () => {
      cancelled = true
      resume.abort()
    }
  }, [conversationId, chatStore, readCache, writeCache, resetPager, resume])

  // #11 LRU 缓存同步(G-935 缺口B,与根主体 ai-side-panel.tsx:882-885 同一口径):
  // messages 变化(流式增量/新消息/续接回写)时同步回写本窗格缓存桶,
  // 切回或 reload(快照落盘后)拿到的是现值而不是历史基线。
  React.useEffect(() => {
    patchCache(conversationId, chatStore.getState().messages)
  }, [conversationId, messages, hasMoreHistory, patchCache, chatStore])

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
        // 票60 残余②(2026-10-21):与根窗格 ai-side-panel 同一表现 —— 此前非根窗格静默
        // 收起"加载更多"且无任何提示,用户读不出是失败,只当历史到底了。
        toast.error(tcommon('loadFailed'))
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
    // tcommon 是 next-intl 取词函数,按 ai-side-panel 同一口径不进依赖(取词函数恒同一引用)。
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tcommon 取词函数不进依赖
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
        {/* D28 补齐层:导入会话的来源交代 + 分析入口(与根窗格同一组件、同一显示条件;
            自建会话整块不渲染)。入口在片3 才接通 —— 弹窗草稿此前恒写根单例,点了不落本窗格。 */}
        {importProvenance && (
          <ImportProvenanceSlot
            provenance={importProvenance}
            onOpenAnalysis={() => setAnalysisOpen(true)}
          />
        )}
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

      {/* W10 工具面板(片3 接进非根窗格):与根窗格同一组件,tab 数据源/展开态都读本窗格 */}
      <AiSidePanelTools />

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

      {/* D28 补齐层:「用场景分析」弹窗(片3 闭合)—— 草稿经 usePaneChatStore 落**本窗格**输入框 */}
      {importProvenance && (
        <ImportAnalysisDialog
          open={analysisOpen}
          onOpenChange={setAnalysisOpen}
          source={importProvenance.source}
        />
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
