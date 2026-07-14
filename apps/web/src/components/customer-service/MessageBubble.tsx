'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export type MessageType = 'text' | 'image' | 'system'

export interface CsMessage {
  id: string
  content: string
  type: MessageType
  sender: 'user' | 'agent'
  createdAt: string
}

interface Props {
  message: CsMessage
  isSelf: boolean
}

function initials(name: string): string {
  return name?.trim()?.slice(0, 1)?.toUpperCase() || '?'
}

export function MessageBubble({ message, isSelf }: Props) {
  const [zoomed, setZoomed] = React.useState(false)

  if (message.type === 'system') {
    return <div className="my-1 text-center text-xs text-muted-foreground">{message.content}</div>
  }

  return (
    <div className={cn('group flex items-start gap-2', isSelf ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium',
          isSelf ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
        )}
      >
        {isSelf ? '客' : initials(message.sender)}
      </div>
      <div className={cn('flex max-w-[75%] flex-col', isSelf ? 'items-end' : 'items-start')}>
        {message.type === 'image' ? (
          <button
            type="button"
            onClick={() => setZoomed(true)}
            className="block max-h-48 overflow-hidden rounded-lg border"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={message.content}
              alt={message.content.split('/').pop() || '图片'}
              className="max-h-48 object-cover"
            />
          </button>
        ) : (
          <div
            className={cn(
              'rounded-2xl px-3 py-2 text-sm',
              isSelf
                ? 'rounded-br-sm bg-primary text-primary-foreground'
                : 'rounded-bl-sm bg-muted text-muted-foreground',
            )}
          >
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          </div>
        )}
        <span className="mt-0.5 px-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
      {zoomed && message.type === 'image' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setZoomed(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setZoomed(false)
          }}
          role="button"
          tabIndex={0}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={message.content} alt="zoomed" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  )
}

export default MessageBubble
