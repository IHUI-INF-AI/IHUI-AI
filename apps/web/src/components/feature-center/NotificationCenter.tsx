'use client'

import * as React from 'react'
import { Bell, X, CheckCheck } from 'lucide-react'

import { Button } from '@ihui/ui'

export interface NoticeItem {
  id: string
  title: string
  description?: string
  type: 'info' | 'success' | 'warning' | 'error'
  read: boolean
  createdAt: string
}

export interface NotificationCenterProps {
  items: NoticeItem[]
  onMarkAllRead?: () => void
  onClose?: () => void
  onItemClick?: (item: NoticeItem) => void
}

const TYPE_COLORS: Record<NoticeItem['type'], string> = {
  info: 'bg-blue-500',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
}

/** 通知中心组件，展示通知列表并提供全部已读与关闭操作 */
export function NotificationCenter({
  items,
  onMarkAllRead,
  onClose,
  onItemClick,
}: NotificationCenterProps) {
  const unreadCount = items.filter((n) => !n.read).length

  return (
    <div className="flex h-full w-full flex-col rounded-lg border bg-card shadow-lg">
      <div className="flex items-center justify-between border-b p-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <span className="font-semibold">通知中心</span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onMarkAllRead && unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={onMarkAllRead}>
              <CheckCheck className="mr-1 h-3.5 w-3.5" />
              全部已读
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {items.length === 0 ? (
          <div className="flex h-full items-center justify-center py-12 text-sm text-muted-foreground">
            暂无通知
          </div>
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <li
                key={item.id}
                onClick={() => onItemClick?.(item)}
                className={
                  'flex gap-3 p-3 transition-colors hover:bg-muted/50 ' +
                  (onItemClick ? 'cursor-pointer' : '') +
                  (item.read ? ' opacity-60' : '')
                }
              >
                <span
                  className={'mt-1.5 h-2 w-2 shrink-0 rounded-full ' + TYPE_COLORS[item.type]}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  {item.description && (
                    <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
                {!item.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
