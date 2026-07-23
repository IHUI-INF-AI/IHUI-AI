'use client'

import * as React from 'react'
import Image from 'next/image'
import { Sparkles, AlertCircle, Loader2, ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { ChatMessage } from '@/stores/chat'
import type { InlineDiffInfo } from '@/components/ai/types'
import { MarkdownStream } from '@/components/ai/markdown-stream'
import { ToolCallCard, deriveDiffInfo } from '@/components/ai/tool-call-card'
import { PromptTemplates } from '@/components/ai/prompt-templates'
import { cn } from '@/lib/utils'

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
      <div
        className={cn(
          'flex max-w-[85%] flex-col gap-1',
          isUser ? 'items-end' : 'items-start',
        )}
      >
        {!isUser && (
          <span className="px-1 text-xs text-muted-foreground">{assistantLabel}</span>
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
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {m.content}
            </p>
          ) : (
            <div className="space-y-2">
              {m.reasoning && <ReasoningBlock reasoning={m.reasoning} />}
              {m.toolCalls?.map((tc) => {
                // edit_file/write_file:为 Accept/Reject 回调构造 diffInfo
                // 优先用 store 中的 tc.diffInfo,否则从 args 推导(与 ToolCallCard 内部逻辑一致)
                const effectiveDiffInfo =
                  tc.diffInfo ?? deriveDiffInfo(tc.toolName, tc.args) ?? undefined
                const hasDiff = !!effectiveDiffInfo
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
                    onApply={
                      hasDiff && onApplyDiff
                        ? () => onApplyDiff(m.id, tc.id, effectiveDiffInfo!)
                        : undefined
                    }
                    onReject={
                      hasDiff && onRejectDiff
                        ? () => onRejectDiff(m.id, tc.id)
                        : undefined
                    }
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
}: MessageListProps) {
  const t = useTranslations('chat')
  const bottomRef = React.useRef<HTMLDivElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const lastContent = messages[messages.length - 1]?.content

  // 自动滚动到底部
  React.useEffect(() => {
    const el = bottomRef.current
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, lastContent, isStreaming])

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

  return (
    // 2026-07-21 AI 面板滚动条:加 hover-scroll 完全隐藏滚动条(不占布局空间),
    // 解决 bg-shell-panel 暗色背景下默认滚动条轨道透出深色的问题
    <div ref={containerRef} className="hover-scroll h-full overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        {messages.map((m, idx) => (
          // P0 流式性能优化(2026-07-23):React.memo 避免非目标消息重渲染
          <MessageItem
            key={m.id}
            message={m}
            isLast={idx === messages.length - 1}
            isStreaming={isStreaming}
            assistantLabel={assistantLabel}
            onApplyDiff={onApplyDiff}
            onRejectDiff={onRejectDiff}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

export default MessageList
