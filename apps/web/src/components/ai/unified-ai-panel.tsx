'use client'

import * as React from 'react'
import { Send, Square, Sparkles } from 'lucide-react'
import { Button } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { useTextareaAutoHeight } from '@/hooks/use-textarea-auto-height'
import { MarkdownStream } from './markdown-stream'

const MAX_HEIGHT_PX = 120 // 最大 6 行,超出后滚动(与 hook 默认值一致,用于 textarea style.maxHeight)

interface UnifiedMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  toolCalls?: unknown[]
}

interface UnifiedAiPanelProps {
  messages: UnifiedMessage[]
  onSend: (text: string) => void
  isStreaming?: boolean
  streamingContent?: string
  placeholder?: string
}

export function UnifiedAIPanel({
  messages,
  onSend,
  isStreaming,
  streamingContent,
  placeholder = '输入消息...',
}: UnifiedAiPanelProps) {
  const [value, setValue] = React.useState('')
  const bottomRef = React.useRef<HTMLDivElement>(null)
  const { ref: textareaRef, resize } = useTextareaAutoHeight<HTMLTextAreaElement>(value)

  const lastContent = messages[messages.length - 1]?.content
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, lastContent, isStreaming, streamingContent])

  const submit = () => {
    const text = value.trim()
    if (!text || isStreaming) return
    onSend(text)
    setValue('')
    requestAnimationFrame(resize)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
              <Sparkles className="h-8 w-8" />
              <p className="text-sm">开始一段新对话</p>
            </div>
          )}
          {messages.map((m) => {
            const isUser = m.role === 'user'
            return (
              <div
                key={m.id}
                className={cn('flex w-full gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}
              >
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-medium',
                    isUser
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {isUser ? '我' : <Sparkles className="h-4 w-4" />}
                </div>
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-2.5',
                    isUser
                      ? 'rounded-br-sm bg-primary text-primary-foreground'
                      : 'rounded-bl-sm bg-muted',
                  )}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {m.content}
                    </p>
                  ) : (
                    <MarkdownStream content={m.content} />
                  )}
                </div>
              </div>
            )
          })}
          {isStreaming && streamingContent !== undefined && (
            <div className="flex w-full gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5">
                {streamingContent ? (
                  <MarkdownStream content={streamingContent} isStreaming />
                ) : (
                  <div className="flex items-center gap-1 py-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" />
                  </div>
                )}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2 rounded-2xl border bg-card p-2 shadow-sm focus-within:ring-1 focus-within:ring-ring">
            {/* textarea 容器:padding 由容器提供,避免 textarea 滚动时 padding-top 被吃掉 */}
            <div className="flex-1 py-1.5 pl-1">
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                rows={3}
                disabled={isStreaming}
                style={{ maxHeight: MAX_HEIGHT_PX }}
                className="thin-scroll block w-full resize-none bg-transparent text-sm leading-snug outline-none placeholder:text-muted-foreground/70 disabled:opacity-60"
              />
            </div>
            {isStreaming ? (
              <Button
                variant="destructive"
                size="icon"
                onClick={() => onSend('')}
                aria-label="停止"
                className="h-9 w-9 shrink-0"
              >
                <Square className="h-4 w-4" fill="currentColor" />
              </Button>
            ) : (
              <Button
                size="icon"
                onClick={submit}
                disabled={!value.trim()}
                aria-label="发送"
                className="h-9 w-9 shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="mt-1.5 px-1 text-xs text-muted-foreground">Enter 发送 / Shift+Enter 换行</p>
        </div>
      </div>
    </div>
  )
}

export default UnifiedAIPanel
