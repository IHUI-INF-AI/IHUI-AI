'use client'

import * as React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import SyntaxHighlighter from '@/components/media/SyntaxHighlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Sparkles, AlertCircle, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { ChatMessage } from '@/stores/chat'
import { cn } from '@/lib/utils'

function CodeBlock({ language, value }: { language?: string; value: string }) {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <pre className="my-2 overflow-x-auto rounded-lg bg-zinc-900 p-3 text-sm text-zinc-100">
        <code>{value}</code>
      </pre>
    )
  }

  return (
    <SyntaxHighlighter
      language={language || 'text'}
      style={oneDark}
      PreTag="div"
      customStyle={{ margin: '0.5rem 0', borderRadius: '0.5rem', fontSize: '0.875rem' }}
    >
      {value}
    </SyntaxHighlighter>
  )
}

function AssistantContent({ content }: { content: string }) {
  return (
    <div className="chat-markdown text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            const value = String(children).replace(/\n$/, '')
            if (match) {
              return <CodeBlock language={match[1]} value={value} />
            }
            return (
              <code className="rounded bg-muted px-1.5 py-0.5 text-[0.85em] font-mono" {...props}>
                {children}
              </code>
            )
          },
          a({ children, ...props }) {
            return (
              <a
                className="text-primary underline underline-offset-2"
                target="_blank"
                rel="noreferrer"
                {...props}
              >
                {children}
              </a>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
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

interface MessageListProps {
  messages: ChatMessage[]
  isStreaming: boolean
  isLoading?: boolean
  emptyTitle: string
  emptyHint: string
  assistantLabel: string
  loadingLabel?: string
}

export function MessageList({
  messages,
  isStreaming,
  isLoading,
  emptyTitle,
  emptyHint,
  assistantLabel,
  loadingLabel,
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
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          {isLoading ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : (
            <Sparkles className="h-7 w-7" />
          )}
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{loadingLabel}</p>
        ) : (
          <div className="space-y-1">
            <p className="text-base font-medium">{emptyTitle}</p>
            <p className="max-w-xs text-sm text-muted-foreground">{emptyHint}</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        {messages.map((m) => {
          const isUser = m.role === 'user'
          const showTyping = !isUser && m.content === '' && isStreaming
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
                    <AssistantContent content={m.content} />
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
