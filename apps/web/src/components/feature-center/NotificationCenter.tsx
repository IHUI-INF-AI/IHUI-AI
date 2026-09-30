// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Bell, X, CheckCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'

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

/** D193 决策收件箱条目视图(2026-09-30 立):listPendingDecisions 数据的渲染面元素。
 *  createdAt 为 null 表示服务端未落时间;threadId 为 null 表示无法跳会话(仍可开面板)。 */
export interface PendingDecisionView {
  id: string
  threadId: string | null
  type: string
  summary: string
  createdAt: string | null
}

export interface NotificationCenterProps {
  items: NoticeItem[]
  onMarkAllRead?: () => void
  onClose?: () => void
  onItemClick?: (item: NoticeItem) => void
  /** D193:待我决策条目;**不传**(未取数/游客)整区隐藏,传空数组渲染空态 */
  pendingDecisions?: PendingDecisionView[]
  /** D193:点击待决策条目(装车链据此切会话 + 开面板) */
  onDecisionItemClick?: (item: PendingDecisionView) => void
}

const TYPE_COLORS: Record<NoticeItem['type'], string> = {
  info: 'bg-primary',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
}

/** 类型 → 词表键后缀(elicitation → decisionTypeElicitation;未知类型原样兜底) */
function decisionTypeKey(type: string): string {
  const suffix = type
    .split('_')
    .filter(Boolean)
    .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1))
    .join('')
  return suffix ? `decisionType${suffix}` : type
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
  const t = useTranslations('featureCenter')
  const unreadCount = items.filter((n) => !n.read).length

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
      <div className="max-h-[60vh] flex-1 overflow-auto">
        {/* D193 决策收件箱区:prop 缺席即整区隐藏(未取数/游客不打扰) */}
        {pendingDecisions && (
          <div
            data-testid="decision-inbox-section"
            className="border-b border-border/60 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold">{t('myPendingDecisions')}</span>
              <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] tabular-nums text-amber-600 dark:text-amber-400">
                {pendingDecisions.length}
              </span>
            </div>
            {pendingDecisions.length === 0 ? (
              <p data-testid="decision-inbox-empty" className="py-3 text-xs text-muted-foreground">
                {t('pendingDecisionsEmpty')}
              </p>
            ) : (
              <div className="mt-1.5 space-y-1">
                {pendingDecisions.map((item) => (
                  <div
                    key={item.id}
                    data-testid="decision-inbox-item"
                    data-thread-id={item.threadId ?? undefined}
                    role="button"
                    tabIndex={0}
                    onClick={() => onDecisionItemClick?.(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onDecisionItemClick?.(item)
                      }
                    }}
                    className="cursor-pointer rounded-md p-1.5 transition-colors hover:bg-muted/50"
                  >
                    <p className="break-words text-xs font-medium">
                      {item.summary || t(decisionTypeKey(item.type))}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {item.threadId ? `#${item.threadId}` : t(decisionTypeKey(item.type))}
                      {item.createdAt ? ` · ${formatDate(item.createdAt)}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
