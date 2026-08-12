'use client'

import * as React from 'react'
import Image from 'next/image'
import {
  Loader2,
  Copy,
  Check,
  RefreshCw,
  ArrowDown,
  Search,
  Star,
  Share2,
  Pencil,
  Trash2,
  MessageCircle,
  BarChart3,
  Eye,
  EyeOff,
  Download,
  Code,
  Megaphone,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { FallbackEvent } from '@ihui/api-client'
import { CommunityPublishDialog } from '@/components/chat/community-publish-dialog'

import type { ChatMessage } from '@/stores/chat'
import type { InlineDiffInfo, SubAgentActivity } from '@/components/ai/types'
import { MarkdownStream } from '@/components/ai/markdown-stream'
import { ToolCallCard, deriveDiffInfo } from '@/components/ai/tool-call-card'
import { PromptTemplates } from '@/components/ai/prompt-templates'
import { CompressionDivider } from '@/components/ai/progress-sections/compression-divider'
import { PlanStepsCard } from '@/components/ai/progress-sections/plan-steps-card'
// 2026-07-31 立,AI 对话可视化深度接入:把 popover 内的富 UI 组件 inline 到消息气泡主流
import { ThinkingSection } from '@/components/ai/progress-sections/thinking-section'
import { ToolCallSummaryCard } from '@/components/ai/progress-sections/tool-call-summary-card'
// 2026-08-01 Phase 4b/4c/4d:消息级 subagent/terminal/plan 组件 inline 到消息气泡
import { SubAgentActivityFeed } from '@/components/ai/sub-agent-activity-feed'
import { TerminalSection } from '@/components/ai/progress-sections/terminal-section'
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
import { Tooltip } from '@/components/feedback'
import { cn } from '@/lib/utils'

function TypingIndicator({
  reasoning,
  toolCalls,
}: {
  reasoning?: string
  toolCalls?: ChatMessage['toolCalls']
}) {
  // 2026-08-06:三个跳动点 → 一行实时状态小字。
  // 按当前进度动态显示:正在调用工具:xxx / 模型思考中… / 正在等待模型响应…
  const runningTool = toolCalls?.find((tc) => tc.status === 'running')
  let statusText = '正在等待模型响应…'
  if (runningTool) {
    statusText = `正在调用工具:${runningTool.toolName}`
  } else if (reasoning && reasoning.length > 0) {
    statusText = '模型思考中…'
  }
  // 光道效果:文字渐变 + shimmer 动画,高光从左到右反复扫过(animations.css @keyframes shimmer)
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary/70" />
      <span
        className="bg-clip-text text-xs font-medium text-transparent"
        style={{
          backgroundImage:
            'linear-gradient(90deg, hsl(var(--color-muted-foreground)) 0%, hsl(var(--color-primary)) 50%, hsl(var(--color-muted-foreground)) 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 2.2s linear infinite',
          WebkitBackgroundClip: 'text',
        }}
      >
        {statusText}
      </span>
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

/** 元数据 usage 展开面板(2026-08-02 立,原项目 toggleMetadata 展开内容)
 *  展示 promptTokens / completionTokens / totalTokens 细分,类型安全读取 unknown 字段 */
function UsageBreakdown({ usage }: { usage: unknown }) {
  if (typeof usage !== 'object' || usage === null) return null
  const u = usage as Record<string, unknown>
  const prompt = typeof u.promptTokens === 'number' ? u.promptTokens : null
  const completion = typeof u.completionTokens === 'number' ? u.completionTokens : null
  const total = typeof u.totalTokens === 'number' ? u.totalTokens : null
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {prompt !== null && (
        <span className="text-muted-foreground">
          Prompt: <span className="font-medium text-foreground">{prompt}</span>
        </span>
      )}
      {completion !== null && (
        <span className="text-muted-foreground">
          Completion: <span className="font-medium text-foreground">{completion}</span>
        </span>
      )}
      {total !== null && (
        <span className="text-muted-foreground">
          Total: <span className="font-medium text-foreground">{total}</span>
        </span>
      )}
    </div>
  )
}

// 2026-08-02:消息交互按钮基础样式(完全复用原项目 AIChat.vue 统一按钮系统)
// --fcd-btn-size:28px → h-7 w-7 | --fcd-btn-radius:6px → rounded-md | --fcd-btn-icon-size:16px → h-4 w-4
// _message-list.scss .message-actions: display:flex; gap:8px; opacity:1(始终显示)
const ACTION_BTN_CLASS =
  'inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-primary hover:bg-muted/60 transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

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
  onApplyDiff,
  onRejectDiff,
  isHighlighted = false,
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
  // Copy 按钮短暂"已复制"状态(2026-07-28 立),1.5s 后自动隐藏
  const [copied, setCopied] = React.useState(false)
  const copyTimerRef = React.useRef<number | null>(null)
  // 2026-07-28 立:Reasoning 折叠状态(2026-07-28 抽出为独立 state,供外部事件如键盘 Enter 切换)
  // 默认 false(折叠),点击展开按钮 / 收到 'ihui:toggle-reasoning' 事件时切换
  const [reasoningExpanded, setReasoningExpanded] = React.useState(false)
  // 监听全局 'ihui:toggle-reasoning' 事件:键盘 Enter 聚焦消息触发,只响应本条消息
  React.useEffect(() => {
    // 2026-08-02 修复: Bug 6 — 把 if (!m.reasoning) return 移到 listener 内部,
    // 否则 m.reasoning 后到达时才注册 listener,之前 toggle 事件已丢失。
    const onToggle = (e: Event) => {
      if (!m.reasoning) return
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

  // 2026-08-02:AI 消息交互按钮回调(完全复用原项目 AIChat.vue 按钮清单)
  // 优先用全局 CustomEvent 派发(与右键菜单一致),由 message-input / 父组件监听
  // 回调缺失的用 toast 兜底(与右键菜单 feedback 一致)

  // 重新生成(对应原项目 regenerateMessage)
  const handleRegenerate = React.useCallback(() => {
    window.dispatchEvent(
      new CustomEvent('ihui:regenerate-message', { detail: { messageId: m.id } }),
    )
    toast.info(t('regenerating') === 'regenerating' ? 'Regenerating...' : t('regenerating'))
  }, [m.id, t])

  // 删除消息(对应原项目 deleteMessage,逻辑从右键菜单提取)
  const handleDelete = React.useCallback(() => {
    const store = useChatStore.getState()
    const next = store.messages.filter((msg) => msg.id !== m.id)
    if (next.length !== store.messages.length) {
      useChatStore.setState({ messages: next })
      toast.success(t('messageDeleted') === 'messageDeleted' ? 'Deleted' : t('messageDeleted'))
    }
  }, [m.id, t])

  // 点赞(对应原项目 toggleLike)— 预留事件,toast 兜底
  const handleLike = React.useCallback(() => {
    window.dispatchEvent(new CustomEvent('ihui:like-message', { detail: { messageId: m.id } }))
    toast.success(t('feedbackRecorded') === 'feedbackRecorded' ? 'Liked' : t('feedbackRecorded'))
  }, [m.id, t])

  // 分享(对应原项目 shareAssistantMessage)— navigator.share 优先,剪贴板兜底
  const handleShare = React.useCallback(async () => {
    const text = plainTextForClipboard(m.content)
    try {
      if (navigator.share) {
        await navigator.share({ text })
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        toast.success(t('copied') === 'copied' ? 'Copied to share' : t('copied'))
      }
    } catch {
      // 用户取消分享时不报错
    }
  }, [m.content, t])

  // 回复(对应原项目 replyToMessage)— 预留事件
  const handleReply = React.useCallback(() => {
    window.dispatchEvent(new CustomEvent('ihui:reply-message', { detail: { messageId: m.id } }))
  }, [m.id])

  // 编辑(对应原项目 editMessage)— toast 兜底
  const handleEdit = React.useCallback(() => {
    toast.info(t('editComingSoon') === 'editComingSoon' ? 'Edit coming soon' : t('editComingSoon'))
  }, [t])

  // 2026-08-02:补建原项目 AIChat.vue 4 个缺失 AI 消息按钮
  // 1. 内容可见性切换(Eye/EyeOff)— 原项目 toggleAssistantContentVisibility
  const [contentVisible, setContentVisible] = React.useState(true)
  const handleToggleVisibility = React.useCallback(() => {
    setContentVisible((prev) => !prev)
  }, [])

  // 2. 下载图片(Download)— 原项目 downloadAssistantImages
  // 从 toolCalls 提取所有 image_url,触发浏览器下载
  const messageImages = React.useMemo(() => {
    if (!m.toolCalls) return []
    return m.toolCalls
      .map((tc) => tc.image_url)
      .filter((url): url is string => typeof url === 'string' && url.length > 0)
  }, [m.toolCalls])
  const handleDownloadImages = React.useCallback(() => {
    if (messageImages.length === 0) return
    messageImages.forEach((url, idx) => {
      const a = document.createElement('a')
      a.href = url
      a.download = `ai-image-${m.id}-${idx + 1}`
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    })
    toast.success(
      t('downloadStarted') === 'downloadStarted' ? 'Download started' : t('downloadStarted'),
    )
  }, [messageImages, m.id, t])

  // 3. 元数据 toggle(Code)— 原项目 toggleMetadata,展开/折叠 usage 细分面板
  const [metadataExpanded, setMetadataExpanded] = React.useState(false)
  const handleToggleMetadata = React.useCallback(() => {
    setMetadataExpanded((prev) => !prev)
  }, [])
  const hasMetadata = Boolean(m.meta?.usage) && typeof m.meta?.usage === 'object'

  // 4. 发布到社区(Megaphone)— 原项目 publishToCommunity
  const [publishDialogOpen, setPublishDialogOpen] = React.useState(false)

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
  const handleMouseEnter = React.useCallback(() => {
    onMessageHover?.(m.id, linkedPlanStepId)
  }, [onMessageHover, m.id, linkedPlanStepId])
  const handleMouseLeave = React.useCallback(() => {
    onMessageHover?.(m.id, null)
  }, [onMessageHover, m.id])

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
        'group/msg relative flex w-full flex-col gap-1 px-1',
        isUser ? 'items-end' : 'items-start',
        isHighlighted && 'ring-1 ring-ring/30 animate-message-highlight-pulse',
        isFocused && 'ring-1 ring-ring/40',
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
      {/* 2026-08-02:用户消息保留气泡(rounded-lg),AI 消息无气泡平铺 */}
      {/* 2026-08-06:用户消息气泡 bg-primary → bg-muted + text-foreground(亮色浅灰黑字/暗色深灰白字,降低视觉突兀感) */}
      {/* 2026-08-06:AI 消息 w-full 占满可用宽度 —— 原 max-w-[85%] 导致右侧 15% 留白、
          表格(如架构表)被压缩到 85% 内显示不全;表格自身 overflow-x-auto 已保证超宽可横滚 */}
      <div
        className={cn(
          isUser
            ? 'relative max-w-[85%] rounded-lg rounded-br-sm bg-muted px-4 py-2.5 text-foreground'
            : m.error
              ? 'w-full text-destructive'
              : 'w-full text-left',
        )}
      >
        {showTyping ? (
          // P0 修复(2026-08-02):TypingIndicator 加 fade-in,流式开始时平滑出现;
          // 内容区(下方 div)也加 fade-in,第一个 token 到达时平滑替换 TypingIndicator,
          // 避免硬切换造成的短暂空白闪烁(TypingIndicator 硬切 → 内容区 fade-in 0→1 过渡)
          <div className="animate-in fade-in-0 duration-150 fill-mode-both">
            <TypingIndicator reasoning={m.reasoning} toolCalls={m.toolCalls} />
          </div>
        ) : isUser ? (
          // 2026-08-02:用户消息字号同步调整 14px → 15px(text-[15px]),与 AI 消息对齐
          <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{m.content}</p>
        ) : (
          <div
            className={cn(
              'space-y-2 animate-in fade-in-0 duration-150 fill-mode-both',
              // 2026-08-02:内容可见性切换(Eye/EyeOff)— 折叠时限高,仅显示前几行
              !contentVisible && 'max-h-20 overflow-hidden',
            )}
          >
            {m.reasoning && (
              <ThinkingSection
                content={m.reasoning}
                currentNode={null}
                isStreaming={streamingThis}
                expanded={reasoningExpanded}
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
                      artifacts: Array.isArray(tcResult.artifacts) ? tcResult.artifacts : undefined,
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
                  serverSource={tc.serverSource}
                  serverId={tc.serverId}
                  serverName={tc.serverName}
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
            {/* 2026-07-31 立,AI 对话可视化深度接入:工具调用汇总卡片 inline 到 AI 回复末尾
                - 优先用 SSE tool-summary 事件聚合结果(m.toolCallSummary)
                - 缺失时降级从 m.toolCalls 本地聚合
                - 显示:文件搜索 N 个 / 网页搜索 N 个 / 修改 N 个文件 / +N -N 行 / 耗时 */}
            <ToolCallSummaryCard
              summary={m.toolCallSummary}
              toolCalls={m.toolCalls}
              isStreaming={streamingThis}
              data-testid={`message-tool-call-summary-${m.id}`}
            />
            {/* 2026-08-01 Phase 4b/4c/4d:消息级 subagent/terminal/plan inline 到消息气泡
                - subagentActivities:SubAgentActivityFeed 实时刷新 subagent 生命周期
                - terminalTasks:TerminalSection 展示命令执行 + 输出
                - planSteps:PlanStepsCard 展示计划步骤
                - 仅当消息级数据存在时渲染(后端 SSE 事件携带 messageId 时填充) */}
            {m.subagentActivities && m.subagentActivities.length > 0 && (
              <SubAgentActivityFeed
                swarmId={m.id}
                activities={m.subagentActivities}
                completed={!streamingThis}
              />
            )}
            {m.terminalTasks && m.terminalTasks.length > 0 && (
              <TerminalSection terminals={m.terminalTasks} />
            )}
            {m.planSteps && m.planSteps.length > 0 && (
              <PlanStepsCard
                steps={m.planSteps}
                isStreaming={streamingThis}
                data-testid={`message-plan-steps-${m.id}`}
              />
            )}
          </div>
        )}
      </div>
      {/* 2026-08-02:消息交互按钮区(完全复用原项目 AIChat.vue 9 按钮 + _message-list.scss 样式)
          - 2026-08-06 修正:从气泡容器内挪到气泡外(与气泡容器同级,作为消息项子节点)
            避免被 bg-primary 包裹导致按钮显示在气泡内部
          - opacity:1 始终显示(原项目 _message-list.scss line 199-205)
          - gap:8px(原项目 .message-actions gap:8px)
          - 按钮 28x28px / 6px 圆角 / 16px 图标(原项目 --fcd-btn-size/--fcd-btn-radius/--fcd-btn-icon-size)
          - AI 消息(9按钮): Eye/EyeOff / Like / Copy / Download(条件) / Share / Code(条件) / Regenerate / Megaphone / Reply + Token(条件)
          - 用户消息(4按钮): Copy / Edit / Reply / Delete */}
      {!streamingThis && m.content.length > 0 && (
          <div
            // 2026-08-06:默认隐藏,仅 hover 消息时显示(触屏常显,animations.css .msg-hover-reveal)
            className="msg-hover-reveal flex items-center gap-2 mt-1"
            data-testid={`message-actions-${m.id}`}
          >
            {/* AI 消息:Eye/EyeOff(内容可见性切换)— 原项目 toggleAssistantContentVisibility */}
            {!isUser && (
              <Tooltip content={contentVisible ? 'Hide content' : 'Show content'}>
                <button
                  type="button"
                  onClick={handleToggleVisibility}
                  data-testid={`message-visibility-${m.id}`}
                  aria-label={contentVisible ? 'Hide content' : 'Show content'}
                  className={ACTION_BTN_CLASS}
                >
                  {contentVisible ? (
                    <Eye className="h-4 w-4" aria-hidden />
                  ) : (
                    <EyeOff className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </Tooltip>
            )}
            {/* AI 消息:Like(点赞)— 原项目 toggleLike,hover 琥珀色 */}
            {!isUser && (
              <Tooltip content="Like" side="top">
                <button
                  type="button"
                  onClick={handleLike}
                  data-testid={`message-like-${m.id}`}
                  aria-label="Like"
                  className={cn(ACTION_BTN_CLASS, 'hover:text-amber-500')}
                >
                  <Star className="h-4 w-4" aria-hidden />
                </button>
              </Tooltip>
            )}
            {/* Copy(复制)— AI + 用户,原项目 copyMessage */}
            <Tooltip content={copyLabel} side="top">
              <button
                type="button"
                onClick={handleCopy}
                data-testid={`message-copy-${m.id}`}
                aria-label={copyLabel}
                className={ACTION_BTN_CLASS}
              >
                {copied ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden />
                )}
              </button>
            </Tooltip>
            {/* AI 消息:Download(下载图片)— 原项目 downloadAssistantImages,有图片时显示 */}
            {!isUser && messageImages.length > 0 && (
              <Tooltip content="Download images" side="top">
                <button
                  type="button"
                  onClick={handleDownloadImages}
                  data-testid={`message-download-${m.id}`}
                  aria-label="Download images"
                  className={ACTION_BTN_CLASS}
                >
                  <Download className="h-4 w-4" aria-hidden />
                </button>
              </Tooltip>
            )}
            {/* AI 消息:Share(分享)— 原项目 shareAssistantMessage */}
            {!isUser && (
              <Tooltip content="Share" side="top">
                <button
                  type="button"
                  onClick={handleShare}
                  data-testid={`message-share-${m.id}`}
                  aria-label="Share"
                  className={ACTION_BTN_CLASS}
                >
                  <Share2 className="h-4 w-4" aria-hidden />
                </button>
              </Tooltip>
            )}
            {/* AI 消息:Code(元数据 toggle)— 原项目 toggleMetadata,有 metadata 时显示 */}
            {!isUser && hasMetadata && (
              <Tooltip content="Toggle metadata" side="top">
                <button
                  type="button"
                  onClick={handleToggleMetadata}
                  data-testid={`message-metadata-${m.id}`}
                  aria-label="Toggle metadata"
                  className={cn(ACTION_BTN_CLASS, metadataExpanded && 'text-primary bg-muted/60')}
                >
                  <Code className="h-4 w-4" aria-hidden />
                </button>
              </Tooltip>
            )}
            {/* AI 消息:Regenerate(重新生成)— 原项目 regenerateMessage,streaming 时禁用 */}
            {!isUser && (
              <Tooltip content="Regenerate" side="top">
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={streamingThis}
                  data-testid={`message-regenerate-${m.id}`}
                  aria-label="Regenerate"
                  className={cn(ACTION_BTN_CLASS, 'disabled:opacity-40 disabled:cursor-not-allowed')}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden />
                </button>
              </Tooltip>
            )}
            {/* AI 消息:Megaphone(发布到社区)— 原项目 publishToCommunity,Promotion 图标不在 lucide-react 用 Megaphone 替代 */}
            {!isUser && (
              <Tooltip content="Publish to community" side="top">
                <button
                  type="button"
                  onClick={() => setPublishDialogOpen(true)}
                  data-testid={`message-publish-${m.id}`}
                  aria-label="Publish to community"
                  className={ACTION_BTN_CLASS}
                >
                  <Megaphone className="h-4 w-4" aria-hidden />
                </button>
              </Tooltip>
            )}
            {/* 用户消息:Edit(编辑)— 原项目 editMessage */}
            {isUser && (
              <Tooltip content="Edit" side="top">
                <button
                  type="button"
                  onClick={handleEdit}
                  data-testid={`message-edit-${m.id}`}
                  aria-label="Edit"
                  className={ACTION_BTN_CLASS}
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                </button>
              </Tooltip>
            )}
            {/* Reply(回复)— AI + 用户,原项目 replyToMessage */}
            <Tooltip content="Reply" side="top">
              <button
                type="button"
                onClick={handleReply}
                data-testid={`message-reply-${m.id}`}
                aria-label="Reply"
                className={ACTION_BTN_CLASS}
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
              </button>
            </Tooltip>
            {/* 用户消息:Delete(删除)— 原项目 deleteMessage,hover 红色 */}
            {isUser && (
              <Tooltip content="Delete" side="top">
                <button
                  type="button"
                  onClick={handleDelete}
                  data-testid={`message-delete-${m.id}`}
                  aria-label="Delete"
                  className={cn(ACTION_BTN_CLASS, 'hover:text-destructive hover:bg-destructive/10')}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </Tooltip>
            )}
            {/* AI 消息:Token 计数(条件显示)— 原项目 .token-usage,有 metadata.usage 时渲染 */}
            {!isUser && hasMetadata && 'totalTokens' in (m.meta?.usage as object) && (
              <span
                className="inline-flex items-center gap-1 text-xs text-muted-foreground ml-2"
                data-testid={`message-token-${m.id}`}
              >
                <BarChart3 className="h-3.5 w-3.5" aria-hidden />
                <span className="font-medium">
                  {(m.meta?.usage as { totalTokens: number }).totalTokens} tokens
                </span>
              </span>
            )}
          </div>
        )}
        {/* AI 消息:元数据展开面板(Code 按钮切换)— 原项目 metadata 详情
            展示 promptTokens / completionTokens / totalTokens 细分 */}
        {!isUser && hasMetadata && metadataExpanded && (
          <div
            className="mt-1.5 rounded-md border border-border bg-muted/30 p-2 text-xs"
            data-testid={`message-metadata-panel-${m.id}`}
          >
            <UsageBreakdown usage={m.meta?.usage} />
          </div>
        )}
      {showTimestamp && (
        <div
          className={cn(
            // 2026-08-06:时间戳默认隐藏,仅 hover 消息时显示(触屏常显)
            'msg-hover-reveal flex items-center gap-1.5 whitespace-nowrap px-1 text-[10px] tabular-nums text-muted-foreground/50',
            isUser ? 'justify-end' : 'justify-start',
          )}
          data-testid={`message-timestamp-${m.id}`}
        >
          <span>{timestampLabel}</span>
        </div>
      )}
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
            'hover:bg-accent/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          )}
        >
          <RefreshCw className="h-3 w-3" aria-hidden />
          <span>{t('retry') === 'retry' ? 'Retry' : t('retry')}</span>
        </button>
      )}
      {/* 2026-08-02:社区发布对话框(Megaphone 按钮触发)— 原项目 publishToCommunity */}
      {!isUser && (
        <CommunityPublishDialog
          open={publishDialogOpen}
          onOpenChange={setPublishDialogOpen}
          content={plainTextForClipboard(m.content)}
          images={messageImages}
        />
      )}
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
  // 2026-08-02 修复 P1(问题 6-1/6-2):messages 镜像 ref。
  // 原键盘 useEffect 依赖 [messages],每个 token 触发 listener 拆卸/重装,
  // 高频流下每秒数十次 DOM 监听器抖动 + 微秒窗口内按键可能丢失。
  // 改用 ref 镜像后 effect 依赖可去掉 messages,listener 仅挂载一次。
  const messagesRef = React.useRef(messages)
  messagesRef.current = messages
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
    // P0 修复(2026-08-02):hysteresis 滞后 50px,避免边界抖动
    // - 未显示按钮时:distanceFromBottom > 120(UPPER)才显示(向上滚超过 120px)
    // - 已显示按钮时:distanceFromBottom > 70(LOWER)才保持显示,否则隐藏(向下滚低于 70px)
    // - 70~120px 之间保持当前状态,用户在边界附近微小滚动不会触发按钮频繁显隐
    const UPPER_THRESHOLD = 120
    const LOWER_THRESHOLD = 70
    const currentlyScrolledUp = userScrolledUpMirrorRef.current
    const scrolledUp = currentlyScrolledUp
      ? distanceFromBottom > LOWER_THRESHOLD
      : distanceFromBottom > UPPER_THRESHOLD
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
      // 2026-08-02 修复: Bug 1 — onLoadMoreHistory 是 void(非 Promise),异步加载未完成时
      // 单次 rAF 调整 scrollTop 无效(scrollHeight 还没变)。改用轮询:持续 rAF 检查 scrollHeight
      // 显著变化(>50px,跳过 loading 指示器 ~30px 的小幅增长),prepend 完成后立即调整 scrollTop,
      // 5s 超时防泄漏(网络失败等场景)。
      const startTime = Date.now()
      const checkScroll = () => {
        if (!containerRef.current) return
        const newScrollHeight = containerRef.current.scrollHeight
        if (newScrollHeight > prevScrollHeight + 50) {
          containerRef.current.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight)
          return
        }
        if (Date.now() - startTime > 5000) return
        requestAnimationFrame(checkScroll)
      }
      requestAnimationFrame(checkScroll)
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
      // P0 优化(2026-08-02):清空 planSteps 缓存,避免旧会话条目累积
      completedPlanStepsRef.current.clear()
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
      // 2026-08-02 修复 P1(问题 6-1):用 messagesRef.current 读最新 messages,
      // effect 依赖仅 [setFocusedIndexBoth](稳定引用),listener 仅挂载一次,
      // 避免每个 token 触发拆卸/重装造成 DOM 监听器抖动 + 按键丢失。
      const msgs = messagesRef.current
      if (msgs.length === 0) return
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
          focusedIndexRef.current < 0 ? 0 : Math.min(msgs.length - 1, focusedIndexRef.current + 1)
        setFocusedIndexBoth(next)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const next =
          focusedIndexRef.current < 0 ? msgs.length - 1 : Math.max(0, focusedIndexRef.current - 1)
        setFocusedIndexBoth(next)
      } else if (e.key === 'Home') {
        e.preventDefault()
        setFocusedIndexBoth(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        setFocusedIndexBoth(msgs.length - 1)
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
          const m = msgs[idx]
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
  }, [setFocusedIndexBoth])

  // 2026-07-28 立:focused message 变更后自动 scrollIntoView(确保可见)
  // 配合键盘 ↑/↓ 用,避免焦点切到屏幕外时用户看不到
  // 2026-08-02 修复 P2(问题 6-2):依赖去掉 messages,改用 messagesRef.current 读最新。
  // 原 [focusedIndex, messages] 每个 token 触发 effect 重跑,即使 focusedIndex 未变
  // 仍执行 querySelector + scrollIntoView,造成不必要的 DOM 查询和滚动。
  React.useEffect(() => {
    const msgs = messagesRef.current
    if (focusedIndex < 0 || focusedIndex >= msgs.length) return
    const id = msgs[focusedIndex]?.id
    if (!id) return
    const el = containerRef.current?.querySelector(
      `[data-message-id="${id}"]`,
    ) as HTMLElement | null
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [focusedIndex])

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

  // 最后一条 assistant 消息 ID(用于 planSteps 状态判定 + subagent 关联)
  const lastAssistantMessageId = React.useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m && m.role === 'assistant') return m.id
    }
    return null
  }, [messages])

  // P0 流式性能优化(2026-08-02):缓存"已完成" assistant 消息的 planSteps
  // - 每个 token 到达 → messages 引用变化 → planSteps useMemo 重算 + linkPlanStepToMessage effect 触发写 store
  // - 已完成消息(非最后一条 / 非流式中)的 planSteps 不会变,缓存命中跳过 O(stepsPerMessage) 重算
  // - key 用 msg.id,切换会话(messages.length===0)时清空(见上方 cleanup effect)
  // - 语言切换时 next-intl 返回新 t 引用 → 触发 useMemo 重算 → prevTRef 检测到变化清空缓存,避免旧翻译残留
  const completedPlanStepsRef = React.useRef<Map<string, PlanStep[]>>(new Map())
  const prevTRef = React.useRef<typeof t | null>(null)

  // PlanStepsCard 数据源(2026-07-31 深度优化,对标 Codex /plan + Trae Thinking Process):
  // 普通对话走 streamChat → /api/ai/chat/stream → /api/llm/complete/stream,
  // 不经过 LangGraph agent,因此 useAgentProgress.start() 即使接通也得不到 plan events
  // (且 graph 未注册时返回 503)。改为基于 messages 派生 planSteps,覆盖 3 类步骤:
  //   ① reasoning(推理模型思考过程)→ "思考" 步骤(完整保留 explanation,不截断)
  //   ② toolCalls(工具调用)→ 每个工具一个步骤(带 error 标记 + 完整 duration)
  //   ③ content(最终回答)→ "回答" 步骤
  // 深度优化字段:
  //   - error: toolCalls status=error 时为 true,PlanStepsCard 显示红色错误样式
  //   - sourceMessageId: 关联消息 ID,用于点击步骤跳转消息 + hover 联动
  //   - groupIndex: 同一条 assistant 消息的步骤同组,组间视觉分隔
  const planSteps = React.useMemo<PlanStep[]>(() => {
    // 语言切换时清空缓存(避免缓存中保留旧翻译,t 加入 deps 确保 useMemo 在 t 变化时重算)
    if (prevTRef.current !== t) {
      completedPlanStepsRef.current.clear()
      prevTRef.current = t
    }
    const steps: PlanStep[] = []
    const assistantMsgs = messages.filter((m) => m.role === 'assistant')
    assistantMsgs.forEach((msg, idx) => {
      const groupIndex = idx
      const isLast = msg.id === lastAssistantMessageId
      const isStreamingThis = isLast && isStreaming

      // P0 优化:已完成消息(非最后一条 或 非流式中)的 planSteps 不会变,优先读缓存
      // - 流式中:只有最后一条 assistant 消息每次重算(token 变化),其余命中缓存
      // - 流式结束:最后一条消息也变为已完成,首次重算后缓存,后续渲染命中缓存
      const isCompleted = !isLast || !isStreaming
      if (isCompleted) {
        const cached = completedPlanStepsRef.current.get(msg.id)
        if (cached) {
          steps.push(...cached)
          return
        }
      }

      const msgSteps: PlanStep[] = []

      // ① reasoning → "思考" 步骤(reasoning 模型输出,如 o1/R1)
      //    explanation 完整保留(不截断),PlanStepsCard 内部用 MarkdownViewer 渲染
      if (msg.reasoning && msg.reasoning.trim().length > 0) {
        msgSteps.push({
          id: `${msg.id}-reasoning`,
          step: t('stepThinking'),
          status: isStreamingThis && !msg.content ? 'in_progress' : 'completed',
          explanation: msg.reasoning,
          sourceMessageId: msg.id,
          groupIndex,
        })
      }

      // ② toolCalls → 每个工具调用一个步骤(带 error 标记)
      if (msg.toolCalls?.length) {
        for (const tc of msg.toolCalls) {
          const isError = tc.status === 'error'
          msgSteps.push({
            id: tc.id,
            step: tc.toolName,
            status: tc.status === 'running' ? 'in_progress' : 'completed',
            durationMs: tc.duration,
            error: isError,
            explanation: tc.error || (tc.repeated ? t('toolCallSkipped') : undefined),
            sourceMessageId: msg.id,
            groupIndex,
          })
        }
      }

      // ③ content → "回答" 步骤(只有当有 content 时才显示)
      if (msg.content && msg.content.trim().length > 0) {
        msgSteps.push({
          id: `${msg.id}-answer`,
          step: t('stepAnswer'),
          status: isStreamingThis ? 'in_progress' : 'completed',
          sourceMessageId: msg.id,
          groupIndex,
        })
      }

      // 缓存已完成消息的 planSteps(下次 token 到达时直接命中,跳过重算)
      if (isCompleted) {
        completedPlanStepsRef.current.set(msg.id, msgSteps)
      }

      steps.push(...msgSteps)
    })
    return steps
  }, [messages, lastAssistantMessageId, isStreaming, t])

  // Phase 19 集成(2026-07-31 立):把 planStep → message 映射写入 ProgressJumpStore
  // 供 PlanStepsCard 点击步骤跳转 + hover 联动 + message-list 反向高亮
  const linkPlanStepToMessage = useProgressJumpStore((s) => s.linkPlanStepToMessage)
  React.useEffect(() => {
    for (const step of planSteps) {
      if (step.sourceMessageId) {
        linkPlanStepToMessage(step.id, step.sourceMessageId)
      }
    }
  }, [planSteps, linkPlanStepToMessage])

  // 从 messages + subAgentActivities 派生 TimelineEvent 列表
  // 上游没传 events 时,本地基于 messages 派生供右侧时间线 tab 渲染
  // P0 流式性能优化(2026-08-02):useDeferredValue 延迟 derivedEvents 的可见更新,
  // 流式 token 到达时(useMemo 仍重算,但 deferred 返回旧值)避免 effect 频繁写 store
  // → store 订阅组件(plan-steps-card / timeline-tab)不会每个 token 都 re-render
  const derivedEventsValue = React.useMemo<TimelineEvent[]>(() => {
    const events: TimelineEvent[] = []
    for (const m of messages) {
      events.push({
        id: `msg-${m.id}`,
        type: m.role === 'user' ? 'reference' : 'thinking',
        timestamp: new Date(m.createdAt).toISOString(),
        title: m.role === 'user' ? t('timelineUserMessage') : t('timelineAiReply'),
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
  }, [messages, subAgentActivities, t])
  // deferred 值:urgent render 返回旧值,空闲时再更新 → 减少 effect 写 store 频率
  const derivedEvents = React.useDeferredValue(derivedEventsValue)

  // 上游无 events 时,同步派生 events 到 store(供外部组件共享)
  React.useEffect(() => {
    if (timelineEvents.length === 0 && derivedEvents.length > 0) {
      setTimelineEvents(derivedEvents)
    }
  }, [derivedEvents, timelineEvents.length, setTimelineEvents])

  // 2026-08-02 隐藏:linkedSubagents 派生已移除(不再 inline SubAgentTaskTree 到对话流)
  // 日后恢复时重新派生:SubAgentActivity → SubAgent 映射(idle/pending→spawned 等)

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
          label: t('contextMenu.copyText'),
          action: 'copy',
        },
        {
          id: 'copyMarkdown',
          label: t('contextMenu.copyMarkdown'),
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
          label: t('contextMenu.regenerate'),
          action: 'regenerate',
          disabled: !isAssistant,
        },
        {
          id: 'feedback',
          label: t('contextMenu.feedback'),
          action: 'feedback',
          disabled: !isAssistant,
        },
        { id: 'sep-2', label: '', separator: true },
        {
          id: 'delete',
          label: t('contextMenu.deleteMessage'),
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
            toast.success(t('toast.copiedText'))
          }
        } else if (action === 'copyMarkdown') {
          const md = normalizeMarkdown(msg.content)
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(md)
            toast.success(t('toast.copiedMarkdown'))
          }
        } else if (action === 'regenerate') {
          // 重新生成:转发到全局事件,由 message-input 监听后触发 sendAnswer
          window.dispatchEvent(
            new CustomEvent('ihui:regenerate-message', { detail: { messageId: msg.id } }),
          )
          toast.info(t('toast.regenerating'))
        } else if (action === 'feedback') {
          // 反馈:简单 toast 兜底(深度反馈系统不在本任务范围)
          toast.success(t('toast.feedbackRecorded'))
        } else if (action === 'search') {
          // Phase 23:打开搜索栏(等同于 Ctrl+F)
          setSearchBarVisible(true)
        } else if (action === 'delete') {
          // 删除:本地过滤 store(单端,服务端持久化由 message-input 流式回收)
          const store = useChatStore.getState()
          const next = store.messages.filter((m) => m.id !== msg.id)
          if (next.length !== store.messages.length) {
            useChatStore.setState({ messages: next })
            toast.success(t('toast.messageDeleted'))
          }
        }
      } catch (err) {
        toast.error(t('toast.operationFailed'), {
          description: err instanceof Error ? err.message : String(err),
        })
      }
    },
    [contextMenu, t],
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
                {/* Phase 19: 最后一个 assistant 消息下挂载 PlanStepsCard + SubAgentTaskTree
                  2026-08-01 Phase 4d:消息级 inline 后,仅当消息级数据为空时显示全局块(降级兼容旧后端)
                  2026-08-02 隐藏:对话流底部不再渲染 PlanStepsCard/SubAgentTaskTree(冗余可视化,与 Trae Codex 简洁风格不一致)
                  功能保留在右侧 AI 面板(PlanStepsCard + TimelineTab 独立入口) */}
              </div>
            </React.Fragment>
          )
        })}
        {/* #7 虚拟滚动底部占位 */}
        {paddingBottom > 0 && <div style={{ height: paddingBottom, flexShrink: 0 }} />}
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
      {inlinePanelNode}
      {/* 2026-07-28 立(深度对标 Trae Work):Scroll-to-bottom 浮动按钮
        - 当 userScrolledUp 为 true(用户已向上滚动超过 120px)时显示
        - 点击 → scrollIntoView 到 bottomRef + 重置 userScrolledUp
        - 浮在 message list 容器右下角,固定定位(不随消息滚动)
        - 与 streaming 联动:有未读新消息时显示红点徽章 */}
      {userScrolledUp && (
        <Tooltip
          content={t('jumpToLatest') === 'jumpToLatest' ? 'Jump to latest' : t('jumpToLatest')}
        >
          <button
            type="button"
            onClick={handleJumpToLatest}
            data-testid="message-list-jump-latest"
            aria-label={t('jumpToLatest') === 'jumpToLatest' ? 'Jump to latest' : t('jumpToLatest')}
            className={cn(
              'absolute bottom-4 right-4 z-20 inline-flex h-9 items-center gap-1 rounded-md',
              'border border-border/60 bg-background/95 px-3 text-xs font-medium text-foreground/90 shadow-md backdrop-blur',
              'transition-all duration-150 hover:bg-accent hover:shadow-lg',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
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
        </Tooltip>
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
