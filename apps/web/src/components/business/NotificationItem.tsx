'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface NotificationItemProps {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  content?: string
  time: string
  read?: boolean
  onClick?: () => void
  className?: string
}

export function NotificationItem({
  icon: Icon,
  title,
  content,
  time,
  read = false,
  onClick,
  className,
}: NotificationItemProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
      className={cn(
        'flex items-start gap-3 rounded-lg p-3 transition-colors',
        onClick && 'cursor-pointer hover:bg-muted/50',
        !read && 'bg-primary/5',
        className,
      )}
    >
      {Icon && (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-medium', !read && 'text-primary')}>{title}</span>
          {!read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
        </div>
        {content && <p className="mt-0.5 text-sm text-muted-foreground">{content}</p>}
        <span className="mt-0.5 text-xs text-muted-foreground">{time}</span>
      </div>
    </div>
  )
}
