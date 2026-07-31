'use client'

import * as React from 'react'
import Image from 'next/image'
import {
  Sparkles,
  AlertCircle,
  Loader2,
  ChevronDown,
  ShieldCheck,
  ShieldAlert,
  Hand,
  Copy,
  Check,
  RefreshCw,
  ArrowDown,
  Search,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { FallbackEvent } from '@ihui/api-client'

import type { ChatMessage } from '@/stores/chat'
import type { InlineDiffInfo, SubAgentActivity } from '@/components/ai/types'
import { MarkdownStream } from '@/components/ai/markdown-stream'
import { ToolCallCard, deriveDiffInfo } from '@/components/ai/tool-call-card'
import { PromptTemplates } from '@/components/ai/prompt-templates'
import { CompressionDivider } from '@/components/ai/progress-sections/compression-divider'
import { SubAgentTaskTree } from '@/components/ai/progress-sections/sub-agent-task-tree'
import { PlanStepsCard } from '@/components/ai/progress-sections/plan-steps-card'
import {
  MessageContextMenu,
  MessageSearchBar,
  plainTextForClipboard,
  normalizeMarkdown,
} from '@/components/ai/progress-sections/message-context-menu'
import { useProgressJumpStore } from '@/stores/progress-jump-store'
import { useTimelineStore, type TimelineEvent } from '@/stores/timeline-store'
import { useChatStore } from '@/stores/chat'
import type { PlanStep } from '@/hooks/use-agent-progress'
import { useContextMenu, type ContextMenuAction } from '@/hooks/use-context-menu'
import { searchMessages } from '@/lib/message-search'
import { toast } from '@/components/common'
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

function ReasoningBlock({
  reasoning,
  expanded: controlledExpanded,
  onToggle,
}: {
  reasoning: string
  /** 受控的展开状态(2026-07-28 立):为 undefined 时回退到内部 state,保证向后兼容 */
  expanded?: boolean
  /** 切换回调(2026-07-28 立):由父组件(MsgItem)统一管理 state,便于键盘 Enter 联动 */
  onToggle?: () => void
}) {
  const t = useTranslations('chat')
  const [internalExpanded, setInternalExpanded] = React.useState(false)
  // 受控/非受控模式:有 expanded prop 时用受控,否则用内部 state
  const expanded = controlledExpanded ?? internalExpanded
  const handleToggle = onToggle ?? (() => setInternalExpanded((prev) => !prev))
  return (
    <div className="rounded-md border border-muted bg-muted/30">
      <button
        type="button"
        onClick={handleToggle}
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

/** 把消息 createdAt 格式化为"今天 HH:MM / MM-DD HH:MM" 风格 footer 时间戳(2026-07-28 立)
 *  - hover 消息气泡时在 footer 显示完整时间,便于用户回溯精确时刻
 *  - 与 timeline-event.tsx 内的 formatRelativeTime 互为补充:相对时间用于时间线,绝对时间用于消息气泡 */
function formatMessageTimestamp(createdAt: number): string {
  const d = new Date(createdAt)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  if (sameDay) return `${hh}:${mm}`
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mo}-${dd} ${hh}:${mm}`
}

/** P0 流式性能优化(2026-07-23):抽取消息项组件 + React.memo,
 * 流式 token 只更新目标消息引用,其他消息引用不变 → 不触发重渲染
 * 2026-07-28 深化(深度对标 Trae Work):hover 快捷操作 + 错误重试 + 时间戳 footer */
interface MessageItemProps {
  message: ChatMessage
  isLast: boolean
  isStreaming: boolean
  assistantLabel: string
  onApplyDiff?: (messageId: string, toolCallId: string, diffInfo: InlineDiffInfo) => Promise<void>
  onRejectDiff?: (messageId: string, toolCallId: string) => void
  isHighlighted?: boolean
  isHovered?: boolean
  isFocused?: boolean
  onContextMenu?: (e: React.MouseEvent) => void
  linkedPlanStepId?: string | null
  onMessageHover?: (messageId: string, planStepId: string | null) => void
  /** Phase 23: 搜索匹配的消息(ring-1 ring-yellow-400/40) */
  isSearchMatch?: boolean
  /** Phase 23: 搜索当前定位的消息(ring-2 ring-yellow-400) */
  isSearchCurrent?: boolean
}

const MessageItem = React.memo(function MessageItem({
  message: m,
  isLast,
  isStreaming,
  assistantLabel,
  onApplyDiff,
  onRejectDiff,
  isHighlighted = false,
  isHovered = false,
  isFocused = false,
  onContextMenu,
  linkedPlanStepId = null,
  onMessageHover,
  isSearchMatch = false,
  isSearchCurrent = false,
}: MessageItemProps) {
  const t = useTranslations('chat')
  const isUser = m.role === 'user'
  const showTyping = !isUser && m.content === '' && isStreaming
  const streamingThis = !isUser && isStreaming && isLast
  // Copy 按钮短暂"已复制"状态(2026-07-28 立),2s 后自动隐藏
  const [copied, setCopied] = React.useState(false)
  const copyTimerRef = React.useRef<number | null>(null)
  // 本地 hover 状态(2026-07-28 增补):用于驱动 Copy 按钮显隐,
  // 与 ProgressJumpStore 的 isHovered(跨组件 plan step 联动)解耦,
  // 保证仅本地鼠标移入气泡也能看到 Copy 按钮(无需 linkPlanStepToMessage)
  const [localHover, setLocalHover] = React.useState(false)
  // 2026-07-28 立:Reasoning 折叠状态(2026-07-28 抽出为独立 state,供外部事件如键盘 Enter 切换)
  // 默认 false(折叠),点击展开按钮 / 收到 'ihui:toggle-reasoning' 事件时切换
  const [reasoningExpanded, setReasoningExpanded] = React.useState(false)
  // 监听全局 'ihui:toggle-reasoning' 事件:键盘 Enter 聚焦消息触发,只响应本条消息
  React.useEffect(() => {
    if (!m.reasoning) return
    const onToggle = (e: Event) => {
      const detail = (e as CustomEvent<{ messageId: string }>).detail
      if (detail?.messageId !== m.id) return
      setReasoningExpanded((prev) => !prev)
    }
    window.addEventListener('ihui:toggle-reasoning', onToggle as EventListener)
    return () => window.removeEventListener('ihui:toggle-reasoning', onToggle as EventListener)
  }, [m.id, m.reasoning])

  const handleCopy = React.useCallback(
    async (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation()
      e.preventDefault()
      const text = isUser ? m.content : plainTextForClipboard(m.content) // assistant 内容用简化纯文本(与右键菜单行为一致)
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text)
        } else {
          // 兜底:旧浏览器无 Clipboard API → 用临时 textarea
          const ta = document.createElement('textarea')
          ta.value = text
          ta.setAttribute('readonly', '')
          ta.style.position = 'absolute'
          ta.style.left = '-9999px'
          document.body.appendChild(ta)
          ta.select()
          document.execCommand('copy')
          document.body.removeChild(ta)
        }
        setCopied(true)
        // 用 i18n key(chat.copy/copied),缺失时回退到英文(任务约束:不硬编码中文)
        const successLabel = t('copied') === 'copied' ? 'Copied' : t('copied')
        if (successLabel === 'copied') {
          console.warn('[i18n] Missing translation for key: chat.copied')
        }
        toast.success(successLabel)
        if (copyTimerRef.current !== null) {
          window.clearTimeout(copyTimerRef.current)
        }
        copyTimerRef.current = window.setTimeout(() => setCopied(false), 1500)
      } catch (err) {
        const errLabel = t('copyFailed') === 'copyFailed' ? 'Copy failed' : t('copyFailed')
        if (errLabel === 'copyFailed') {
          console.warn('[i18n] Missing translation for key: chat.copyFailed')
        }
        toast.error(errLabel, {
          description: err instanceof Error ? err.message : String(err),
        })
      }
    },
    [isUser, m.content, t],
  )

  // 卸载清理 timer
  React.useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current)
        copyTimerRef.current = null
      }
    }
  }, [])

  // 重试(2026-07-28 立,深度对标 Trae Work):m.error 时气泡底部显示"重试"按钮,
  // 通过 window CustomEvent 'ihui:retry-message' 派发,由 message-input 监听后触发重新发送。
  // 不直接调用 chat store(任务约束),保持组件解耦。
  const handleRetry = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      window.dispatchEvent(new CustomEvent('ihui:retry-message', { detail: { messageId: m.id } }))
      const retryLabel = t('retry') === 'retry' ? 'Retrying…' : t('retry')
      if (retryLabel === 'retry') {
        console.warn('[i18n] Missing translation for key: chat.retry')
      }
      toast.info(retryLabel)
    },
    [m.id, t],
  )

  // Phase 19(2026-07-28 立):反向联动 — hover 消息时同步高亮 plan step,
  // 通过 onMessageHover 回调通知父组件 → ProgressJumpStore.setHoveredPlanStep
  // 2026-07-28 增补:同时维护本地 localHover state,用于驱动 Copy 按钮 + 时间戳 footer
  // 不与跨组件 plan step 联动(ProgressJumpStore.hoveredMessageId)耦合
  const handleMouseEnter = React.useCallback(() => {
    setLocalHover(true)
    onMessageHover?.(m.id, linkedPlanStepId)
  }, [onMessageHover, m.id, linkedPlanStepId])
  const handleMouseLeave = React.useCallback(() => {
    setLocalHover(false)
    onMessageHover?.(m.id, null)
  }, [onMessageHover, m.id])

  // Copy 按钮显示策略(2026-07-28 立):hover 或 focused 时显示,提升发现性同时不污染默认视觉
  // - 默认 opacity-0,hover/focused 提升至 opacity-100
  // - 已复制态(1.5s 内)持续显示
  // - 2026-07-28 增补:包含 localHover(本地鼠标移入)与 isHovered(跨组件 plan step 联动)两种来源
  const showCopyButton = (localHover || isHovered || isFocused || copied) && m.content.length > 0
  const timestampLabel = formatMessageTimestamp(m.createdAt)
  // 2026-07-31 立(深度对标 Codex/Trae Work):时间戳常驻显示在气泡底部,
  // 让对话流自带时间感知,无需 hover 才可见。用户需求"对话流里显示时间"。
  const showTimestamp = Boolean(timestampLabel)

  // Copy 按钮 a11y label(优先用 i18n,缺失回退英文)
  const copyLabel = t('copy') === 'copy' ? 'Copy' : t('copy')
  if (copyLabel === 'copy') {
    console.warn('[i18n] Missing translation for key: chat.copy')
  }

  return (
    <div
      className={cn(
        'group/msg relative flex w-full gap-3 rounded-md transition-colors duration-300',
        isUser ? 'flex-row-reverse' : 'flex-row',
        isHighlighted && 'bg-primary/5 ring-1 ring-primary/30',
        isHovered && !isHighlighted && 'bg-accent/20',
        isFocused && 'ring-1 ring-primary/40',
        // Phase 23: 搜索匹配高亮(当前匹配 ring-2 优先于普通匹配 ring-1)
        isSearchMatch && !isSearchCurrent && 'ring-1 ring-yellow-400/40',
        isSearchCurrent && 'ring-2 ring-yellow-400',
      )}
      data-message-id={m.id}
      data-message-focused={isFocused ? 'true' : 'false'}
      data-search-match={isSearchMatch ? 'true' : 'false'}
      data-search-current={isSearchCurrent ? 'true' : 'false'}
      onContextMenu={onContextMenu}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
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
            'relative rounded-2xl px-4 py-2.5',
            isUser
              ? 'rounded-br-sm bg-primary text-primary-foreground'
              : m.error
                ? 'rounded-bl-sm border border-destructive/30 bg-destructive/5 text-destructive'
                : 'rounded-bl-sm bg-muted text-foreground/90',
          )}
        >
          {/* Copy 按钮(2026-07-28 立):hover/focused 时显示在气泡右上角
            - 用 absolute 定位贴在气泡边缘,opacity 过渡避免布局抖动
            - 用 stopPropagation 防止触发容器 onContextMenu / onMouseEnter 等 */}
          {showCopyButton && (
            <button
              type="button"
              onClick={handleCopy}
              onMouseDown={(e) => e.stopPropagation()}
              data-testid={`message-copy-${m.id}`}
              aria-label={copyLabel}
              title={copyLabel}
              className={cn(
                'absolute -top-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded-md',
                'border border-border/60 bg-background text-muted-foreground shadow-sm',
                'transition-opacity duration-150 hover:bg-accent hover:text-foreground',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary',
                isUser ? '-left-2' : '-right-2',
                copied ? 'opacity-100' : 'opacity-0 group-hover/msg:opacity-100',
              )}
            >
              {copied ? (
                <Check className="h-3 w-3 text-emerald-500" aria-hidden />
              ) : (
                <Copy className="h-3 w-3" aria-hidden />
              )}
            </button>
          )}
          {showTyping ? (
            <TypingIndicator />
          ) : isUser ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.content}</p>
          ) : (
            <div className="space-y-2">
              {m.reasoning && (
                <ReasoningBlock
                  reasoning={m.reasoning}
                  expanded={reasoningExpanded}
                  onToggle={() => setReasoningExpanded((prev) => !prev)}
                />
              )}
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
          {/* 时间戳 footer(2026-07-28 立):hover/focused 时显示在气泡底部,
            增强时间感知的可读性。user 消息显示在右上(因为 flex-row-reverse) */}
          {showTimestamp && (
            <div
              className={cn(
                'mt-1 flex items-center gap-1.5 text-[10px] tabular-nums',
                isUser
                  ? 'justify-end text-primary-foreground/60'
                  : 'justify-end text-muted-foreground/50',
              )}
              data-testid={`message-timestamp-${m.id}`}
            >
              <span>{timestampLabel}</span>
            </div>
          )}
        </div>
        {/* 错误重试按钮(2026-07-28 立,深度对标 Trae Work):m.error 时在气泡下方显示,
            用户可一键重新生成该消息,不必手动从历史拷贝内容重新粘贴。 */}
        {m.error && (
          <button
            type="button"
            onClick={handleRetry}
            data-testid={`message-retry-${m.id}`}
            className={cn(
              'mt-0.5 inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5',
              'text-[11px] text-muted-foreground transition-colors',
              'hover:bg-accent/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary',
            )}
          >
            <RefreshCw className="h-3 w-3" aria-hidden />
            <span>{t('retry') === 'retry' ? 'Retry' : t('retry')}</span>
          </button>
        )}
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
  fallbackNotice,
  onClearFallbackNotice,
  subAgentActivities: subAgentActivitiesProp,
  stepBudget: _stepBudget,
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
  // 2026-07-28 立:userScrolledUp 状态镜像(用于驱动 jump-to-latest 浮动按钮显隐)
  // - ref 用于在 scroll callback 高频更新时避免整个组件重渲染
  // - state 镜像驱动浮动按钮条件渲染(ref 变化不会触发重渲染)
  // - 用 rAF 节流合并多次 ref 更新 → state 一次,避免抖动
  const [userScrolledUp, setUserScrolledUp] = React.useState(false)
  // state 镜像 ref(2026-07-28 立):handleScroll 闭包内对比最新 state 镜像,避免 useCallback 依赖 state
  const userScrolledUpMirrorRef = React.useRef(false)
  // 2026-07-28 立:键盘导航的 focused message index(-1 = 无聚焦)
  // - ↑/↓ 切换时设置,Enter 展开/折叠 reasoning,Esc 取消聚焦
  // - focused 消息添加 ring 视觉 + data-message-focused 属性
  const [focusedIndex, setFocusedIndex] = React.useState<number>(-1)
  // 镜像 ref(2026-07-28 立):解决键盘事件连续触发时的 stale closure 问题
  // - useEffect 重装 listener 之前可能多次 keyboard event 排队(测试 act 批量 / 用户狂按)
  // - ref 在键盘 handler 内同步更新,避免 ↑/↓ 后的 Enter/Escape 看不到新 focusedIndex
  // - state 仍用于驱动 UI re-render(focused ring / data-message-focused)
  const focusedIndexRef = React.useRef<number>(-1)
  const setFocusedIndexBoth = React.useCallback((next: number) => {
    focusedIndexRef.current = next
    setFocusedIndex(next)
  }, [])
  const prevMessagesLenRef = React.useRef(0)
  // #9 自动滚动 50ms throttle(2026-07-25 立):
  // 用 setTimeout + timestamp 实现 leading + trailing 节流,避免每个 token 触发 scrollIntoView。
  // - leading:第一次立即滚(新消息到达时视觉跟手)
  // - trailing:50ms 内后续 token 忽略,50ms 边缘补滚一次(保证最后 token 也能滚到底)
  const scrollThrottleRef = React.useRef<{ last: number; timer: number | null }>({
    last: 0,
    timer: null,
  })

  const enableVirtual = messages.length > VIRTUAL_THRESHOLD

  // P1-3 修复(2026-07-28):缓存 offsets/total,仅在 messages.length 或 heightMap 版本变化时重算,
  // 避免每次 scroll 都 O(n) 全量计算(虚拟滚动下 handleScroll 高频触发)。
  // heightMap 版本由 measureItem 递增(新增/删除/高度变化都 +1),
  // 覆盖 size 检测不到的"已有条目高度变化"场景(同 id 消息高度从 200px 变 300px 时 size 不变)。
  const offsetsCacheRef = React.useRef<number[]>([])
  const totalCacheRef = React.useRef<number>(0)
  const lastMessagesLengthRef = React.useRef<number>(0)
  const lastHeightMapVersionRef = React.useRef<number>(0)
  const heightMapVersionRef = React.useRef<number>(0)

  // 计算累积高度数组(用于精确定位可见范围 + padding)
  const computeCumulative = React.useCallback(() => {
    // 缓存命中:messages 数量和 heightMap 版本均未变化,直接返回缓存(避免 O(n) 重算)
    if (
      lastMessagesLengthRef.current === messages.length &&
      lastHeightMapVersionRef.current === heightMapVersionRef.current
    ) {
      return { offsets: offsetsCacheRef.current, total: totalCacheRef.current }
    }
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
    // 写入缓存,供下次 scroll 命中
    offsetsCacheRef.current = offsets
    totalCacheRef.current = total
    lastMessagesLengthRef.current = messages.length
    lastHeightMapVersionRef.current = heightMapVersionRef.current
    return { offsets, total }
  }, [messages])

  const handleScroll = React.useCallback(() => {
    const el = containerRef.current
    if (!el) return

    // 标记用户是否向上滚动(远离底部)
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    const scrolledUp = distanceFromBottom > 120
    userScrolledUpRef.current = scrolledUp
    // 同步到 state 镜像(2026-07-28 立),驱动 jump-to-latest 按钮条件渲染
    // 用 ref 镜像对比避免 handleScroll 依赖 state(useCallback 才能保持稳定引用)
    if (scrolledUp !== userScrolledUpMirrorRef.current) {
      userScrolledUpMirrorRef.current = scrolledUp
      if (!scrollDirtyRef.current) {
        scrollDirtyRef.current = true
        requestAnimationFrame(() => {
          scrollDirtyRef.current = false
          setUserScrolledUp(userScrolledUpMirrorRef.current)
        })
      }
    }

    // #8 滚动到顶部触发加载更多历史
    if (
      el.scrollTop < TOP_LOAD_MORE_THRESHOLD &&
      onLoadMoreHistory &&
      hasMoreHistory &&
      !loadingMoreHistory
    ) {
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
    while (
      end < messages.length - 1 &&
      offsets[end + 1] < viewportBottom + BUFFER * ESTIMATED_ITEM_HEIGHT
    ) {
      end++
    }
    end = Math.min(messages.length - 1, end + BUFFER)

    setVisibleRange((prev) => {
      if (prev.start === start && prev.end === end) return prev
      return { start, end }
    })
  }, [
    enableVirtual,
    computeCumulative,
    messages.length,
    onLoadMoreHistory,
    hasMoreHistory,
    loadingMoreHistory,
  ])

  // 自动滚动到底部(流式 token 到达 + 新消息)
  // - 用户手动向上滚动时不强制滚到底(避免打断阅读)
  // - 新消息到达(messages.length 增加)时强制滚到底
  // - #9 50ms throttle(2026-07-25 立):leading + trailing,避免每个 token 触发 scrollIntoView
  React.useEffect(() => {
    const newLen = messages.length
    const isNewMessage = newLen > prevMessagesLenRef.current
    prevMessagesLenRef.current = newLen
    if (!isNewMessage && userScrolledUpRef.current) return

    const doScroll = () => {
      const el = bottomRef.current
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
    const st = scrollThrottleRef.current
    const now = Date.now()
    const remaining = 50 - (now - st.last)
    if (remaining <= 0) {
      // leading:超过 50ms 未滚,立即滚
      st.last = now
      if (st.timer !== null) {
        clearTimeout(st.timer)
        st.timer = null
      }
      doScroll()
    } else if (st.timer === null) {
      // trailing:50ms 内首次触发,安排 trailing 滚动(后续触发忽略,保证最后 token 也滚)
      st.timer = window.setTimeout(() => {
        st.last = Date.now()
        st.timer = null
        doScroll()
      }, remaining)
    }
  }, [messages.length, lastContent, isStreaming])

  // #9 卸载时清理 pending throttle timer(2026-07-25 立)
  React.useEffect(() => {
    const st = scrollThrottleRef.current
    return () => {
      if (st.timer !== null) {
        clearTimeout(st.timer)
        st.timer = null
      }
    }
  }, [])

  // P3 修复:用 dirty 标记合并 rAF,多个消息同时进入视区时一帧只跑一次 handleScroll,
  // 避免每个 measureItem 高度变化都排队独立 rAF(每个 rAF 内 handleScroll 调 computeCumulative O(n))
  const scrollDirtyRef = React.useRef(false)
  const scheduleScrollUpdate = React.useCallback(() => {
    if (scrollDirtyRef.current) return // 已有 pending
    scrollDirtyRef.current = true
    requestAnimationFrame(() => {
      scrollDirtyRef.current = false
      handleScroll()
    })
  }, [handleScroll])

  // #8 加载更多历史时保持滚动位置(handleScroll 内已处理)
  // #7 ResizeObserver 测量真实高度并触发重算可见范围
  const measureItem = React.useCallback(
    (id: string) => (el: HTMLElement | null) => {
      const map = heightMapRef.current
      if (!el) {
        // P1-3 修复:删除条目时版本号 +1,强制下次 computeCumulative 重算缓存
        if (map.has(id)) {
          map.delete(id)
          heightMapVersionRef.current++
        }
        return
      }
      const h = el.getBoundingClientRect().height
      const prev = map.get(id)
      if (prev !== h) {
        map.set(id, h)
        // P1-3 修复:heightMap 变化时版本号 +1,强制下次 computeCumulative 重算缓存
        // 高度变化后重算可见范围(下一帧,避免布局抖动);用 scheduleScrollUpdate 合并多消息同时变化
        heightMapVersionRef.current++
        scheduleScrollUpdate()
      }
    },
    [scheduleScrollUpdate],
  )

  // 消息列表重置(切换会话)时清空高度映射 + 重置可见范围
  React.useEffect(() => {
    if (messages.length === 0) {
      heightMapRef.current.clear()
      setVisibleRange({ start: 0, end: VIRTUAL_THRESHOLD - 1 })
      userScrolledUpRef.current = false
      userScrolledUpMirrorRef.current = false
      setUserScrolledUp(false)
    } else if (messages.length <= VIRTUAL_THRESHOLD) {
      setVisibleRange({ start: 0, end: messages.length - 1 })
    }
  }, [messages.length])

  // 2026-07-28 立:userScrolledUp state → mirror ref 同步,
  // 让 handleScroll 闭包能拿到最新值(否则 setUserScrolledUp 后下次 scroll 对比会失败)
  React.useEffect(() => {
    userScrolledUpMirrorRef.current = userScrolledUp
  }, [userScrolledUp])

  // 2026-07-28 立:Jump-to-latest 浮动按钮点击处理(深度对标 Trae Work)
  // - scrollIntoView 到 bottomRef(平滑)
  // - 重置 userScrolledUp 标记,触发自动滚动继续工作
  // - 派发自定义事件,允许其他监听组件(如 timeline tab)同步滚动到底
  const handleJumpToLatest = React.useCallback(() => {
    const el = bottomRef.current
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'end' })
    userScrolledUpRef.current = false
    userScrolledUpMirrorRef.current = false
    setUserScrolledUp(false)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ihui:jump-to-latest'))
    }
  }, [])

  // ── Phase 19 集成(2026-07-28 立)────────────────────────────────────
  // ProgressJumpStore:PlanStep ↔ Message 双向跳转 + 联动高亮
  const pendingJump = useProgressJumpStore((s) => s.pendingJumpToMessage)
  const highlightedMessageId = useProgressJumpStore((s) => s.highlightedMessageId)
  const hoveredMessageId = useProgressJumpStore((s) => s.hoveredMessageId)
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
  }, [pendingJump, flashHighlight, clearPendingJump])

  // 2026-07-28 立(深度对标 Trae Work):键盘导航 ↑/↓ 切换消息聚焦
  // - 焦点不在 input/textarea/contenteditable 时生效(避免与输入冲突)
  // - ArrowDown / ArrowUp:切换 focused message index
  // - Enter:聚焦消息若含 reasoning → 派发切换事件(由 MessageItem 内部响应)
  // - Escape:清除聚焦
  // - Home/End:跳到首/末条
  // 用 window keydown 监听确保焦点在 message 容器内任意子元素都能响应
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (messages.length === 0) return
      const target = e.target as HTMLElement | null
      // 焦点在输入控件时不拦截(避免与用户输入冲突)
      if (target) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) {
          return
        }
      }
      // 已有焦点但被 Modifier 修饰 → 不拦截(保留浏览器原生行为:Cmd+ArrowUp = scroll to top)
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next =
          focusedIndexRef.current < 0
            ? 0
            : Math.min(messages.length - 1, focusedIndexRef.current + 1)
        setFocusedIndexBoth(next)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const next =
          focusedIndexRef.current < 0
            ? messages.length - 1
            : Math.max(0, focusedIndexRef.current - 1)
        setFocusedIndexBoth(next)
      } else if (e.key === 'Home') {
        e.preventDefault()
        setFocusedIndexBoth(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        setFocusedIndexBoth(messages.length - 1)
      } else if (e.key === 'Escape') {
        // 2026-07-28 立:用 focusedIndexRef 读最新值,避免 stale closure
        // (键盘事件连续触发时 listener 闭包内的 focusedIndex 可能滞后)
        if (focusedIndexRef.current >= 0) {
          e.preventDefault()
          setFocusedIndexBoth(-1)
        }
      } else if (e.key === 'Enter') {
        // 2026-07-28 立:同上,用 ref 读最新 focusedIndex
        const idx = focusedIndexRef.current
        if (idx >= 0) {
          const m = messages[idx]
          if (m?.reasoning) {
            e.preventDefault()
            window.dispatchEvent(
              new CustomEvent('ihui:toggle-reasoning', { detail: { messageId: m.id } }),
            )
          }
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [messages, setFocusedIndexBoth])

  // 2026-07-28 立:focused message 变更后自动 scrollIntoView(确保可见)
  // 配合键盘 ↑/↓ 用,避免焦点切到屏幕外时用户看不到
  React.useEffect(() => {
    if (focusedIndex < 0 || focusedIndex >= messages.length) return
    const id = messages[focusedIndex]?.id
    if (!id) return
    const el = containerRef.current?.querySelector(
      `[data-message-id="${id}"]`,
    ) as HTMLElement | null
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [focusedIndex, messages])

  // 2026-07-28 立:focusedIndex 越界保护(messages 删除时索引可能失效)
  React.useEffect(() => {
    if (focusedIndex >= messages.length) {
      setFocusedIndex(messages.length > 0 ? messages.length - 1 : -1)
    }
  }, [focusedIndex, messages.length])

  // TimelineStore:事件列表(2026-07-28 立;2026-07-31 立,移除 tab 切换,单一对话流视图)
  // - tab 切换已移除(对标 Trae/Codex 单一对话流),保留 events 供其他组件共享
  const timelineEvents = useTimelineStore((s) => s.events)
  const setTimelineEvents = useTimelineStore((s) => s.setEvents)

  // ChatStore:subAgentActivities(2026-07-28 立)用于派生 TimelineEvent + SubAgentTaskTree
  // 优先用 prop 传入的 subAgentActivities(由 ai-side-panel 派生),
  // 兜底从 useChatStore 内部读取(独立使用 MessageList 的场景)
  const subAgentActivitiesFromStore = useChatStore((s) => s.subAgentActivities)
  const subAgentActivities = subAgentActivitiesProp ?? subAgentActivitiesFromStore

  // PlanStepsCard 数据源(2026-07-31 重构):
  // 普通对话走 streamChat → /api/ai/chat/stream → /api/llm/complete/stream,
  // 不经过 LangGraph agent,因此 useAgentProgress.start() 即使接通也得不到 plan events
  // (且 graph 未注册时返回 503)。改为基于 messages.toolCalls 派生 planSteps,
  // 让 PlanStepsCard 基于实际对话内容显示已执行的工具调用步骤,无需 LangGraph agent。
  // isStreaming 已是 MessageList prop,streaming 中最后一条 assistant 消息的 toolCalls
  // 状态为 running,会自动派生为 in_progress step,无需额外处理。
  const planSteps = React.useMemo<PlanStep[]>(() => {
    const steps: PlanStep[] = []
    for (const msg of messages) {
      if (msg.role !== 'assistant' || !msg.toolCalls?.length) continue
      for (const tc of msg.toolCalls) {
        steps.push({
          id: tc.id,
          step: tc.toolName,
          status: tc.status === 'running' ? 'in_progress' : 'completed',
          startedAt: new Date(msg.createdAt ?? Date.now()).toISOString(),
          durationMs: tc.duration,
          explanation: tc.error || (tc.repeated ? '已跳过(重复调用)' : undefined),
        })
      }
    }
    return steps
  }, [messages])

  // 从 messages + subAgentActivities 派生 TimelineEvent 列表
  // 上游没传 events 时,本地基于 messages 派生供右侧时间线 tab 渲染
  const derivedEvents = React.useMemo<TimelineEvent[]>(() => {
    const events: TimelineEvent[] = []
    for (const m of messages) {
      events.push({
        id: `msg-${m.id}`,
        type: m.role === 'user' ? 'reference' : 'thinking',
        timestamp: new Date(m.createdAt).toISOString(),
        title: m.role === 'user' ? '用户消息' : 'AI 回复',
        description: m.content.slice(0, 80),
        status: m.error ? 'failed' : 'done',
        messageId: m.id,
      })
      for (const tc of m.toolCalls ?? []) {
        events.push({
          id: `tc-${tc.id}`,
          type: 'tool',
          timestamp: new Date(m.createdAt).toISOString(),
          title: tc.toolName,
          status: tc.status === 'success' ? 'done' : tc.status === 'error' ? 'failed' : 'running',
          messageId: m.id,
          toolCallId: tc.id,
        })
      }
    }
    for (const sa of subAgentActivities) {
      events.push({
        id: `sub-${sa.agentId}`,
        type: 'subagent',
        timestamp: new Date().toISOString(),
        title: sa.name,
        description: sa.currentStep,
        status: sa.status === 'completed' ? 'done' : sa.status === 'failed' ? 'failed' : 'running',
        meta: { agentId: sa.agentId },
      })
    }
    return events
  }, [messages, subAgentActivities])

  // 上游无 events 时,同步派生 events 到 store(供外部组件共享)
  React.useEffect(() => {
    if (timelineEvents.length === 0 && derivedEvents.length > 0) {
      setTimelineEvents(derivedEvents)
    }
  }, [derivedEvents, timelineEvents.length, setTimelineEvents])

  // 为每个 message 派生"关联的 subagent 列表"
  // 启发式:每个 assistant 消息关联其创建时已存在的 subagent 活动(基于 createdAt 顺序)
  // - 简化处理:对最后一个 assistant 消息,展示所有当前 subAgentActivities
  // - 其他消息不展示(避免每个消息重复显示)
  const lastAssistantMessageId = React.useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m && m.role === 'assistant') return m.id
    }
    return null
  }, [messages])

  // 把 SubAgentActivity 映射为 SubAgent(SubAgentTaskTree 要求的类型)
  // AgentStatus → SubagentStatus 映射:
  //   idle/pending → spawned; thinking/acting/reflecting/running → running
  //   completed → done; failed → failed; cancelled/waiting → dead
  const linkedSubagents = React.useMemo(() => {
    if (!lastAssistantMessageId || subAgentActivities.length === 0) return []
    const colors = ['cyan', 'blue', 'green', 'yellow', 'magenta', 'red'] as const
    const statusMap: Record<string, 'spawned' | 'running' | 'done' | 'failed' | 'dead'> = {
      idle: 'spawned',
      pending: 'spawned',
      thinking: 'running',
      acting: 'running',
      reflecting: 'running',
      waiting: 'dead',
      running: 'running',
      completed: 'done',
      failed: 'failed',
      cancelled: 'dead',
    }
    return subAgentActivities.map((sa, idx) => ({
      id: sa.agentId,
      threadId: sa.agentId,
      nickname: sa.name,
      handle: `@${sa.name.replace(/^@/, '')}`,
      color: colors[idx % colors.length] ?? 'cyan',
      status: statusMap[sa.status] ?? 'spawned',
      spawnedAt: new Date().toISOString(),
      currentTask: sa.currentStep,
    }))
  }, [lastAssistantMessageId, subAgentActivities])

  // ── Phase 23 消息搜索(2026-07-29 立)──────────────────────────────────
  // 右键菜单"搜索消息" + Ctrl+F 快捷键 → 弹出搜索栏 → 高亮匹配 + 滚动到第一个匹配
  // 注:查询文本由 MessageSearchBar 内部 state 管理,本组件只追踪结果 ID 列表
  const [searchResultIds, setSearchResultIds] = React.useState<string[]>([])
  const [searchCurrentIndex, setSearchCurrentIndex] = React.useState(0)
  const [searchBarVisible, setSearchBarVisible] = React.useState(false)
  // searchResultIds 的 Set 镜像,用于 O(1) 判断某消息是否匹配(避免每条消息 includes O(n))
  const searchResultSet = React.useMemo<Set<string>>(
    () => new Set(searchResultIds),
    [searchResultIds],
  )
  // 当前匹配的消息 ID(用于 MessageItem 的 isSearchCurrent prop)
  const searchCurrentId = searchResultIds[searchCurrentIndex] ?? null

  // 搜索输入回调:执行搜索 + 重置索引 + 滚动到第一个匹配
  const handleSearch = React.useCallback(
    (query: string) => {
      const ids = searchMessages(messages, query)
      setSearchResultIds(ids)
      setSearchCurrentIndex(0)
      // 第一个匹配自动滚动到视野
      if (ids.length > 0 && ids[0]) {
        const firstId = ids[0]
        requestAnimationFrame(() => {
          const el = containerRef.current?.querySelector(
            `[data-message-id="${firstId}"]`,
          ) as HTMLElement | null
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        })
      }
    },
    [messages],
  )

  // 上一个/下一个导航:切换 currentIndex + 滚动到对应消息
  const handleSearchNavigate = React.useCallback((direction: 'prev' | 'next') => {
    setSearchResultIds((currentIds) => {
      if (currentIds.length === 0) return currentIds
      setSearchCurrentIndex((prevIdx) => {
        let nextIdx: number
        if (direction === 'next') {
          nextIdx = (prevIdx + 1) % currentIds.length
        } else {
          nextIdx = (prevIdx - 1 + currentIds.length) % currentIds.length
        }
        const targetId = currentIds[nextIdx]
        if (targetId) {
          requestAnimationFrame(() => {
            const el = containerRef.current?.querySelector(
              `[data-message-id="${targetId}"]`,
            ) as HTMLElement | null
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          })
        }
        return nextIdx
      })
      return currentIds
    })
  }, [])

  // 关闭搜索栏:清空所有搜索状态
  const handleSearchClose = React.useCallback(() => {
    setSearchBarVisible(false)
    setSearchResultIds([])
    setSearchCurrentIndex(0)
  }, [])

  // 全局快捷键:Ctrl+F 打开搜索栏 / Esc 关闭搜索栏
  // 注:与已有键盘导航监听器共存 —— 已有监听器对 Ctrl/Meta 修饰键 return,不拦截 Ctrl+F
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F / Cmd+F → 打开搜索栏(阻止浏览器原生 find)
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setSearchBarVisible(true)
        return
      }
      // Esc → 关闭搜索栏(搜索栏可见时)
      if (e.key === 'Escape' && searchBarVisible) {
        e.preventDefault()
        setSearchBarVisible(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [searchBarVisible])

  // 右键菜单(2026-07-28 立,深度对标 Trae Work)
  const contextMenu = useContextMenu<ChatMessage>({
    buildItems: (msg) => {
      const isAssistant = msg.role === 'assistant'
      return [
        {
          id: 'copy',
          label: '复制文本',
          action: 'copy',
        },
        {
          id: 'copyMarkdown',
          label: '复制为 Markdown',
          action: 'copyMarkdown',
          disabled: !isAssistant,
        },
        {
          id: 'search',
          label: t('search'),
          action: 'search',
          shortcut: 'Ctrl+F',
          icon: <Search className="h-3 w-3" aria-hidden />,
        },
        { id: 'sep-1', label: '', separator: true },
        {
          id: 'regenerate',
          label: '重新生成',
          action: 'regenerate',
          disabled: !isAssistant,
        },
        {
          id: 'feedback',
          label: '反馈',
          action: 'feedback',
          disabled: !isAssistant,
        },
        { id: 'sep-2', label: '', separator: true },
        {
          id: 'delete',
          label: '删除消息',
          action: 'delete',
          danger: true,
        },
      ]
    },
  })

  // 右键菜单项点击处理
  const handleContextMenuAction = React.useCallback(
    async (action: ContextMenuAction) => {
      const msg = contextMenu.data
      if (!msg) return
      contextMenu.close()
      try {
        if (action === 'copy') {
          const text = plainTextForClipboard(msg.content)
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text)
            toast.success('已复制文本')
          }
        } else if (action === 'copyMarkdown') {
          const md = normalizeMarkdown(msg.content)
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(md)
            toast.success('已复制 Markdown')
          }
        } else if (action === 'regenerate') {
          // 重新生成:转发到全局事件,由 message-input 监听后触发 sendAnswer
          window.dispatchEvent(
            new CustomEvent('ihui:regenerate-message', { detail: { messageId: msg.id } }),
          )
          toast.info('正在重新生成…')
        } else if (action === 'feedback') {
          // 反馈:简单 toast 兜底(深度反馈系统不在本任务范围)
          toast.success('已记录反馈,感谢支持')
        } else if (action === 'search') {
          // Phase 23:打开搜索栏(等同于 Ctrl+F)
          setSearchBarVisible(true)
        } else if (action === 'delete') {
          // 删除:本地过滤 store(单端,服务端持久化由 message-input 流式回收)
          const store = useChatStore.getState()
          const next = store.messages.filter((m) => m.id !== msg.id)
          if (next.length !== store.messages.length) {
            useChatStore.setState({ messages: next })
            toast.success('已删除消息')
          }
        }
      } catch (err) {
        toast.error('操作失败', {
          description: err instanceof Error ? err.message : String(err),
        })
      }
    },
    [contextMenu],
  )

  // 时间间隔格式化(用于 CompressionDivider label)
  const formatGap = React.useCallback((ms: number): string => {
    if (ms < 60_000) return `${Math.floor(ms / 1000)}s`
    if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`
    return `${Math.floor(ms / 3_600_000)}h`
  }, [])

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
  }, [flashHighlight])

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
  const paddingTop = enableVirtual ? (offsets[visibleRange.start] ?? 0) : 0
  const paddingBottom = enableVirtual
    ? Math.max(0, (offsets[messages.length] ?? 0) - (offsets[visibleRange.end + 1] ?? 0))
    : 0

  // 单一整合对话流视图(2026-07-31 立,彻底整合,对标 Trae/Codex 单一对话流)
  // - 移除 tablist 切换(对话流/时间线/全部 三 tab)
  // - 移除独立时间线面板(对话流已内联工具调用/子代理/计划等,时间线是冗余汇总)
  // - 只保留对话流一个视图,工具调用/子代理/思考过程已内联在消息气泡内
  const inlinePanelNode = (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      id="message-list-panel-inline"
      role="tabpanel"
      className="hover-scroll min-h-0 h-full flex-1 overflow-y-auto"
      data-testid="message-list-inline-panel"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        {/* P4-2: fallback 通知横幅(主模型失败切换到备用模型时展示,amber 警告色) */}
        {fallbackNotice && (
          <div className="flex items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
            <span>
              {t('fallbackNotice', {
                primary: fallbackNotice.primaryModel,
                backup: fallbackNotice.backupModel,
              })}
            </span>
            {onClearFallbackNotice && (
              <button
                type="button"
                onClick={onClearFallbackNotice}
                className="shrink-0 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
                aria-label="close"
              >
                ×
              </button>
            )}
          </div>
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
          const prev = realIdx > 0 ? messages[realIdx - 1] : undefined
          // 消息间隔超过 5 分钟 → 插入 CompressionDivider
          const gapMs =
            prev && m && typeof prev.createdAt === 'number' && typeof m.createdAt === 'number'
              ? m.createdAt - prev.createdAt
              : 0
          const showCompression = gapMs > 5 * 60 * 1000
          return (
            <React.Fragment key={m.id}>
              {showCompression && prev && (
                <CompressionDivider
                  count={1}
                  label={`${formatGap(gapMs)} 间隔`}
                  expandable={false}
                  data-testid={`message-compression-divider-${m.id}`}
                />
              )}
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
                  isHovered={hoveredMessageId === m.id}
                  isFocused={focusedIndex === realIdx}
                  linkedPlanStepId={messageToPlanStepIds[m.id]?.[0] ?? null}
                  onMessageHover={handleMessageHover}
                  isSearchMatch={searchResultSet.has(m.id)}
                  isSearchCurrent={searchCurrentId === m.id}
                  onContextMenu={(e) => {
                    contextMenu.setData(m)
                    contextMenu.contextMenuHandlers.onContextMenu(e)
                  }}
                />
                {/* Phase 19: 最后一个 assistant 消息下挂载 PlanStepsCard + SubAgentTaskTree */}
                {!m.error &&
                  m.id === lastAssistantMessageId &&
                  (planSteps.length > 0 || linkedSubagents.length > 0) && (
                    <div className="ml-1 mt-1 flex w-full max-w-full flex-col gap-1.5">
                      {planSteps.length > 0 && (
                        <PlanStepsCard steps={planSteps} data-testid="message-plan-steps-card" />
                      )}
                      {linkedSubagents.map((sub) => (
                        <SubAgentTaskTree
                          key={sub.id}
                          subagent={sub}
                          defaultCollapsed
                          data-testid={`message-subagent-tree-${sub.id}`}
                        />
                      ))}
                    </div>
                  )}
              </div>
            </React.Fragment>
          )
        })}
        {/* #7 虚拟滚动底部占位 */}
        {paddingBottom > 0 && <div style={{ height: paddingBottom, flexShrink: 0 }} />}
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
      {inlinePanelNode}
      {/* 2026-07-28 立(深度对标 Trae Work):Scroll-to-bottom 浮动按钮
        - 当 userScrolledUp 为 true(用户已向上滚动超过 120px)时显示
        - 点击 → scrollIntoView 到 bottomRef + 重置 userScrolledUp
        - 浮在 message list 容器右下角,固定定位(不随消息滚动)
        - 与 streaming 联动:有未读新消息时显示红点徽章 */}
      {userScrolledUp && (
        <button
          type="button"
          onClick={handleJumpToLatest}
          data-testid="message-list-jump-latest"
          aria-label={t('jumpToLatest') === 'jumpToLatest' ? 'Jump to latest' : t('jumpToLatest')}
          title={t('jumpToLatest') === 'jumpToLatest' ? 'Jump to latest' : t('jumpToLatest')}
          className={cn(
            'absolute bottom-4 right-4 z-20 inline-flex h-9 items-center gap-1 rounded-md',
            'border border-border/60 bg-background/95 px-3 text-xs font-medium text-foreground/90 shadow-md backdrop-blur',
            'transition-all duration-150 hover:bg-accent hover:shadow-lg',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary',
            'animate-in fade-in-0 slide-in-from-bottom-2',
          )}
        >
          <ArrowDown className="h-3.5 w-3.5" aria-hidden />
          <span>{t('latest') === 'latest' ? 'Latest' : t('latest')}</span>
          {isStreaming && (
            <span
              className="ml-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"
              aria-hidden
              data-testid="message-list-jump-latest-dot"
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
    </div>
  )
}

export default MessageList
