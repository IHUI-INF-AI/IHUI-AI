'use client'

import * as React from 'react'
import Image from 'next/image'
import { Sparkles, AlertCircle, Loader2, ChevronDown, ShieldCheck, ShieldAlert, Hand } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { ChatMessage } from '@/stores/chat'
import type { InlineDiffInfo } from '@/components/ai/types'
import { MarkdownStream } from '@/components/ai/markdown-stream'
import { ToolCallCard, deriveDiffInfo } from '@/components/ai/tool-call-card'
import { PromptTemplates } from '@/components/ai/prompt-templates'
import { cn } from '@/lib/utils'

/** 权限模式徽章(2026-07-25 深化,深度对标 Codex 透明性)
 * - AI 消息气泡的标签后追加一个轻量模式徽章
 * - 仅当 permissionMode !== 'default' 时显示(默认模式太多,无意义)
 * - accept-edits → 绿底 + ShieldCheck
 * - bypass-permissions → 琥珀底 + ShieldAlert(高风险)
 * - default → Hand(理论不会走到,兜底渲染) */
function PermissionModeBadge({ mode }: { mode: NonNullable<ChatMessage['permissionMode']> }) {
  const t = useTranslations('chat.permission')
  const config = {
    default: {
      icon: Hand,
      label: t('mode.ask'),
      cls: 'bg-muted text-muted-foreground',
      tip: t('mode.askDesc'),
    },
    'accept-edits': {
      icon: ShieldCheck,
      label: t('mode.auto'),
      cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
      tip: t('mode.autoDesc'),
    },
    'bypass-permissions': {
      icon: ShieldAlert,
      label: t('mode.full'),
      cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
      tip: t('mode.fullDesc'),
    },
  }[mode]
  const Icon = config.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-sm px-1 py-px text-[9px] font-medium',
        config.cls,
      )}
      title={config.tip}
      aria-label={config.tip}
    >
      <Icon className="h-2.5 w-2.5" aria-hidden="true" />
      {config.label}
    </span>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1">
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" />
    </div>
  )
}

function ReasoningBlock({ reasoning }: { reasoning: string }) {
  const t = useTranslations('chat')
  const [expanded, setExpanded] = React.useState(false)
  return (
    <div className="rounded-md border border-muted bg-muted/30">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronDown className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')} />
        {expanded ? t('hideReasoning') : t('showReasoning')}
      </button>
      {expanded && (
        <div className="bg-muted/30 px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap break-words">
          {reasoning}
        </div>
      )}
    </div>
  )
}

/** P0 流式性能优化(2026-07-23):抽取消息项组件 + React.memo,
 * 流式 token 只更新目标消息引用,其他消息引用不变 → 不触发重渲染 */
interface MessageItemProps {
  message: ChatMessage
  isLast: boolean
  isStreaming: boolean
  assistantLabel: string
  onApplyDiff?: (messageId: string, toolCallId: string, diffInfo: InlineDiffInfo) => Promise<void>
  onRejectDiff?: (messageId: string, toolCallId: string) => void
}

const MessageItem = React.memo(function MessageItem({
  message: m,
  isLast,
  isStreaming,
  assistantLabel,
  onApplyDiff,
  onRejectDiff,
}: MessageItemProps) {
  const t = useTranslations('chat')
  const isUser = m.role === 'user'
  const showTyping = !isUser && m.content === '' && isStreaming
  const streamingThis = !isUser && isStreaming && isLast

  return (
    <div className={cn('flex w-full gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-medium',
          isUser
            ? 'bg-primary text-primary-foreground'
            : m.error
              ? 'bg-destructive/15 text-destructive'
              : 'bg-muted text-muted-foreground',
        )}
      >
        {isUser ? (
          t('me')
        ) : m.error ? (
          <AlertCircle className="h-4 w-4" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
      </div>
      <div className={cn('flex max-w-[85%] flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
        {!isUser && (
          <span className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
            <span>{assistantLabel}</span>
            {/* 权限模式徽章(2026-07-25 深化,深度对标 Codex 透明性)
              - 记录 AI 响应生成时所使用的权限模式,便于用户事后回溯
              - 仅非 default 模式显示(默认模式太多,无信息量) */}
            {m.permissionMode && m.permissionMode !== 'default' && (
              <PermissionModeBadge mode={m.permissionMode} />
            )}
          </span>
        )}
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5',
            isUser
              ? 'rounded-br-sm bg-primary text-primary-foreground'
              : m.error
                ? 'rounded-bl-sm border border-destructive/30 bg-destructive/5 text-destructive'
                : 'rounded-bl-sm bg-muted text-muted-foreground',
          )}
        >
          {showTyping ? (
            <TypingIndicator />
          ) : isUser ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.content}</p>
          ) : (
            <div className="space-y-2">
              {m.reasoning && <ReasoningBlock reasoning={m.reasoning} />}
              {m.toolCalls?.map((tc) => {
                // edit_file/write_file:为 Accept/Reject 回调构造 diffInfo
                // 优先用 store 中的 tc.diffInfo,否则从 args 推导(与 ToolCallCard 内部逻辑一致)
                const effectiveDiffInfo =
                  tc.diffInfo ?? deriveDiffInfo(tc.toolName, tc.args) ?? undefined
                const hasDiff = !!effectiveDiffInfo

                // image_generation/summarize_artifacts:从 tc 显式字段或 result 推导 imageUrl/summaryData
                // 优先用 tc.image_url / tc.summary_data(SSE 推送已填充时),
                // 否则从 tc.result 兜底推导(适配旧后端不显式推 image_url 字段的场景)
                const tcResult =
                  tc.result && typeof tc.result === 'object'
                    ? (tc.result as Record<string, unknown>)
                    : null
                const effectiveImageUrl: string | undefined =
                  tc.image_url ||
                  (typeof tcResult?.image_url === 'string' ? tcResult.image_url : undefined) ||
                  (typeof tcResult?.imageUrl === 'string' ? tcResult.imageUrl : undefined)
                const effectiveSummaryData =
                  tc.summary_data ??
                  (tcResult &&
                  (tcResult.plans ||
                    tcResult.sources ||
                    tcResult.artifacts ||
                    tcResult.tool_calls_summary)
                    ? ({
                        plans: Array.isArray(tcResult.plans) ? tcResult.plans : undefined,
                        sources: Array.isArray(tcResult.sources) ? tcResult.sources : undefined,
                        artifacts: Array.isArray(tcResult.artifacts)
                          ? tcResult.artifacts
                          : undefined,
                        tool_calls_summary:
                          tcResult.tool_calls_summary &&
                          typeof tcResult.tool_calls_summary === 'object'
                            ? tcResult.tool_calls_summary
                            : undefined,
                      } as unknown as React.ComponentProps<typeof ToolCallCard>['summaryData'])
                    : undefined)

                return (
                  <ToolCallCard
                    key={tc.id}
                    toolName={tc.toolName}
                    args={tc.args}
                    result={tc.result}
                    status={tc.status}
                    duration={tc.duration}
                    error={tc.error}
                    iteration={tc.iteration}
                    diffInfo={tc.diffInfo}
                    applyStatus={tc.applyStatus}
                    applyError={tc.applyError}
                    repeated={tc.repeated}
                    imageUrl={effectiveImageUrl}
                    summaryData={effectiveSummaryData}
                    onApply={
                      hasDiff && onApplyDiff
                        ? () => onApplyDiff(m.id, tc.id, effectiveDiffInfo!)
                        : undefined
                    }
                    onReject={hasDiff && onRejectDiff ? () => onRejectDiff(m.id, tc.id) : undefined}
                  />
                )
              })}
              <MarkdownStream content={m.content} isStreaming={streamingThis} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

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
}

// #7 虚拟滚动配置(2026-07-25 立):消息数超过阈值时启用窗口化渲染
// - ESTIMATED_ITEM_HEIGHT:消息平均高度估计值,用于初始 padding 计算
// - VIRTUAL_THRESHOLD:超过此条数启用虚拟滚动(60 条以下全量渲染,保留流畅性)
// - BUFFER:上下各多渲染的缓冲条数,减少快速滚动时的白屏
// - heightMap:ResizeObserver 测量的真实高度映射,滚动时用真实累积高度精确定位
const ESTIMATED_ITEM_HEIGHT = 160
const VIRTUAL_THRESHOLD = 60
const BUFFER = 6
const TOP_LOAD_MORE_THRESHOLD = 60 // scrollTop < 60px 触发加载更多历史

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
}: MessageListProps) {
  const t = useTranslations('chat')
  const bottomRef = React.useRef<HTMLDivElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const lastContent = messages[messages.length - 1]?.content

  // #7 虚拟滚动状态
  const [visibleRange, setVisibleRange] = React.useState({ start: 0, end: VIRTUAL_THRESHOLD - 1 })
  // heightMap:messageId → 真实高度(px)。ResizeObserver 持续更新,用于精确计算累积 offset
  const heightMapRef = React.useRef<Map<string, number>>(new Map())
  // 是否在用户手动向上滚动(暂停自动滚动到底部,直到新消息到达或用户滚到底)
  const userScrolledUpRef = React.useRef(false)
  const prevMessagesLenRef = React.useRef(0)
  // #9 滚动 50ms 节流(2026-07-25 立,P0 流式性能优化):
  //  - scroll 事件高频触发,每次都重算虚拟滚动范围代价高
  //  - timestamp + setTimeout 节流到 50ms 一次,leading + trailing edge
  //  - 流式 token 触发的滚动会被合并,避免长输出时滚动卡顿
  const lastScrollTsRef = React.useRef(0)
  const scrollTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const enableVirtual = messages.length > VIRTUAL_THRESHOLD

  // 计算累积高度数组(用于精确定位可见范围 + padding)
  const computeCumulative = React.useCallback(() => {
    const map = heightMapRef.current
    let total = 0
    const offsets = new Array(messages.length + 1)
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      if (!msg) continue
      offsets[i] = total
      total += map.get(msg.id) ?? ESTIMATED_ITEM_HEIGHT
    }
    offsets[messages.length] = total
    return { offsets, total }
  }, [messages])

  const handleScroll = React.useCallback(() => {
    // #9 滚动 50ms 节流(2026-07-25 立,P0 流式性能优化):
    //  - leading edge:首次/上次执行已超过 50ms → 立即执行
    //  - trailing edge:50ms 内的后续调用 → 合并到最后一次,50ms 后兜底执行
    //  - 流式 token 高频追加时,滚动事件被合并到一帧一次,显著降低虚拟滚动重算开销
    const now = Date.now()
    const elapsed = now - lastScrollTsRef.current
    const performScroll = () => {
      lastScrollTsRef.current = Date.now()
      const el = containerRef.current
      if (!el) return

      // 标记用户是否向上滚动(远离底部)
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      userScrolledUpRef.current = distanceFromBottom > 120

      // #8 滚动到顶部触发加载更多历史
      if (el.scrollTop < TOP_LOAD_MORE_THRESHOLD && onLoadMoreHistory && hasMoreHistory && !loadingMoreHistory) {
        // 记录当前 scrollHeight,prepend 后恢复相对位置(保持视觉不跳动)
        const prevScrollHeight = el.scrollHeight
        const prevScrollTop = el.scrollTop
        onLoadMoreHistory()
        // 恢复滚动位置(prepend 后新内容在顶部,需要把 scrollTop 调整到对应位置)
        requestAnimationFrame(() => {
          if (containerRef.current) {
            const newScrollHeight = containerRef.current.scrollHeight
            containerRef.current.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight)
          }
        })
      }

      // #7 虚拟滚动:计算可见范围
      if (!enableVirtual) return
      const { offsets, total } = computeCumulative()
      if (total === 0) return

      // 二分查找找到 startIndex(第一个 offset > scrollTop - buffer*ESTIMATED)
      const scrollPos = el.scrollTop
      const viewportBottom = scrollPos + el.clientHeight
      let start = 0
      let lo = 0,
        hi = messages.length - 1
      while (lo <= hi) {
        const mid = (lo + hi) >> 1
        if (offsets[mid + 1] < scrollPos - BUFFER * ESTIMATED_ITEM_HEIGHT) lo = mid + 1
        else if (offsets[mid] > scrollPos) hi = mid - 1
        else {
          start = mid
          if (offsets[mid + 1] < scrollPos) lo = mid + 1
          else hi = mid - 1
        }
      }
      start = Math.max(0, start - BUFFER)

      // 找到 endIndex(第一个 offset > viewportBottom + buffer*ESTIMATED)
      let end = start
      while (end < messages.length - 1 && offsets[end + 1] < viewportBottom + BUFFER * ESTIMATED_ITEM_HEIGHT) {
        end++
      }
      end = Math.min(messages.length - 1, end + BUFFER)

      setVisibleRange((prev) => {
        if (prev.start === start && prev.end === end) return prev
        return { start, end }
      })
    }
    if (elapsed >= 50) {
      performScroll()
    } else {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
      scrollTimerRef.current = setTimeout(() => {
        scrollTimerRef.current = null
        performScroll()
      }, 50 - elapsed)
    }
  }, [enableVirtual, computeCumulative, messages.length, onLoadMoreHistory, hasMoreHistory, loadingMoreHistory])

  // #9 滚动节流 timer 清理:组件卸载时清掉 pending 的 trailing 执行
  React.useEffect(() => {
    return () => {
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current)
        scrollTimerRef.current = null
      }
    }
  }, [])

  // 自动滚动到底部(流式 token 到达 + 新消息)
  // - 用户手动向上滚动时不强制滚到底(避免打断阅读)
  // - 新消息到达(messages.length 增加)时强制滚到底
  React.useEffect(() => {
    const newLen = messages.length
    const isNewMessage = newLen > prevMessagesLenRef.current
    prevMessagesLenRef.current = newLen
    if (isNewMessage || !userScrolledUpRef.current) {
      const el = bottomRef.current
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages.length, lastContent, isStreaming])

  // #8 加载更多历史时保持滚动位置(handleScroll 内已处理)
  // #7 ResizeObserver 测量真实高度并触发重算可见范围
  const measureItem = React.useCallback((id: string) => (el: HTMLElement | null) => {
    const map = heightMapRef.current
    if (!el) {
      map.delete(id)
      return
    }
    const h = el.getBoundingClientRect().height
    const prev = map.get(id)
    if (prev !== h) {
      map.set(id, h)
      // 高度变化后重算可见范围(下一帧,避免布局抖动)
      requestAnimationFrame(() => handleScroll())
    }
  }, [handleScroll])

  // 消息列表重置(切换会话)时清空高度映射 + 重置可见范围
  React.useEffect(() => {
    if (messages.length === 0) {
      heightMapRef.current.clear()
      setVisibleRange({ start: 0, end: VIRTUAL_THRESHOLD - 1 })
      userScrolledUpRef.current = false
    } else if (messages.length <= VIRTUAL_THRESHOLD) {
      setVisibleRange({ start: 0, end: messages.length - 1 })
    }
  }, [messages.length])

  if (messages.length === 0) {
    // 空状态引导模板与附加栏 Popover 共用同一组 5 个核心模板(i18n key 一致)。
    // category 字段已废弃(PromptTemplates 不再分组),做减法移除。
    const templates = onTemplateSelect
      ? [
          { id: 'summary', name: t('tplSummary'), content: t('tplSummaryContent') },
          { id: 'translate', name: t('tplTranslate'), content: t('tplTranslateContent') },
          { id: 'explain', name: t('tplExplain'), content: t('tplExplainContent') },
          { id: 'code', name: t('tplCode'), content: t('tplCodeContent') },
          { id: 'polish', name: t('tplPolish'), content: t('tplPolishContent') },
        ]
      : []
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        {/* 与 LoginDialog / 全站统一:纯图标版 logo.png(蝴蝶结 + IHUI INF 弧形,无横向文字),非左上角位置统一资产。
            56px 适配小空状态,加 rounded-xl + select-none + priority + draggable=false 与品牌主视觉一致。 */}
        <Image
          src="/images/logo.png?v=20260719-unify"
          alt="IHUI AI"
          width={56}
          height={56}
          className="h-14 w-14 select-none rounded-xl"
          draggable={false}
          unoptimized
          priority
        />
        {isLoading && <Loader2 className="h-7 w-7 animate-spin" />}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{loadingLabel}</p>
        ) : (
          <div className="space-y-1">
            <p className="text-base font-medium">{emptyTitle}</p>
            <p className="max-w-xs text-sm text-muted-foreground">{emptyHint}</p>
          </div>
        )}
        {!isLoading && templates.length > 0 && (
          // 空状态使用 chips variant:水平胶囊按钮,与附加栏 Popover 视觉风格协调。
          <div className="w-full max-w-2xl">
            <PromptTemplates templates={templates} onSelect={onTemplateSelect!} variant="chips" />
          </div>
        )}
      </div>
    )
  }

  // #7 虚拟滚动:窗口化渲染,仅渲染可见范围 + buffer,用 padding 占位未渲染部分
  // - 非虚拟模式(消息数 <= VIRTUAL_THRESHOLD):全量渲染,保留原逻辑
  // - 虚拟模式:用 measureItem ref 测量真实高度,handleScroll 计算可见范围
  const renderItems = enableVirtual
    ? messages.slice(visibleRange.start, visibleRange.end + 1)
    : messages
  const offsets = enableVirtual ? computeCumulative().offsets : []
  const paddingTop = enableVirtual ? offsets[visibleRange.start] ?? 0 : 0
  const paddingBottom = enableVirtual
    ? Math.max(0, (offsets[messages.length] ?? 0) - (offsets[visibleRange.end + 1] ?? 0))
    : 0

  return (
    // 2026-07-21 AI 面板滚动条:加 hover-scroll 完全隐藏滚动条(不占布局空间),
    // 解决 bg-shell-panel 暗色背景下默认滚动条轨道透出深色的问题
    <div ref={containerRef} onScroll={handleScroll} className="hover-scroll h-full overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
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
            <div key={m.id} ref={enableVirtual ? measureItem(m.id) : undefined}>
              {/* P0 流式性能优化(2026-07-23):React.memo 避免非目标消息重渲染 */}
              <MessageItem
                message={m}
                isLast={realIdx === messages.length - 1}
                isStreaming={isStreaming}
                assistantLabel={assistantLabel}
                onApplyDiff={onApplyDiff}
                onRejectDiff={onRejectDiff}
              />
            </div>
          )
        })}
        {/* #7 虚拟滚动底部占位 */}
        {paddingBottom > 0 && <div style={{ height: paddingBottom, flexShrink: 0 }} />}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

export default MessageList
