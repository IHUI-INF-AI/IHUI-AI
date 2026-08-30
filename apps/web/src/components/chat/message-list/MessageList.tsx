'use client'

import * as React from 'react'
import { ArrowDown, ArrowUp, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { FallbackEvent } from '@ihui/api-client'
import type { ChatMessage } from '@/stores/chat'
import type { InlineDiffInfo, SubAgentActivity } from '@/components/ai/types'
import {
  MessageContextMenu,
  MessageSearchBar,
} from '@/components/ai/progress-sections/message-context-menu'
import { useProgressJumpStore } from '@/stores/progress-jump-store'
import { useChatStore } from '@/stores/chat'

import { MessageItem } from './MessageItem'
import { EmptyState } from './EmptyState'
import { FallbackBanner } from './FallbackBanner'
import { useMessageListScroll } from './use-message-list-scroll'
import { useMessageListDerivations } from './use-message-list-derivations'
import { useMessageListSearch } from './use-message-list-search'
import { useMessageListContextMenu } from './use-message-list-context-menu'
import { regenerateMessage, branchMessage } from '@/hooks/use-chat/send-message'
import { ToolApprovalDialog } from '@/components/ai/tool-approval-dialog'

interface MessageListProps {
  messages: ChatMessage[]
  isStreaming: boolean
  isLoading?: boolean
  emptyTitle: string
  emptyHint: string
  assistantLabel: string
  loadingLabel?: string
  onTemplateSelect?: (content: string) => void
  /** Inline Diff Accept 回调:把 edit_file/write_file 的 diff 写入文件系统
   *  2026-07-22 立,P3 Inline Diff 卡片 Apply 工作流 */
  onApplyDiff?: (messageId: string, toolCallId: string, diffInfo: InlineDiffInfo) => Promise<void>
  /** Inline Diff Reject 回调:纯前端标记为 rejected */
  onRejectDiff?: (messageId: string, toolCallId: string) => void
  /** #8 是否还有更早的历史消息可加载(滚动到顶部时触发 onLoadMoreHistory) */
  hasMoreHistory?: boolean
  /** #8 是否正在加载更早的历史消息(显示顶部 loading 指示器) */
  loadingMoreHistory?: boolean
  /** #8 滚动到顶部时触发加载更多历史消息 */
  onLoadMoreHistory?: () => void
  /** P4-2: fallback 通知(主模型失败切换到备用模型时非 null,展示横幅) */
  fallbackNotice?: FallbackEvent | null
  /** P4-2: 清除 fallback 通知(用户点击横幅关闭按钮时调用) */
  onClearFallbackNotice?: () => void
  /** Phase 18.2: SubAgent 活动列表(2026-07-28,可选覆盖 useChatStore 内部读取)
   *  Trae Work 风格 inline 渲染在最后一条 AI 消息下方(而非 AI 面板底部)。
   *  不传则从 useChatStore 内部派生 */
  subAgentActivities?: SubAgentActivity[]
  /** Phase 18.4: step budget 显示(从 store 派生,目前用固定 60 上限) */
  stepBudget?: { used: number; total: number }
  /** 代码块默认折叠行数，<=0 表示不折叠 */
  codeCollapseLines?: number
}

export function MessageList({
  messages,
  isStreaming,
  isLoading,
  emptyTitle,
  emptyHint,
  assistantLabel,
  loadingLabel,
  onTemplateSelect,
  onApplyDiff,
  onRejectDiff,
  hasMoreHistory,
  loadingMoreHistory,
  onLoadMoreHistory,
  fallbackNotice,
  onClearFallbackNotice,
  subAgentActivities: subAgentActivitiesProp,
  codeCollapseLines,
}: MessageListProps) {
  const t = useTranslations('chat')

  const scroll = useMessageListScroll({
    messages,
    isStreaming,
    hasMoreHistory,
    loadingMoreHistory,
    onLoadMoreHistory,
  })
  const {
    containerRef,
    bottomRef,
    enableVirtual,
    visibleRange,
    computeCumulative,
    measureItem,
    handleScroll,
    handleJumpToLatest,
    markUserIntent,
    userScrolledUp,
    userScrolledToTop,
    setUserScrolledToTop,
    focusedIndex,
  } = scroll

  useMessageListDerivations({ messages, isStreaming, subAgentActivitiesProp, t })

  const search = useMessageListSearch({ messages, containerRef })
  const {
    searchBarVisible,
    searchResultIds,
    searchCurrentIndex,
    searchResultSet,
    searchCurrentId,
    handleSearch,
    handleSearchNavigate,
    handleSearchClose,
    openSearch,
  } = search

  const { contextMenu, handleContextMenuAction } = useMessageListContextMenu({
    t,
    onRequestSearch: openSearch,
  })

  // ── Phase 19 集成(2026-07-28 立)────────────────────────────────────
  // ProgressJumpStore:PlanStep ↔ Message 双向跳转 + 联动高亮
  const pendingJump = useProgressJumpStore((s) => s.pendingJumpToMessage)
  const highlightedMessageId = useProgressJumpStore((s) => s.highlightedMessageId)
  const messageToPlanStepIds = useProgressJumpStore((s) => s.messageToPlanStepIds)
  const flashHighlight = useProgressJumpStore((s) => s.flashHighlight)
  const clearPendingJump = useProgressJumpStore((s) => s.clearPendingJump)
  const setHoveredMessage = useProgressJumpStore((s) => s.setHoveredMessage)
  const setHoveredPlanStep = useProgressJumpStore((s) => s.setHoveredPlanStep)
  // 已处理的 pendingJump nonce(防止同一次 jump 重复触发 scrollIntoView)
  const handledJumpNonceRef = React.useRef<number>(-1)

  // Phase 19(2026-07-28 立):反向联动 — hover AI 消息时同步高亮 plan step
  // messageToPlanStepIds 由 pane 的 linkPlanStepToMessage 维护,本组件只读
  const handleMessageHover = React.useCallback(
    (messageId: string, planStepId: string | null) => {
      setHoveredMessage(planStepId ? messageId : null)
      setHoveredPlanStep(planStepId)
    },
    [setHoveredMessage, setHoveredPlanStep],
  )

  // 监听 pendingJump:滚动到目标消息 + flashHighlight
  // PlanStepItem 点击 → ProgressJumpStore.requestJumpToMessage(id) → 此 effect 响应
  React.useEffect(() => {
    if (!pendingJump) return
    if (handledJumpNonceRef.current === pendingJump.nonce) return
    handledJumpNonceRef.current = pendingJump.nonce
    const el = containerRef.current?.querySelector(
      `[data-message-id="${pendingJump.messageId}"]`,
    ) as HTMLElement | null
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    // 即便目标暂未渲染也调用 flashHighlight(目标出现时会读到高亮状态)
    flashHighlight(pendingJump.messageId)
    // 600ms 后清空 pending(让 UI 跳转完成后回归稳态)
    const timer = window.setTimeout(() => {
      clearPendingJump()
    }, 600)
    return () => window.clearTimeout(timer)
  }, [pendingJump, flashHighlight, clearPendingJump, containerRef])

  // 监听自定义事件 'ihui:scroll-to-message' (agent-task-progress-pane 兼容路径)
  React.useEffect(() => {
    const onScrollTo = (e: Event) => {
      const detail = (e as CustomEvent<{ messageId: string }>).detail
      if (!detail?.messageId) return
      const el = containerRef.current?.querySelector(
        `[data-message-id="${detail.messageId}"]`,
      ) as HTMLElement | null
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      flashHighlight(detail.messageId)
    }
    window.addEventListener('ihui:scroll-to-message', onScrollTo as EventListener)
    return () => window.removeEventListener('ihui:scroll-to-message', onScrollTo as EventListener)
  }, [flashHighlight, containerRef])

  // 2026-08-30 立:重新生成 / 分支事件监听(MessageItem 按钮 + 右键菜单派发)。
  // 完整闭环在 send-message.ts 的 regenerateMessage / branchMessage(复用既有流式发送逻辑)。
  React.useEffect(() => {
    const onRegenerate = (e: Event) => {
      const detail = (e as CustomEvent<{ messageId: string }>).detail
      if (!detail?.messageId) return
      void regenerateMessage(detail.messageId)
    }
    const onBranch = (e: Event) => {
      const detail = (e as CustomEvent<{ messageId: string }>).detail
      if (!detail?.messageId) return
      void branchMessage(detail.messageId)
    }
    window.addEventListener('ihui:regenerate-message', onRegenerate as EventListener)
    window.addEventListener('ihui:branch-message', onBranch as EventListener)
    return () => {
      window.removeEventListener('ihui:regenerate-message', onRegenerate as EventListener)
      window.removeEventListener('ihui:branch-message', onBranch as EventListener)
    }
  }, [])

  // Trae Work 对齐(2026-07-28):timeline 事件可点击跳转到对话流
  // 监听 planStepId / toolCallId 自定义事件 → 翻译为 messageId → 派发 ihui:scroll-to-message
  React.useEffect(() => {
    const scrollToMessage = (messageId: string): void => {
      window.dispatchEvent(new CustomEvent('ihui:scroll-to-message', { detail: { messageId } }))
    }
    const onPlanStep = (e: Event) => {
      const detail = (e as CustomEvent<{ planStepId: string }>).detail
      if (!detail?.planStepId) return
      const messageId = useProgressJumpStore.getState().planStepToMessageId[detail.planStepId]
      if (messageId) scrollToMessage(messageId)
    }
    const onToolCall = (e: Event) => {
      const detail = (e as CustomEvent<{ toolCallId: string }>).detail
      if (!detail?.toolCallId) return
      const messages = useChatStore.getState().messages
      const found = messages.find((m) => m.toolCalls?.some((tc) => tc.id === detail.toolCallId))
      if (found) scrollToMessage(found.id)
    }
    window.addEventListener('ihui:scroll-to-plan-step', onPlanStep as EventListener)
    window.addEventListener('ihui:scroll-to-tool-call', onToolCall as EventListener)
    return () => {
      window.removeEventListener('ihui:scroll-to-plan-step', onPlanStep as EventListener)
      window.removeEventListener('ihui:scroll-to-tool-call', onToolCall as EventListener)
    }
  }, [])

  if (messages.length === 0) {
    return (
      <EmptyState
        isLoading={isLoading}
        loadingLabel={loadingLabel}
        emptyTitle={emptyTitle}
        emptyHint={emptyHint}
        onTemplateSelect={onTemplateSelect}
        t={t}
      />
    )
  }

  // #7 虚拟滚动:窗口化渲染,仅渲染可见范围 + buffer,用 padding 占位未渲染部分
  // - 非虚拟模式(消息数 <= VIRTUAL_THRESHOLD):全量渲染,保留原逻辑
  // - 虚拟模式:用 measureItem ref 测量真实高度,handleScroll 计算可见范围
  const renderItems = enableVirtual
    ? messages.slice(visibleRange.start, visibleRange.end + 1)
    : messages

  const offsets = enableVirtual ? computeCumulative().offsets : []
  const paddingTop = enableVirtual ? (offsets[visibleRange.start] ?? 0) : 0
  const paddingBottom = enableVirtual
    ? Math.max(0, (offsets[messages.length] ?? 0) - (offsets[visibleRange.end + 1] ?? 0))
    : 0

  // 2026-08-16 移除:DEBUG useEffect 在 early return 之后调用(违反 Rules of Hooks,
  // lint error),且 console.log 为调试残留——删除,虚拟滚动 padding 信息无需打印。

  // 单一整合对话流视图(2026-07-31 立,彻底整合,对标 Trae/Codex 单一对话流)
  // - 移除 tablist 切换(对话流/时间线/全部 三 tab)
  // - 移除独立时间线面板(对话流已内联工具调用/子代理/计划等,时间线是冗余汇总)
  // - 只保留对话流一个视图,工具调用/子代理/思考过程已内联在消息气泡内
  const inlinePanelNode = (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      onWheel={markUserIntent}
      onTouchMove={markUserIntent}
      id="message-list-panel-inline"
      role="tabpanel"
      className="hover-scroll min-h-0 h-full flex-1 overflow-y-auto"
      data-testid="message-list-inline-panel"
    >
      {/* 2026-08-29:底部留白去掉(py-6 → pt-6)— 最后一条消息贴合滚动容器底部,
          顶部 pt-6 保留,呼吸空间由消息项自身间距提供 */}
      <div className="mx-auto flex max-w-3xl flex-col gap-0.5 px-4 pt-6">
        {/* P4-2: fallback 通知横幅(主模型失败切换到备用模型时展示,amber 警告色) */}
        {fallbackNotice && (
          <FallbackBanner
            fallbackNotice={fallbackNotice}
            onClearFallbackNotice={onClearFallbackNotice}
            t={t}
          />
        )}
        {/* #8 顶部加载更多历史指示器 */}
        {loadingMoreHistory && (
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t('loading')}
          </div>
        )}
        {/* #7 虚拟滚动顶部占位(未渲染消息的高度填充) */}
        {paddingTop > 0 && <div style={{ height: paddingTop, flexShrink: 0 }} />}
        {renderItems.map((m, idx) => {
          const realIdx = enableVirtual ? visibleRange.start + idx : idx
          return (
            <React.Fragment key={m.id}>
              <div ref={enableVirtual ? measureItem(m.id) : undefined}>
                {/* P0 流式性能优化(2026-07-23):React.memo 避免非目标消息重渲染 */}
                <MessageItem
                  message={m}
                  isLast={realIdx === messages.length - 1}
                  isStreaming={isStreaming}
                  assistantLabel={assistantLabel}
                  onApplyDiff={onApplyDiff}
                  onRejectDiff={onRejectDiff}
                  isHighlighted={highlightedMessageId === m.id}
                  isFocused={focusedIndex === realIdx}
                  linkedPlanStepId={messageToPlanStepIds[m.id]?.[0] ?? null}
                  onMessageHover={handleMessageHover}
                  isSearchMatch={searchResultSet.has(m.id)}
                  isSearchCurrent={searchCurrentId === m.id}
                  onContextMenu={(e) => {
                    contextMenu.setData(m)
                    contextMenu.contextMenuHandlers.onContextMenu(e)
                  }}
                  codeCollapseLines={codeCollapseLines}
                />
                {/* Phase 19: 最后一个 assistant 消息下挂载 PlanStepsCard + SubAgentTaskTree
                  2026-08-01 Phase 4d:消息级 inline 后,仅当消息级数据为空时显示全局块(降级兼容旧后端)
                  2026-08-02 隐藏:对话流底部不再渲染 PlanStepsCard/SubAgentTaskTree(冗余可视化,与 Trae Codex 简洁风格不一致)
                  功能保留在右侧 AI 面板(PlanStepsCard + TimelineTab 独立入口) */}
              </div>
            </React.Fragment>
          )
        })}
        {/* #7 虚拟滚动底部占位 */}
        {paddingBottom > 0 && (
          <div
            style={{ height: paddingBottom, flexShrink: 0 }}
            data-testid="virtual-scroll-padding-bottom"
          />
        )}
        {/* 2026-07-31 立,AI 对话可视化深度接入:TimelineTab inline 到对话底部
          - 显示完整时间线事件流(plan/subagent/tool/thinking/question/reference)
          - 实时刷新(useTimelineStore 响应式)
          - 类型筛选 + 搜索 + 状态计数 + Markdown 导出
          - 仅当有事件时显示(无事件空状态折叠,避免污染空对话)
          - 用 bg 色对比替代 border-t 分割线(AGENTS.md §4 禁止分割线)
          2026-08-02 隐藏:对话流底部不再渲染 inline-timeline(冗余可视化,与 Trae Codex 简洁风格不一致)
          功能保留在右侧 AI 面板的 TimelineTab 独立入口 */}
        <div ref={bottomRef} />
      </div>
    </div>
  )

  return (
    <div className="flex h-full flex-col">
      <MessageSearchBar
        visible={searchBarVisible}
        onClose={handleSearchClose}
        onSearch={handleSearch}
        resultCount={searchResultIds.length}
        currentIndex={searchCurrentIndex}
        onNavigate={handleSearchNavigate}
      />
      {userScrolledToTop && messages.length > 0 && (
        <button
          type="button"
          onClick={() => {
            const el = containerRef.current
            if (el) el.scrollTo({ top: 0, behavior: 'smooth' })
            setUserScrolledToTop(false)
          }}
          data-testid="message-list-jump-top"
          aria-label={t('jumpToTop') === 'jumpToTop' ? 'Jump to top' : t('jumpToTop')}
          className="pointer-events-auto absolute top-4 left-1/2 z-20 -translate-x-1/2 inline-flex items-center justify-center h-7 w-7 rounded-lg border border-border bg-background/95 shadow-md backdrop-blur transition-colors hover:bg-accent"
        >
          <ArrowUp className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
      {inlinePanelNode}
      {userScrolledUp && messages.length > 0 && (
        <button
          type="button"
          onClick={handleJumpToLatest}
          data-testid="message-list-jump-latest"
          aria-label={t('jumpToLatest') === 'jumpToLatest' ? 'Jump to latest' : t('jumpToLatest')}
          className="pointer-events-auto absolute bottom-4 left-1/2 z-20 -translate-x-1/2 inline-flex items-center justify-center h-7 w-7 rounded-lg border border-border bg-background/95 shadow-md backdrop-blur transition-colors hover:bg-accent"
        >
          <ArrowDown className="h-3.5 w-3.5" aria-hidden />
          {isStreaming && (
            <span
              data-testid="message-list-jump-latest-dot"
              className="ml-0.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500"
              aria-hidden
            />
          )}
        </button>
      )}
      {/* Phase 19: MessageContextMenu(全局单实例,visible/position 由 hook 控制) */}
      <MessageContextMenu
        visible={contextMenu.visible}
        position={contextMenu.position}
        items={contextMenu.items}
        onAction={(action) => {
          void handleContextMenuAction(action)
        }}
        onClose={contextMenu.close}
        data-testid="message-list-context-menu"
      />
      {/* 工具调用审批弹窗(2026-08-30 立):高危工具执行前请求用户批准/拒绝。
          全局单实例,通过 EventSource 订阅 tool-approval SSE 事件自驱动弹窗。 */}
      <ToolApprovalDialog />
    </div>
  )
}

export default MessageList
