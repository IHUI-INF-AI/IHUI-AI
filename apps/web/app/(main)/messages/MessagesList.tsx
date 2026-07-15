'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { relativeTime } from './helpers'
import type { Conversation } from './types'

interface Props {
  conversations: Conversation[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function MessagesList({ conversations, selectedId, onSelect }: Props) {
  const t = useTranslations('privateMessages')
  return (
    <div className="flex w-80 shrink-0 flex-col border-r">
      <div className="border-b px-4 py-3">
        <p className="text-sm font-medium">{t('conversations')}</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.map((conv) => {
          const isActive = conv.id === selectedId
          return (
            <button
              key={conv.id}
              type="button"
              onClick={() => onSelect(conv.id)}
              className={cn(
                'flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors',
                isActive ? 'bg-accent' : 'hover:bg-muted/50',
              )}
            >
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                {conv.peerAvatar ? (
                  <Image
                    fill
                    src={conv.peerAvatar}
                    alt={conv.peerName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-medium text-muted-foreground">
                    {conv.peerName?.slice(0, 1) ?? '?'}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="break-words text-sm font-medium">{conv.peerName}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {conv.lastTime ? relativeTime(conv.lastTime, t) : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="break-words text-xs text-muted-foreground">
                    {conv.lastMessage || t('noMessages')}
                  </p>
                  {conv.unread > 0 && (
                    <span className="shrink-0 rounded-full bg-red-500 px-1.5 text-xs text-white">
                      {conv.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
