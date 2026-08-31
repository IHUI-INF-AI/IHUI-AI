// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import * as React from 'react'
import {
  Copy,
  Check,
  RefreshCw,
  Share2,
  Pencil,
  Trash2,
  MessageCircle,
  Eye,
  EyeOff,
  Download,
  Code,
  Megaphone,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ChatMessage } from '@/stores/chat'
import type { InlineDiffInfo } from '@/components/ai/types'
import { CommunityPublishDialog } from '@/components/chat/community-publish-dialog'
import { MarkdownStream } from '@/components/ai/markdown-stream'
import { ToolCallCard, deriveDiffInfo } from '@/components/ai/tool-call-card'
import { ThinkingSection } from '@/components/ai/progress-sections/thinking-section'
import { ToolCallSummaryCard } from '@/components/ai/progress-sections/tool-call-summary-card'
import { SubAgentActivityFeed } from '@/components/ai/sub-agent-activity-feed'
import { TerminalSection } from '@/components/ai/progress-sections/terminal-section'
import { PlanStepsCard } from '@/components/ai/progress-sections/plan-steps-card'
import { plainTextForClipboard } from '@/components/ai/progress-sections/message-context-menu'
import { useChatStore } from '@/stores/chat'
import { fetchApi } from '@/lib/api'
import { toast } from '@/components/common'
import { Tooltip } from '@/components/feedback'
import { cn } from '@/lib/utils'
import {
  TypingIndicator,
  formatMessageTimestamp,
  UsageBreakdown,
  ACTION_BTN_CLASS,
} from './message-item-parts'

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
  /** 代码块默认折叠行数,<=0 表示不折叠 */
  codeCollapseLines?: number
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
  codeCollapseLines,
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
  // 2026-08-29 修复:思考过程自动展开/收起生命周期
  // - 思考中(reasoning 流式)自动展开;思考结束(正文开始输出或流结束)自动收起
  // - autoExpandedRef 标记"本次展开是自动的":用户手动 toggle 过则不再自动收起
  // - userTouchedRef 标记"用户手动操作过":手动收起后流式期间不再被自动展开打扰
  const autoExpandedRef = React.useRef(false)
  const userTouchedRef = React.useRef(false)
  // 统一手动 toggle 入口:清除自动标记,后续思考结束不再自动收起
  const toggleReasoning = React.useCallback(() => {
    userTouchedRef.current = true
    autoExpandedRef.current = false
    setReasoningExpanded((prev) => !prev)
  }, [])
  // 监听全局 'ihui:toggle-reasoning' 事件:键盘 Enter 聚焦消息触发,只响应本条消息
  React.useEffect(() => {
    // 2026-08-02 修复: Bug 6 — 把 if (!m.reasoning) return 移到 listener 内部,
    // 否则 m.reasoning 后到达时才注册 listener,之前 toggle 事件已丢失。
    const onToggle = (e: Event) => {
      if (!m.reasoning) return
      const detail = (e as CustomEvent<{ messageId: string }>).detail
      if (detail?.messageId !== m.id) return
      toggleReasoning()
    }
    window.addEventListener('ihui:toggle-reasoning', onToggle as EventListener)
    return () => window.removeEventListener('ihui:toggle-reasoning', onToggle as EventListener)
  }, [m.id, m.reasoning, toggleReasoning])

  // 自动展开仅用于"正文输出中新思考交错到达"场景(思考区已挂载,用户可感知新思考);
  // "先想后答"模型的思考在 TypingIndicator 阶段(content 为空)已完成,
  // 思考区挂载时思考已结束,直接折叠 — 不做"先展开再收起",避免闪烁(用户手动操作过则不干预)
  // 判据:正文开始时刻的 reasoning 长度基线,基线之后新增的思考才视为"新思考"
  const reasoningBaselineRef = React.useRef<number | null>(null)

  // 维护基线:正文开始时快照当前 reasoning 长度;content 清空(regenerate)时重置
  React.useEffect(() => {
    if (m.content.length === 0) {
      reasoningBaselineRef.current = null
    } else if (reasoningBaselineRef.current === null) {
      reasoningBaselineRef.current = m.reasoning?.length ?? 0
    }
  }, [m.content, m.reasoning])

  // 流式正文中检测到基线之外新增的 reasoning → 自动展开
  React.useEffect(() => {
    if (
      streamingThis &&
      m.reasoning &&
      m.content.length > 0 &&
      reasoningBaselineRef.current !== null &&
      m.reasoning.length > reasoningBaselineRef.current &&
      !reasoningExpanded &&
      !userTouchedRef.current
    ) {
      autoExpandedRef.current = true
      setReasoningExpanded(true)
    }
  }, [streamingThis, m.reasoning, reasoningExpanded, m.content])

  // 2026-08-29:流结束后 — 自动展开的思考区收起(让位正文);
  // 同时重置手动标记,使 regenerate 能恢复完整自动生命周期
  React.useEffect(() => {
    if (streamingThis) return
    if (autoExpandedRef.current) {
      autoExpandedRef.current = false
      setReasoningExpanded(false)
    }
    userTouchedRef.current = false
  }, [streamingThis])

  // 2026-08-29 立:交错思考增长指示 — 正文流式输出期间 reasoning 超出基线继续增长,
  // 传给 ThinkingSection 显示脉冲光标/"思考中"loader;流结束(streamingThis=false)自动消失。
  // 渲染期读 ref 安全:m.reasoning 变化本身就会触发本组件重渲染(memo 比较失败)。
  const reasoningGrowing =
    streamingThis &&
    m.content.length > 0 &&
    !!m.reasoning &&
    reasoningBaselineRef.current !== null &&
    m.reasoning.length > reasoningBaselineRef.current

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

  // 分享 — 获取分享链接并复制到剪贴板
  const handleShare = React.useCallback(
    async (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation()
      e.preventDefault()
      const convId = useChatStore.getState().conversationId
      if (!convId) return

      let shareToken: string | null = null
      try {
        const r = await fetchApi<{ token: string }>(`/api/chat/conversations/${convId}/share`, {
          method: 'POST',
        })
        if (!r.success || !r.data?.token) throw new Error(r.error || '获取分享链接失败')
        shareToken = r.data.token
      } catch (err: unknown) {
        // API 错误：直接显示后端返回的具体信息
        if (err instanceof Error) toast.error(err.message)
        else toast.error(t('copyFailed'))
        return
      }

      try {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
        const shareUrl = `${baseUrl}/chat/share/${shareToken}`
        const bodyLines = [plainTextForClipboard(m.content).trimEnd(), '', shareUrl]
        const finalText = bodyLines.join('\n')

        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(finalText)
        } else {
          const ta = document.createElement('textarea')
          ta.value = finalText
          ta.setAttribute('readonly', '')
          ta.style.position = 'absolute'
          ta.style.left = '-9999px'
          document.body.appendChild(ta)
          ta.select()
          document.execCommand('copy')
          document.body.removeChild(ta)
        }
        toast.success(t('message.shareLinkCopied'))
      } catch {
        toast.error(t('copyFailed'))
      }
    },
    [m.content, t],
  )

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
  const hasMetadata =
    Boolean(m.meta) && typeof m.meta === 'object' && 'usage' in (m.meta as Record<string, unknown>)

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

  // 时间戳移到按钮区内部，这里不再常驻计算

  // Copy 按钮 a11y label(优先用 i18n,缺失回退英文)
  const copyLabel = t('copy') === 'copy' ? '复制' : t('copy')
  if (copyLabel === 'copy') {
    console.warn('[i18n] Missing translation for key: chat.message.copy')
  }

  return (
    <div
      className={cn(
        'group/msg relative flex w-full flex-col gap-1 px-1',
        isUser ? 'items-end' : 'items-start',
        isHighlighted && 'ring-1 ring-ring/30 animate-message-highlight-pulse',
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
          <div className="animate-in fade-in-0 duration-150 fill-mode-both">
            <TypingIndicator reasoning={m.reasoning} toolCalls={m.toolCalls} />
          </div>
        ) : isUser ? (
          // 2026-08-02:用户消息字号同步调整 14px → 15px(text-[15px]),与 AI 消息对齐
          <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{m.content}</p>
        ) : (
          <div
            className={cn(
              'space-y-0 animate-in fade-in-0 duration-150 fill-mode-both',
              // 2026-08-02:内容可见性切换(Eye/EyeOff)— 折叠时限高,仅显示前几行
              !contentVisible && 'max-h-20 overflow-hidden',
            )}
          >
            {m.reasoning && (
              <ThinkingSection
                content={m.reasoning}
                currentNode={null}
                // 2026-08-29:isStreaming 收紧为"思考进行中" — 正文开始输出后思考区
                // 立即进入已完成态(停掉"思考中..."loader / 闪烁光标 / 耗时 tick)
                isStreaming={streamingThis && !m.content}
                // 2026-08-29:正文流式期间 reasoning 交错到达 → 增长指示(脉冲光标)
                isGrowing={reasoningGrowing}
                expanded={reasoningExpanded}
                onToggle={toggleReasoning}
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
            <MarkdownStream
              content={m.content}
              isStreaming={streamingThis}
              collapseLines={codeCollapseLines}
            />
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
          - AI 消息(9按钮): Eye/EyeOff / Like / Copy / Download(条件) / Share / Code(条件) / Regenerate / Megaphone / Reply
          - 用户消息(4按钮): Copy / Edit / Reply / Delete */}
      {!streamingThis && m.content.length > 0 && (
        <div className="msg-hover-reveal flex items-center gap-1">
          {/* 时间戳 — 随按钮一起 hover 显示,所有消息都展示 */}
          {(() => {
            const label = formatMessageTimestamp(m.createdAt) || '--'
            return (
              <span
                className="text-xs text-muted-foreground shrink-0 mr-auto"
                data-testid={`message-timestamp-${m.id}`}
              >
                {label}
              </span>
            )
          })()}
          <div className="flex items-center gap-1" data-testid={`message-actions-${m.id}`}>
            {/* AI 消息:Eye/EyeOff(内容可见性切换)— 原项目 toggleAssistantContentVisibility */}
            {!isUser && (
              <Tooltip
                content={contentVisible ? t('message.hideContent') : t('message.showContent')}
              >
                <button
                  type="button"
                  onClick={handleToggleVisibility}
                  data-testid={`message-visibility-${m.id}`}
                  aria-label={contentVisible ? t('message.hideContent') : t('message.showContent')}
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
              <Tooltip content={t('message.downloadImages')} side="top">
                <button
                  type="button"
                  onClick={handleDownloadImages}
                  data-testid={`message-download-${m.id}`}
                  aria-label={t('message.downloadImages')}
                  className={ACTION_BTN_CLASS}
                >
                  <Download className="h-4 w-4" aria-hidden />
                </button>
              </Tooltip>
            )}
            {/* AI 消息:Share(分享)— 原项目 shareAssistantMessage */}
            {!isUser && (
              <Tooltip content={t('message.share')} side="top">
                <button
                  type="button"
                  onClick={handleShare}
                  data-testid={`message-share-${m.id}`}
                  aria-label={t('message.share')}
                  className={ACTION_BTN_CLASS}
                >
                  <Share2 className="h-4 w-4" aria-hidden />
                </button>
              </Tooltip>
            )}
            {/* AI 消息:Code(元数据 toggle)— 原项目 toggleMetadata,有 metadata 时显示 */}
            {!isUser && hasMetadata && (
              <Tooltip content={t('message.toggleMetadata')} side="top">
                <button
                  type="button"
                  onClick={handleToggleMetadata}
                  data-testid={`message-metadata-${m.id}`}
                  aria-label={t('message.toggleMetadata')}
                  className={cn(ACTION_BTN_CLASS, metadataExpanded && 'text-primary bg-muted/60')}
                >
                  <Code className="h-4 w-4" aria-hidden />
                </button>
              </Tooltip>
            )}
            {/* AI 消息:Regenerate(重新生成)— 原项目 regenerateMessage,streaming 时禁用 */}
            {!isUser && (
              <Tooltip content={t('message.regenerate')} side="top">
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={streamingThis}
                  data-testid={`message-regenerate-${m.id}`}
                  aria-label={t('message.regenerate')}
                  className={cn(
                    ACTION_BTN_CLASS,
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                  )}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden />
                </button>
              </Tooltip>
            )}
            {/* AI 消息:Megaphone(发布到社区)— 原项目 publishToCommunity,Promotion 图标不在 lucide-react 用 Megaphone 替代 */}
            {!isUser && (
              <Tooltip content={t('message.publishToCommunity')} side="top">
                <button
                  type="button"
                  onClick={() => setPublishDialogOpen(true)}
                  data-testid={`message-publish-${m.id}`}
                  aria-label={t('message.publishToCommunity')}
                  className={ACTION_BTN_CLASS}
                >
                  <Megaphone className="h-4 w-4" aria-hidden />
                </button>
              </Tooltip>
            )}
            {/* 用户消息:Edit(编辑)— 原项目 editMessage */}
            {isUser && (
              <Tooltip content={t('message.edit')} side="top">
                <button
                  type="button"
                  onClick={handleEdit}
                  data-testid={`message-edit-${m.id}`}
                  aria-label={t('message.edit')}
                  className={ACTION_BTN_CLASS}
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                </button>
              </Tooltip>
            )}
            {/* Reply(回复)— AI + 用户,原项目 replyToMessage */}
            <Tooltip content={t('message.reply')} side="top">
              <button
                type="button"
                onClick={handleReply}
                data-testid={`message-reply-${m.id}`}
                aria-label={t('message.reply')}
                className={ACTION_BTN_CLASS}
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
              </button>
            </Tooltip>
            {/* 用户消息:Delete(删除)— 原项目 deleteMessage,hover 红色 */}
            {isUser && (
              <Tooltip content={t('message.delete')} side="top">
                <button
                  type="button"
                  onClick={handleDelete}
                  data-testid={`message-delete-${m.id}`}
                  aria-label={t('message.delete')}
                  className={cn(ACTION_BTN_CLASS, 'hover:text-destructive hover:bg-destructive/10')}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </Tooltip>
            )}
          </div>
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

      {/* 错误重试按钮(2026-07-28 立,深度对标 Trae Work):m.error 时在气泡下方显示,
            用户可一键重新生成该消息,不必手动从历史拷贝内容重新粘贴。 */}
      {m.error && (
        <button
          type="button"
          onClick={handleRetry}
          data-testid={`message-retry-${m.id}`}
          className={cn(
            'mt-0 inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5',
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

export { MessageItem }
export type { MessageItemProps }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
