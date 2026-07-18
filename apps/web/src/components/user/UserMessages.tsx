'use client'

import * as React from 'react'
import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface UserMessage {
  id: string
  title: string
  content?: string
  createdAt?: string
  read?: boolean
}

export interface UserMessagesProps {
  messages?: UserMessage[]
  onRead?: (id: string) => void
  className?: string
}

export default function UserMessages({
  messages = [],
  onRead,
  className,
}: UserMessagesProps): React.JSX.Element {
  if (messages.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border bg-card p-10 text-center',
          className,
        )}
      >
        <Inbox className="mb-2 h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">暂无消息</p>
      </div>
    )
  }
  return (
    <div className={cn('divide-y rounded-xl border bg-card', className)}>
      {messages.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onRead?.(m.id)}
          className="block w-full px-4 py-3 text-left hover:bg-muted/50"
        >
          <div className="flex items-center justify-between gap-2">
            <span className={cn('truncate text-sm', !m.read && 'font-medium')}>{m.title}</span>
            {m.createdAt && (
              <span className="shrink-0 text-xs text-muted-foreground">{m.createdAt}</span>
            )}
          </div>
          {m.content && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{m.content}</p>
          )}
        </button>
      ))}
    </div>
  )
}
