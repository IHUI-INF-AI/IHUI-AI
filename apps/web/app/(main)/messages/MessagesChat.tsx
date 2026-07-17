'use client'

import * as React from 'react'
import Image from 'next/image'
import { Loader2, Send, ChevronUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Input } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { relativeTime } from './helpers'
import type { Conversation, ChatMessage } from './types'

interface Props {
  selected: Conversation | null
  draft: string
  setDraft: (v: string) => void
  onSend: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  sendPending: boolean
  scrollRef: React.RefObject<HTMLDivElement | null>
  onLoadMore?: (
    conversationId: string,
    cursor: string,
  ) => Promise<{
    list: ChatMessage[]
    hasMore: boolean
    nextCursor: string | null
  }>
}

export function MessagesChat({
  selected,
  draft,
  setDraft,
  onSend,
  onKeyDown,
  sendPending,
  scrollRef,
  onLoadMore,
}: Props) {
  const t = useTranslations('privateMessages')
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [hasMore, setHasMore] = React.useState(false)
  const [cursor, setCursor] = React.useState<string | null>(null)
  const prevHeightRef = React.useRef(0)

  React.useEffect(() => {
    if (!selected) return
    const firstMsg = selected.messages[0]
    setCursor(firstMsg?.createdAt ?? null)
    setHasMore(selected.messages.length >= 20)
  }, [selected?.id, selected])

  const handleLoadMore = async () => {
    if (!selected || !cursor || !onLoadMore) return
    setLoadingMore(true)
    const el = scrollRef.current
    if (el) prevHeightRef.current = el.scrollHeight
    try {
      const res = await onLoadMore(selected.id, cursor)
      setHasMore(res.hasMore)
      setCursor(res.nextCursor)
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeightRef.current
      })
    } catch {
      setHasMore(false)
    } finally {
      setLoadingMore(false)
    }
  }

  if (!selected) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        {t('selectHint')}
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
          {selected.peerAvatar ? (
            <Image
              src={selected.peerAvatar}
              alt={selected.peerName}
              fill
              className="object-cover"
            />
          ) : (
            <span className="text-xs font-medium text-muted-foreground">
              {selected.peerName?.slice(0, 1) ?? '?'}
            </span>
          )}
        </div>
        <p className="break-words text-sm font-medium">{selected.peerName}</p>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {hasMore && cursor && onLoadMore && (
          <div className="flex justify-center pb-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="text-xs text-muted-foreground"
            >
              {loadingMore ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <ChevronUp className="mr-1 h-3 w-3" />
              )}
              {t('loadMore', { default: '加载更多' })}
            </Button>
          </div>
        )}
        {(selected.messages ?? []).length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {t('noMessagesHint')}
          </div>
        ) : (
          selected.messages.map((msg) => (
            <div key={msg.id} className={cn('flex', msg.isMine ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[70%] rounded-2xl px-3 py-2 text-sm',
                  msg.isMine ? 'bg-primary text-primary-foreground' : 'bg-muted',
                )}
              >
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                <p
                  className={cn(
                    'mt-1 text-right text-xs',
                    msg.isMine ? 'text-primary-foreground/70' : 'text-muted-foreground',
                  )}
                >
                  {msg.createdAt ? relativeTime(msg.createdAt, t) : ''}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-2 border-t p-3">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('input.placeholder')}
          disabled={sendPending}
          maxLength={1000}
        />
        <Button type="button" size="icon" onClick={onSend} disabled={sendPending || !draft.trim()}>
          {sendPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}
