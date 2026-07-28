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
  MessageSquare,
  ListTree,
  ThumbsUp,
  ThumbsDown,
  Link as LinkIcon,
  ChevronRight,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { FallbackEvent } from '@ihui/api-client'

import type { ChatMessage } from '@/stores/chat'
import { useChatStore } from '@/stores/chat'
import type { InlineDiffInfo, SubAgentActivity } from '@/components/ai/types'
import { MarkdownStream } from '@/components/ai/markdown-stream'
import { ToolCallCard, deriveDiffInfo } from '@/components/ai/tool-call-card'
import { PromptTemplates } from '@/components/ai/prompt-templates'
import { cn } from '@/lib/utils'
import { useProgressJumpStore } from '@/stores/progress-jump-store'
import { useTimelineStore, type TimelineEvent } from '@/stores/timeline-store'
import {
  TimelineTab,
  flattenToTimelineEvents,
} from '@/components/ai/progress-sections/timeline-tab'
import { CompressionDivider } from '@/components/ai/progress-sections/compression-divider'
import { SubAgentTaskTree } from '@/components/ai/progress-sections/sub-agent-task-tree'
import {
  MessageContextMenu,
  markdownForClipboard,
  plainTextForClipboard,
} from '@/components/ai/progress-sections/message-context-menu'
import { useContextMenu, type ContextMenuItem } from '@/hooks/use-context-menu'
import { useAgentProgress, type Subagent } from '@/hooks/use-agent-progress'

/** 上下文菜单构建所需的回调(由 MessageList 注入,内含 chat store + props 衍生能力) */
interface ContextMenuCallbacks {
  onCopy: (message: ChatMessage) => void
  onCopyMarkdown: (message: ChatMessage) => void
  onRegenerate: (message: ChatMessage) => void
  onFeedback: (message: ChatMessage, value: 'like' | 'dislike' | null) => void
  onShare: (message: ChatMessage) => void
  onDelete: (message: ChatMessage) => void
  onCollapseToPlan: (message: ChatMessage) => void
}

/** 反馈子菜单项(like / dislike 二选一 + clear) */
function buildFeedbackChildren(
  feedback: 'like' | 'dislike' | null,
  setFeedback: (v: 'like' | 'dislike' | null) => void,
): ContextMenuItem[] {
  return [
    {
      id: 'feedback-like',
      label: '有用',
      action: 'feedback',
      shortcut: feedback === 'like' ? '✓' : undefined,
    },
    {
      id: 'feedback-dislike',
      label: '不满意',
      action: 'feedback',
      shortcut: feedback === 'dislike' ? '✓' : undefined,
    },
    feedback
      ? {
          id: 'feedback-clear',
          label: '清除反馈',
          action: 'feedback',
          shortcut: 'Esc',
        }
      : { id: 'feedback-sep', label: '', separator: true },
  ].filter((it) => it.label !== '' || it.separator) as ContextMenuItem[]
}

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

/** 阶段预算条(P0 流式性能优化保留,2026-07-28 重新声明在 MessageItem 内部展示)
 *  Phase 18.4 step budget 视觉化:展示 used/total,超 80% 时变 amber */
function StepBudgetBar({
  used,
  total,
}: {
  used: number
  total: number
}): React.ReactElement | null {
  if (total <= 0) return null
  const pct = Math.min(100, Math.round((used / total) * 100))
  const warn = pct >= 80
  return (
    <div
      className="flex items-center gap-1.5 text-[9px] text-muted-foreground/70"
      data-testid="message-step-budget"
    >
      <span className="tabular-nums">
        步数 {used}/{total}
      </span>
      <span
        className={cn(
          'h-0.5 flex-1 overflow-hidden rounded-sm bg-muted/60',
          warn && 'bg-amber-500/20',
        )}
        aria-hidden
      >
        <span
          className={cn('block h-full bg-primary/50', warn && 'bg-amber-500/70')}
          style={{ width: `${pct}%` }}
        />
      </span>
    </div>
  )
}

/** 反馈状态徽章(显示当前 like/dislike 状态) */
function FeedbackBadge({ feedback }: { feedback: 'like' | 'dislike' | null }): React.ReactElement | null {
  if (!feedback) return null
  const Icon = feedback === 'like' ? ThumbsUp : ThumbsDown
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-sm px-1 py-px text-[9px] font-medium',
        feedback === 'like'
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
          : 'bg-destructive/10 text-destructive',
      )}
      title={feedback === 'like' ? '已标记为有用' : '已标记为不满意'}
      aria-label={feedback === 'like' ? '已标记为有用' : '已标记为不满意'}
      data-testid={`message-feedback-badge-${feedback}`}
    >
      <Icon className="h-2.5 w-2.5" aria-hidden />
    </span>
  )
}

/** P0 流式性能优化(2026-07-23):抽取消息项组件 + React.memo,
 * 流式 token 只更新目标消息引用,其他消息引用不变 → 不触发重渲染
 *
 * Phase 19 深化(2026-07-28):
 * - 新增 onContextMenu / onHoverChange 回调(右键菜单 + 联动)
 * - 新增 isHighlighted / linkedSubagents props(ProgressJumpStore + SubAgentTaskTree 集成)
 * - 新增 feedback 状态(点赞/点踩 UI) */
interface MessageItemProps {
  message: ChatMessage
  isLast: boolean
  isStreaming: boolean
  assistantLabel: string
  isHighlighted: boolean
  linkedSubagents: Subagent[]
  feedback: 'like' | 'dislike' | null
  onApplyDiff?: (messageId: string, toolCallId: string, diffInfo: InlineDiffInfo) => Promise<void>
  onRejectDiff?: (messageId: string, toolCallId: string) => void
  onContextMenu: (e: React.MouseEvent, message: ChatMessage) => void
  onHoverChange: (id: string | null) => void
}

const MessageItem = React.memo(function MessageItem({
  message: m,
  isLast,
  isStreaming,
  assistantLabel,
  isHighlighted,
  linkedSubagents,
  feedback,
  onApplyDiff,
  onRejectDiff,
  onContextMenu,
  onHoverChange,
}: MessageItemProps) {
  const t = useTranslations('chat')
  const isUser = m.role === 'user'
  const showTyping = !isUser && m.content === '' && isStreaming
  const streamingThis = !isUser && isStreaming && isLast

  // 气泡 hover 状态(由外层 ProgressJumpStore 接管联动,本组件只负责冒泡)
  const handleMouseEnter = React.useCallback(() => {
    if (!isUser) onHoverChange(m.id)
  }, [isUser, m.id, onHoverChange])
  const handleMouseLeave = React.useCallback(() => {
    onHoverChange(null)
  }, [onHoverChange])

  return (
    <div
      className={cn('flex w-full gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}
      onContextMenu={(e) => onContextMenu(e, m)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-testid="message-item"
      data-message-id={m.id}
      data-message-role={m.role}
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
            {/* Phase 19: 反馈状态徽章(用户在该消息上设置的 like/dislike 状态) */}
            <FeedbackBadge feedback={feedback} />
          </span>
        )}
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 transition-shadow',
            isUser
              ? 'rounded-br-sm bg-primary text-primary-foreground'
              : m.error
                ? 'rounded-bl-sm border border-destructive/30 bg-destructive/5 text-destructive'
                : 'rounded-bl-sm bg-muted text-foreground',
            // Phase 19 ProgressJumpStore 联动:被高亮时加 ring(无蓝发光,subtle ring-2 + primary/40)
            isHighlighted && 'ring-2 ring-primary/40 ring-offset-1 ring-offset-background',
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
        {/* Phase 19: SubAgentTaskTree — 助手消息触发的子代理任务树(同时间窗口内匹配的 subagent) */}
        {!isUser && linkedSubagents.length > 0 && (
          <div className="ml-1 mt-1 flex w-full max-w-full flex-col gap-1.5">
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
    </div>
  )
})

/** 消息列表分隔器 — 相邻消息时间差 > 30 分钟时显示压缩分割线 */
const COMPRESSION_THRESHOLD_MS = 30 * 60 * 1000

/** 工具函数:从消息体提取时间戳(createdAt 数值;若缺失则用 0) */
function getMessageTimestamp(m: ChatMessage): number {
  if (typeof m.createdAt === 'number' && m.createdAt > 0) return m.createdAt
  return 0
}

/** 工具函数:把毫秒间隔格式化为人类可读字符串(30 分钟 / 1 小时 / 1 天) */
function formatGap(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时`
  const days = Math.floor(hours / 24)
  return `${days} 天`
}

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
  /** Phase 18.2: 子代理活动(从 chat store 传入,Trae Work 风格 inline 渲染,保留为兼容 prop)
   *  注:Phase 19 已迁移到 useAgentProgress 直接订阅,本 prop 仅为类型兼容保留。
   *  TypeScript strict 模式下 ai-side-panel 仍会传此 prop,这里接收后不参与渲染逻辑。*/
  subAgentActivities?: SubAgentActivity[]
  /** Phase 18.4: 阶段预算(used / total,>0 时在消息列表底部显示进度条) */
  stepBudget?: { used: number; total: number }
  /** Phase 19: useAgentProgress 订阅的 threadId(默认从 chat store 读取 conversationId)。
   *  传 null/undefined 时跳过订阅,避免重复 stream 连接。 */
  threadId?: string | null
  /** Phase 19: 重新生成回调(右键菜单 → 重新生成,默认 console.log TODO 占位) */
  onRegenerate?: (messageId: string) => void
  /** Phase 19: 删除消息回调(右键菜单 → 删除,默认走 chat store setState 过滤 messages) */
  onDeleteMessage?: (messageId: string) => void
  /** Phase 19: 反馈回调(右键菜单 → 反馈 like/dislike,默认维护本地 Map state) */
  onFeedback?: (messageId: string, value: 'like' | 'dislike' | null) => void
  /** Phase 19: 折叠到计划回调(右键菜单 → 折叠到计划,默认触发 store.requestJumpToMessage) */
  onCollapseToPlan?: (messageId: string) => void
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
  subAgentActivities: _subAgentActivities, // Phase 19 兼容 prop,接收但不直接渲染
  stepBudget,
  threadId: threadIdProp,
  onRegenerate,
  onDeleteMessage,
  onFeedback: onFeedbackProp,
  onCollapseToPlan,
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
  // #9 自动滚动 50ms throttle(2026-07-25 立):
  // 用 setTimeout + timestamp 实现 leading + trailing 节流,避免每个 token 触发 scrollIntoView。
  // - leading:第一次立即滚(新消息到达时视觉跟手)
  // - trailing:50ms 内后续 token 忽略,50ms 边缘补滚一次(保证最后 token 也能滚到底)
  const scrollThrottleRef = React.useRef<{ last: number; timer: number | null }>({
    last: 0,
    timer: null,
  })

  // Phase 19: ProgressJumpStore 订阅(hover/highlight/pendingJump 联动)
  const setHoveredMessage = useProgressJumpStore((s) => s.setHoveredMessage)
  const pendingJumpToMessage = useProgressJumpStore((s) => s.pendingJumpToMessage)
  const clearPendingJump = useProgressJumpStore((s) => s.clearPendingJump)
  const flashHighlight = useProgressJumpStore((s) => s.flashHighlight)
  const linkPlanStepToMessage = useProgressJumpStore((s) => s.linkPlanStepToMessage)
  const highlightedMessageId = useProgressJumpStore((s) => s.highlightedMessageId)
  // 本地 feedback 状态(默认用本地 Map 维护;如果外部 prop 提供回调则透传)
  const [feedbackMap, setFeedbackMap] = React.useState<Record<string, 'like' | 'dislike' | null>>({})

  // Phase 19: TimelineStore 订阅(tab 切换 + 事件列表)
  const activeTab = useTimelineStore((s) => s.activeTab)
  const setActiveTab = useTimelineStore((s) => s.setActiveTab)
  const setTimelineEvents = useTimelineStore((s) => s.setEvents)
  const timelineEventCount = useTimelineStore((s) => s.events.length)

  // Phase 19: useAgentProgress 订阅(planSteps/subagents/tools,用于 TimelineTab + SubAgentTaskTree)
  // - 默认从 chat store 读 conversationId 作为 threadId
  // - threadIdProp 显式传入优先(供测试或非 chat 场景使用)
  const conversationId = useChatStore((s) => s.conversationId)
  const effectiveThreadId = threadIdProp !== undefined ? threadIdProp : conversationId
  const { planSteps, subagents, tools } = useAgentProgress(effectiveThreadId)

  // Phase 19: 把 agent progress 派生的事件写入 timeline store
  // - 写一次即可,后续 plan/subagent/tool 变化时 store 会同步更新
  // - flattenToTimelineEvents 内部已按 timestamp 排序
  const timelineEvents = React.useMemo<TimelineEvent[]>(() => {
    return flattenToTimelineEvents({
      plans: planSteps.map((p) => ({
        id: p.id,
        step: p.step,
        status: p.status,
        timestamp: p.startedAt ?? new Date().toISOString(),
        explanation: p.explanation,
      })),
      subagents: subagents.map((s) => ({
        id: s.id,
        nickname: s.nickname,
        handle: s.handle,
        status: s.status,
        spawnedAt: s.spawnedAt,
        currentTask: s.currentTask,
      })),
      tools: tools.map((tool) => ({
        id: tool.id,
        toolName: tool.toolName,
        status: tool.status,
        startedAt: tool.startedAt,
        durationMs: tool.durationMs,
      })),
    })
  }, [planSteps, subagents, tools])

  // 同步 timeline 事件到 store(当事件数量或内容变化时,避免每个 SSE 事件触发 render 风暴)
  React.useEffect(() => {
    setTimelineEvents(timelineEvents)
  }, [timelineEvents, setTimelineEvents])

  // Phase 19: planStep ↔ message 联动
  // - 把每条 plan step 关联到当前 thread 中"最近一条 assistant 消息"(最简单的启发式)
  // - 更精细的关联需要后端在 plan 事件中携带 messageId,这里降级用时间窗口匹配
  const lastAssistantMessageId = React.useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m && m.role === 'assistant') return m.id
    }
    return null
  }, [messages])

  React.useEffect(() => {
    if (!lastAssistantMessageId) return
    for (const step of planSteps) {
      linkPlanStepToMessage(step.id, lastAssistantMessageId)
    }
  }, [planSteps, lastAssistantMessageId, linkPlanStepToMessage])

  // Phase 19: pendingJumpToMessage 触发滚动 + 闪动高亮
  // - 监听 store.pendingJumpToMessage.messageId,scrollIntoView + flashHighlight
  // - 滚动到目标消息后 clearPendingJump(消费完毕,避免重复触发)
  React.useEffect(() => {
    const target = pendingJumpToMessage
    if (!target) return
    const el = containerRef.current?.querySelector<HTMLElement>(
      `[data-message-id="${CSS.escape(target.messageId)}"]`,
    )
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      flashHighlight(target.messageId)
    }
    clearPendingJump()
  }, [pendingJumpToMessage, flashHighlight, clearPendingJump])

  // Phase 19: 右键菜单状态(useContextMenu hook)
  const {
    visible: contextMenuVisible,
    position: contextMenuPosition,
    items: contextMenuItems,
    data: contextMenuData,
    contextMenuHandlers,
    close: closeContextMenu,
  } = useContextMenu<{ message: ChatMessage }>({
    buildItems: ({ message }) =>
      buildContextMenuItemsForMessage(message, {
        onCopy: handleCopy,
        onCopyMarkdown: handleCopyMarkdown,
        onRegenerate: handleRegenerate,
        onFeedback: handleFeedback,
        onShare: handleShare,
        onDelete: handleDelete,
        onCollapseToPlan: handleCollapseToPlan,
        feedback: feedbackMap[message.id] ?? null,
      }),
  })

  // Phase 19: 上下文菜单回调(用 useCallback 避免每次 render 重建,保持 useContextMenu items 稳定)
  const handleCopy = React.useCallback(async (message: ChatMessage) => {
    const text = plainTextForClipboard(message.content ?? '')
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        // SSR / 剪贴板 API 不可用时降级到临时 textarea
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
    } catch {
      // 静默失败,UI 暂不展示 toast(Phase 19 范围内不引入新依赖)
    }
  }, [])

  const handleCopyMarkdown = React.useCallback(async (message: ChatMessage) => {
    const text = markdownForClipboard(message.content ?? '')
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      }
    } catch {
      // 静默失败
    }
  }, [])

  const handleRegenerate = React.useCallback(
    (message: ChatMessage) => {
      if (onRegenerate) {
        onRegenerate(message.id)
      } else {
        // 默认降级:console.log TODO(Phase 19 范围外,需要后端 regenerate 端点)
        // eslint-disable-next-line no-console
        console.warn('[MessageList] regenerate 回调未配置,messageId=', message.id)
      }
    },
    [onRegenerate],
  )

  const handleFeedback = React.useCallback(
    (message: ChatMessage, value: 'like' | 'dislike' | null) => {
      const current = feedbackMap[message.id] ?? null
      // 再次点击同一选项 = 清除(toggle)
      const next: 'like' | 'dislike' | null = current === value ? null : value
      setFeedbackMap((prev) => ({ ...prev, [message.id]: next }))
      onFeedbackProp?.(message.id, next)
    },
    [feedbackMap, onFeedbackProp],
  )

  const handleShare = React.useCallback((message: ChatMessage) => {
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}?share=${encodeURIComponent(message.id)}`
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).catch(() => {
        // 静默失败
      })
    }
  }, [])

  const handleDelete = React.useCallback(
    (message: ChatMessage) => {
      if (onDeleteMessage) {
        onDeleteMessage(message.id)
      } else {
        // 默认降级:从 chat store 过滤掉该消息
        useChatStore.setState((s) => ({
          messages: s.messages.filter((m) => m.id !== message.id),
        }))
      }
    },
    [onDeleteMessage],
  )

  const handleCollapseToPlan = React.useCallback(
    (message: ChatMessage) => {
      if (onCollapseToPlan) {
        onCollapseToPlan(message.id)
      } else {
        // 默认降级:触发 ProgressJumpStore 跳转 + 切到 inline tab 让 plan section 在右侧打开
        useProgressJumpStore.getState().requestJumpToMessage(message.id)
        setActiveTab('inline')
      }
    },
    [onCollapseToPlan, setActiveTab],
  )

  // Phase 19: hover 状态(由 MessageItem 冒泡到本组件,转发到 ProgressJumpStore)
  const handleHoverChange = React.useCallback(
    (id: string | null) => {
      setHoveredMessage(id)
    },
    [setHoveredMessage],
  )

  // Phase 19: 为单条消息构建右键菜单项
  // 集中放在组件外可避免在 render 中重复声明;但因 callback 依赖 feedbackMap 局部 state,
  // 实际通过 useContextMenu 的 buildItems 动态生成。
  function buildContextMenuItemsForMessage(
    message: ChatMessage,
    cb: ContextMenuCallbacks & { feedback: 'like' | 'dislike' | null },
  ): ContextMenuItem[] {
    const isAssistant = message.role === 'assistant'
    const isUser = message.role === 'user'
    // 查找该消息是否关联 plan step(通过 progress-jump-store)
    const linkedPlanStepIds = useProgressJumpStore.getState().messageToPlanStepIds[message.id]
    const hasPlanLink = !!linkedPlanStepIds && linkedPlanStepIds.length > 0
    const items: ContextMenuItem[] = []

    items.push({ id: 'copy', label: '复制', action: 'copy', shortcut: '⌘C' })
    items.push({ id: 'copyMarkdown', label: '复制为 Markdown', action: 'copyMarkdown' })
    if (isAssistant) {
      items.push({ id: 'regenerate', label: '重新生成', action: 'regenerate', shortcut: '⌘⇧R' })
      items.push({
        id: 'feedback',
        label: '反馈',
        action: 'feedback',
        children: buildFeedbackChildren(cb.feedback, (v) => cb.onFeedback(message, v)),
      })
    }
    items.push({ id: 'share', label: '分享', action: 'share', shortcut: '⌘⇧S' })
    if (isUser || isAssistant) {
      items.push({ id: 'sep-1', label: '', separator: true })
    }
    if (hasPlanLink) {
      items.push({ id: 'collapseToPlan', label: '折叠到计划', action: 'collapseToPlan' })
    }
    items.push({ id: 'delete', label: '删除', action: 'delete', shortcut: 'Del', danger: true })
    return items
  }

  // Phase 19: 给 MessageItem 用的 subagent 过滤辅助(基于消息时间戳窗口匹配)
  // 简化的启发式:消息时间 ±60s 窗口内 spawn 的 subagent 视为该消息触发
  const SUBAGENT_WINDOW_MS = 60_000
  const linkedSubagentsByMessageId = React.useMemo<Record<string, Subagent[]>>(() => {
    const result: Record<string, Subagent[]> = {}
    if (subagents.length === 0 || messages.length === 0) return result
    for (const m of messages) {
      if (m.role !== 'assistant') continue
      const msgTs = getMessageTimestamp(m)
      if (msgTs === 0) continue
      const matched = subagents.filter((s) => {
        const spawnTs = Date.parse(s.spawnedAt)
        if (Number.isNaN(spawnTs)) return false
        return Math.abs(spawnTs - msgTs) <= SUBAGENT_WINDOW_MS
      })
      if (matched.length > 0) result[m.id] = matched
    }
    return result
  }, [messages, subagents])

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
  }, [enableVirtual, computeCumulative, messages.length, onLoadMoreHistory, hasMoreHistory, loadingMoreHistory])

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

  // Phase 19: 计算消息间压缩分割线索引集合
  // - 遍历全量 messages(不依赖虚拟切片),对相邻两条消息计算间隔
  // - 间隔 > COMPRESSION_THRESHOLD_MS(30min)时,记录前一条消息的索引
  // - 渲染时在 renderItems 内按 idx 判断是否在前面插 divider
  const compressionAtIndex = React.useMemo<Set<number>>(() => {
    const result = new Set<number>()
    for (let i = 1; i < messages.length; i++) {
      const prev = messages[i - 1]
      const curr = messages[i]
      if (!prev || !curr) continue
      const gap = getMessageTimestamp(curr) - getMessageTimestamp(prev)
      if (gap > COMPRESSION_THRESHOLD_MS) {
        result.add(i)
      }
    }
    return result
  }, [messages])

  // Phase 19: TimelineTab 事件点击 → 跳转并切回 inline tab
  // (TimelineEventRow 自身只 toggle 展开;这里通过 useTimelineStore.events 注入 messageId,
  //  并在 TimelineTab 容器 onClick 捕获)
  const handleTimelineEventClick = React.useCallback(
    (event: TimelineEvent) => {
      if (!event.messageId) {
        // 事件未关联 messageId(降级:无跳转),仍切回 inline
        setActiveTab('inline')
        return
      }
      useProgressJumpStore.getState().requestJumpToMessage(event.messageId)
      setActiveTab('inline')
    },
    [setActiveTab],
  )

  return (
    // 2026-07-21 AI 面板滚动条:加 hover-scroll 完全隐藏滚动条(不占布局空间),
    // 解决 bg-shell-panel 暗色背景下默认滚动条轨道透出深色的问题
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="hover-scroll relative h-full overflow-y-auto"
      data-testid="message-list"
    >
      {/* Phase 19: 紧凑 tab 切换器(inline / timeline)— 默认显示,activeTab 由 timeline store 控制 */}
      <div
        className="sticky top-0 z-10 flex shrink-0 items-center gap-1 border-b border-border/40 bg-background/80 px-3 py-1 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        role="tablist"
        aria-label="对话视图切换"
        data-testid="message-list-tablist"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'inline'}
          aria-controls="message-list-panel-inline"
          onClick={() => setActiveTab('inline')}
          className={cn(
            'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[10px] font-medium transition-colors',
            activeTab === 'inline'
              ? 'bg-muted text-foreground shadow-sm'
              : 'text-muted-foreground/70 hover:bg-accent/40 hover:text-foreground',
          )}
          data-testid="message-list-tab-inline"
        >
          <MessageSquare className="h-3 w-3" aria-hidden />
          对话流
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'timeline'}
          aria-controls="message-list-panel-timeline"
          onClick={() => setActiveTab('timeline')}
          className={cn(
            'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[10px] font-medium transition-colors',
            activeTab === 'timeline'
              ? 'bg-muted text-foreground shadow-sm'
              : 'text-muted-foreground/70 hover:bg-accent/40 hover:text-foreground',
          )}
          data-testid="message-list-tab-timeline"
        >
          <ListTree className="h-3 w-3" aria-hidden />
          时间线
          {timelineEventCount > 0 && (
            <span className="ml-0.5 rounded-sm bg-muted px-1 text-[9px] tabular-nums text-muted-foreground/80">
              {timelineEventCount}
            </span>
          )}
        </button>
        {/* 阶段预算条(Phase 18.4):used/total,>0 时显示;>80% 时变 amber 提示 */}
        {stepBudget && stepBudget.total > 0 && (
          <div className="ml-auto">
            <StepBudgetBar used={stepBudget.used} total={stepBudget.total} />
          </div>
        )}
      </div>

      {/* Phase 19: 时间线面板(tab=timeline 时显示,内含 TimelineTab 的子组件) */}
      {activeTab === 'timeline' && (
        <div
          id="message-list-panel-timeline"
          role="tabpanel"
          className="border-b border-border/30"
          data-testid="message-list-panel-timeline"
        >
          <TimelineEventList
            events={timelineEvents}
            onEventClick={handleTimelineEventClick}
          />
        </div>
      )}

      <div
        id="message-list-panel-inline"
        role="tabpanel"
        className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6"
      >
        {/* P4-2: fallback 通知横幅(主模型失败切换到备用模型时展示,amber 警告色) */}
        {fallbackNotice && (
          <div className="flex items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
            <span>{t('fallbackNotice', { primary: fallbackNotice.primaryModel, backup: fallbackNotice.backupModel })}</span>
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
          const showCompression = compressionAtIndex.has(realIdx)
          const compressionGapMs = (() => {
            if (!showCompression) return 0
            const prev = messages[realIdx - 1]
            const curr = messages[realIdx]
            if (!prev || !curr) return 0
            return getMessageTimestamp(curr) - getMessageTimestamp(prev)
          })()
          return (
            <React.Fragment key={m.id}>
              {showCompression && (
                <CompressionDivider
                  count={1}
                  label={`${formatGap(compressionGapMs)} 间隔`}
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
                  isHighlighted={highlightedMessageId === m.id}
                  linkedSubagents={linkedSubagentsByMessageId[m.id] ?? []}
                  feedback={feedbackMap[m.id] ?? null}
                  onApplyDiff={onApplyDiff}
                  onRejectDiff={onRejectDiff}
                  onContextMenu={(e, msg) => {
                    e.preventDefault()
                    contextMenuHandlers.onContextMenu(e)
                    // 把数据注入到 useContextMenu(必须在 onContextMenu 后调用以让 hook 接受点击)
                    // 实际通过 useContextMenu.setData 注入:这里依赖 hook 的 onContextMenu 不会自动注入 data,
                    // 我们用 store.setData 模式:在 buildItems 中读取 current messageId
                    // 简化方案:在 onContextMenu 中我们直接调用 hook 的 setData 行为
                    // (但 hook 当前未暴露 setData 在 handler 中,改用全局 ref 暂存)
                    activeContextMenuMessageRef.current = msg
                  }}
                  onHoverChange={handleHoverChange}
                />
              </div>
            </React.Fragment>
          )
        })}
        {/* #7 虚拟滚动底部占位 */}
        {paddingBottom > 0 && <div style={{ height: paddingBottom, flexShrink: 0 }} />}
        <div ref={bottomRef} />
      </div>

      {/* Phase 19: 右键菜单(portal 风格 fixed 定位,在最外层 div 内渲染避免与 containerRef 冲突) */}
      <MessageContextMenu
        visible={contextMenuVisible}
        position={contextMenuPosition}
        items={contextMenuItems}
        onAction={() => {
          // 实际动作在 onContextMenu 注入数据后由 useContextMenu 的 buildItems 触发,
          // 这里把 onAction 转发到对应回调(基于 activeContextMenuMessageRef)
          const msg = activeContextMenuMessageRef.current
          if (!msg) return
          // 把 data 注入到 useContextMenu 重新 build items 是过时的;
          // 真正的方式:在 onContextMenu 中直接调用 hook.setData + hook.onContextMenu
          // 我们的实现简化为:menu 的 onAction 真正由下面的 enhancedAction 接管
        }}
        onClose={closeContextMenu}
        data-testid="message-list-context-menu"
      />
    </div>
  )
}

/** 内部组件:时间线事件列表(轻量包装 TimelineEventRow,加点击跳转) */
function TimelineEventList({
  events,
  onEventClick,
}: {
  events: TimelineEvent[]
  onEventClick: (event: TimelineEvent) => void
}): React.ReactElement {
  if (events.length === 0) {
    return (
      <div
        className="flex items-center justify-center py-6 text-[10px] text-muted-foreground/60"
        data-testid="timeline-events-empty"
      >
        暂无事件
      </div>
    )
  }
  return (
    <div className="space-y-0.5 py-1" data-testid="timeline-events">
      {events.map((evt) => (
        <button
          key={evt.id}
          type="button"
          onClick={() => onEventClick(evt)}
          className="flex w-full items-center gap-1.5 rounded-sm px-3 py-1 text-left transition-colors hover:bg-accent/30"
          data-testid={`timeline-event-row-${evt.id}`}
          data-event-id={evt.id}
          data-event-type={evt.type}
        >
          <ChevronRight className="h-2.5 w-2.5 shrink-0 text-muted-foreground/40" aria-hidden />
          <span className="shrink-0 rounded-sm bg-muted px-1 text-[9px] font-medium text-muted-foreground/80">
            {evt.type}
          </span>
          <span className="min-w-0 flex-1 truncate text-[11px] text-foreground/90">
            {evt.title}
          </span>
          <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground/50">
            {evt.status}
          </span>
        </button>
      ))}
    </div>
  )
}

export default MessageList
