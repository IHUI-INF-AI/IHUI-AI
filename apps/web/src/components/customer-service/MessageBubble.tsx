'use client'

import * as React from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { getInitials } from '@/components/data/Avatar'

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

export function MessageBubble({ message, isSelf }: Props) {
  const [zoomed, setZoomed] = React.useState(false)

  if (message.type === 'system') {
    return <div className="my-1 text-center text-xs text-muted-foreground">{message.content}</div>
  }

  return (
    <div className={cn('group flex items-start gap-2', isSelf ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-medium',
          isSelf ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
        )}
      >
        {isSelf ? '客' : getInitials(message.sender)}
      </div>
      <div className={cn('flex max-w-[75%] flex-col', isSelf ? 'items-end' : 'items-start')}>
        {message.type === 'image' ? (
          <button
            type="button"
            onClick={() => setZoomed(true)}
            className="block max-h-48 overflow-hidden rounded-lg border"
          >
            <Image
              src={message.content}
              alt={message.content.split('/').pop() || '图片'}
              width={400}
              height={300}
              className="max-h-48 object-cover"
              style={{ width: 'auto', height: 'auto' }}
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
          className="fixed inset-0 z-modal flex items-center justify-center bg-black/70 p-4"
          onClick={() => setZoomed(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setZoomed(false)
          }}
          role="button"
          tabIndex={0}
        >
          <Image
            src={message.content}
            alt="zoomed"
            width={1200}
            height={800}
            className="max-h-full max-w-full rounded-lg"
            style={{ width: 'auto', height: 'auto' }}
          />
        </div>
      )}
    </div>
  )
}

export default MessageBubble
