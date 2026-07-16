'use client'

import * as React from 'react'
import Image from 'next/image'
import { Sparkles, AlertCircle, Loader2, ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { ChatMessage } from '@/stores/chat'
import { MarkdownStream } from '@/components/ai/markdown-stream'
import { ToolCallCard } from '@/components/ai/tool-call-card'
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
        <div className="border-t border-muted px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap break-words">
          {reasoning}
        </div>
      )}
    </div>
  )
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
    const templates = onTemplateSelect
      ? [
          {
            id: 'summary',
            name: t('tplSummary'),
            content: t('tplSummaryContent'),
            category: t('promptTemplates'),
          },
          {
            id: 'translate',
            name: t('tplTranslate'),
            content: t('tplTranslateContent'),
            category: t('promptTemplates'),
          },
          {
            id: 'explain',
            name: t('tplExplain'),
            content: t('tplExplainContent'),
            category: t('promptTemplates'),
          },
          {
            id: 'code',
            name: t('tplCode'),
            content: t('tplCodeContent'),
            category: t('promptTemplates'),
          },
          {
            id: 'polish',
            name: t('tplPolish'),
            content: t('tplPolishContent'),
            category: t('promptTemplates'),
          },
        ]
      : []
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <Image
          src="/images/common/ai_default.svg"
          alt=""
          aria-hidden
          width={56}
          height={56}
          className="h-14 w-14 opacity-90 dark:invert"
          unoptimized
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
          <div className="w-full max-w-2xl">
            <PromptTemplates templates={templates} onSelect={onTemplateSelect!} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        {messages.map((m, idx) => {
          const isUser = m.role === 'user'
          const isLast = idx === messages.length - 1
          const showTyping = !isUser && m.content === '' && isStreaming
          const streamingThis = !isUser && isStreaming && isLast
          return (
            <div
              key={m.id}
              className={cn('flex w-full gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}
            >
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium',
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
                      {m.toolCalls?.map((tc) => (
                        <ToolCallCard
                          key={tc.id}
                          toolName={tc.toolName}
                          args={tc.args}
                          result={tc.result}
                          status={tc.status}
                          duration={tc.duration}
                          error={tc.error}
                        />
                      ))}
                      <MarkdownStream content={m.content} isStreaming={streamingThis} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

export default MessageList
