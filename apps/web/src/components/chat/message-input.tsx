'use client'

import * as React from 'react'
import { Send, Square } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'

const MAX_LENGTH = 2000

interface MessageInputProps {
  onSend: (content: string) => void
  onStop: () => void
  isStreaming: boolean
  placeholder: string
  sendLabel: string
  stopLabel: string
}

export function MessageInput({
  onSend,
  onStop,
  isStreaming,
  placeholder,
  sendLabel,
  stopLabel,
}: MessageInputProps) {
  const t = useTranslations('chat')
  const [value, setValue] = React.useState('')
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  // 自动调整高度
  const resize = React.useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [])

  React.useEffect(() => {
    resize()
  }, [value, resize])

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

  const canSend = value.trim().length > 0 && !isStreaming
  const count = value.length

  return (
    <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-3xl px-4 py-3">
        <div className="flex items-end gap-2 rounded-2xl border bg-card p-2 shadow-sm focus-within:ring-1 focus-within:ring-ring">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value.slice(0, MAX_LENGTH))}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            disabled={isStreaming}
            aria-label={placeholder}
            className={cn(
              'max-h-[200px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none',
              'placeholder:text-muted-foreground/70',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              aria-label={stopLabel}
              title={stopLabel}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive text-destructive-foreground transition-colors hover:bg-destructive/90"
            >
              <Square className="h-4 w-4" fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!canSend}
              aria-label={sendLabel}
              title={sendLabel}
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                canSend
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'cursor-not-allowed bg-muted text-muted-foreground/50',
              )}
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between px-1 text-xs text-muted-foreground">
          <span>{t('enterToSend')}</span>
          <span className={count >= MAX_LENGTH ? 'text-destructive' : ''}>
            {count}/{MAX_LENGTH}
          </span>
        </div>
      </div>
    </div>
  )
}

export default MessageInput
