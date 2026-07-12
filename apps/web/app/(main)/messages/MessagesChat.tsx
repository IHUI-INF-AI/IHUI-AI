'use client'

import * as React from 'react'
import { Loader2, Send } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Input } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { relativeTime } from './helpers'
import type { Conversation } from './types'

interface Props {
  selected: Conversation | null
  draft: string
  setDraft: (v: string) => void
  onSend: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  sendPending: boolean
  scrollRef: React.RefObject<HTMLDivElement | null>
}

export function MessagesChat({
  selected,
  draft,
  setDraft,
  onSend,
  onKeyDown,
  sendPending,
  scrollRef,
}: Props) {
  const t = useTranslations('privateMessages')
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
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
          {selected.peerAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selected.peerAvatar}
              alt={selected.peerName}
              className="h-full w-full object-cover"
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
