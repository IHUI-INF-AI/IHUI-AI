// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Bell, X, CheckCheck, ListTodo } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { formatDate } from '@/lib/date-utils'

export interface NoticeItem {
  id: string
  title: string
  description?: string
  type: 'info' | 'success' | 'warning' | 'error'
  read: boolean
  createdAt: string
}

/** D193:待决策条目(与 api-client 的 PendingDecisionItem 同形,本组件保持展示层零耦合) */
export interface PendingDecisionView {
  id: string
  threadId: string | null
  type: 'tool_approval' | 'permissions' | 'elicitation' | string
  summary: string
  createdAt: string | null
}

export interface NotificationCenterProps {
  items: NoticeItem[]
  onMarkAllRead?: () => void
  onClose?: () => void
  onItemClick?: (item: NoticeItem) => void
  /** D193:「我的待决策」聚合(传 undefined = 整区隐藏;传数组 = 展示,含空态) */
  pendingDecisions?: PendingDecisionView[]
  onDecisionItemClick?: (item: PendingDecisionView) => void
}

const TYPE_COLORS: Record<NoticeItem['type'], string> = {
  info: 'bg-primary',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
}

/** 通知中心组件,展示通知列表并提供全部已读与关闭操作。
 *  设计为"裸内容"组件:不带外层 border/bg-card/shadow,由外层容器(Popover/Dialog)提供卡片外观。 */
export function NotificationCenter({
  items,
  onMarkAllRead,
  onClose,
  onItemClick,
  pendingDecisions,
  onDecisionItemClick,
}: NotificationCenterProps) {
  const t = useTranslations('nav')
  const unreadCount = items.filter((n) => !n.read).length

  const decisionTypeLabel = (type: string) => {
    if (type === 'permissions') return t('decisionTypePermissions')
    if (type === 'elicitation') return t('decisionTypeElicitation')
    return t('decisionTypeToolApproval')
  }

  return (
    <div className="flex w-full flex-col">
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <span className="font-semibold">通知中心</span>
          {unreadCount > 0 && (
            <span className="rounded-md bg-cta px-2 py-0.5 text-xs text-cta-foreground">
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
      {pendingDecisions && (
        <div className="px-3 pb-2" data-testid="decision-inbox-section">
          <div className="flex items-center gap-2 py-1">
            <ListTodo className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">
              {t('myPendingDecisions')}
            </span>
            {pendingDecisions.length > 0 && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-md bg-cta px-1 text-[10px] font-semibold leading-none tabular-nums text-cta-foreground">
                {pendingDecisions.length}
              </span>
            )}
          </div>
          {pendingDecisions.length === 0 ? (
            <p className="py-1.5 text-xs text-muted-foreground" data-testid="decision-inbox-empty">
              {t('pendingDecisionsEmpty')}
            </p>
          ) : (
            <div className="space-y-1">
              {pendingDecisions.map((item) => (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  data-testid="decision-inbox-item"
                  data-thread-id={item.threadId ?? ''}
                  onClick={() => onDecisionItemClick?.(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onDecisionItemClick?.(item)
                    }
                  }}
                  className="flex cursor-pointer gap-2 rounded-sm p-2 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {item.summary || decisionTypeLabel(item.type)}
                    </p>
                    {item.threadId && (
                      <p className="truncate text-xs text-muted-foreground">{item.threadId}</p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {decisionTypeLabel(item.type)}
                      {item.createdAt ? ` · ${formatDate(item.createdAt)}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="max-h-[60vh] flex-1 overflow-auto">
        {items.length === 0 ? (
          <div className="flex h-full items-center justify-center py-12 text-sm text-muted-foreground">
            暂无通知
          </div>
        ) : (
          <div className="space-y-1">
            {items.map((item) => (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => onItemClick?.(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onItemClick?.(item)
                  }
                }}
                className={
                  'flex gap-3 p-2 transition-colors hover:bg-muted/50 ' +
                  (onItemClick ? 'cursor-pointer' : '') +
                  (item.read ? ' opacity-60' : '')
                }
              >
                <span
                  className={'mt-0.5 h-2 w-2 shrink-0 rounded-full ' + TYPE_COLORS[item.type]}
                />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium">{item.title}</p>
                  {item.description && (
                    <p className="break-words text-xs text-muted-foreground">{item.description}</p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(item.createdAt)}
                  </p>
                </div>
                {!item.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cta" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
