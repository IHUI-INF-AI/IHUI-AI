// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Bell, X, CheckCheck, ListTodo, Info, CheckCircle2, AlertTriangle, XCircle, ArrowUpRight, type LucideIcon } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { formatDate } from '@/lib/date-utils'

export interface NoticeItem {
  id: string
  title: string
  description?: string
  type: 'info' | 'success' | 'warning' | 'error'
  read: boolean
  createdAt: string
  /** 原始通知类型(未归一化;G2 自动化结果为 'automation',用于渲染深链) */
  rawType?: string
  /** G2 自动化通知的可深链会话 id(conversationId ?? auto_<automationId>) */
  sessionId?: string | null
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
  /** G2:「查看会话」深链点击(自动化终态通知带 sessionId 时出现) */
  onSessionLinkClick?: (sessionId: string) => void
}

/** 消息类型视觉档:飞书式列表行左侧的圆形类型图标(底色 + 图标色)。 */
const TYPE_META: Record<NoticeItem['type'], { icon: LucideIcon; tone: string }> = {
  info: { icon: Info, tone: 'bg-primary/10 text-primary' },
  success: { icon: CheckCircle2, tone: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  warning: { icon: AlertTriangle, tone: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' },
  error: { icon: XCircle, tone: 'bg-red-500/10 text-red-600 dark:text-red-400' },
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
  onSessionLinkClick,
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
      {/* 头部右侧留出 pr-12:宿主的 Modal 会在右上角绝对定位统一的关闭按钮,
          不留位时「全部已读」会与关闭按钮重叠(2026-11-11 用户反馈)。 */}
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 pr-12">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <span className="text-body font-semibold">通知中心</span>
          {unreadCount > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-medium leading-none tabular-nums text-muted-foreground">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onMarkAllRead && unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-label" onClick={onMarkAllRead}>
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
        <div
          className="border-b border-border/60 px-2 pb-2 pt-1"
          data-testid="decision-inbox-section"
        >
          <div className="flex items-center gap-2 px-2 py-1.5">
            <ListTodo className="h-4 w-4 text-primary" />
            <span className="text-label font-medium text-muted-foreground">
              {t('myPendingDecisions')}
            </span>
            {pendingDecisions.length > 0 && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold leading-none tabular-nums text-primary">
                {pendingDecisions.length}
              </span>
            )}
          </div>
          {pendingDecisions.length === 0 ? (
            <p
              className="px-2 py-1.5 text-label text-muted-foreground"
              data-testid="decision-inbox-empty"
            >
              {t('pendingDecisionsEmpty')}
            </p>
          ) : (
            <div className="space-y-0.5">
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
                  className="flex cursor-pointer gap-2 rounded-md px-2 py-2 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body font-medium">
                      {item.summary || decisionTypeLabel(item.type)}
                    </p>
                    {item.threadId && (
                      <p className="truncate text-label text-muted-foreground">{item.threadId}</p>
                    )}
                    <p className="mt-0.5 text-label text-muted-foreground">
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
      <div className="max-h-[60vh] flex-1 overflow-auto px-2 pb-2 pt-1">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Bell className="h-5 w-5" />
            </span>
            <p className="text-label">{t('messagesEmpty')}</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {items.map((item) => {
              const Meta = TYPE_META[item.type]
              const Icon = Meta.icon
              return (
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
                    'flex gap-3 rounded-md px-2.5 py-2.5 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring ' +
                    (onItemClick ? 'cursor-pointer' : '')
                  }
                >
                  {/* 飞书式:左侧圆形类型图标,替代原先的小色点 */}
                  <span
                    className={
                      'mt-px flex h-9 w-9 shrink-0 items-center justify-center rounded-full ' +
                      Meta.tone
                    }
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <p
                        className={
                          'min-w-0 flex-1 truncate text-body ' +
                          (item.read ? 'text-foreground/70' : 'font-medium text-foreground')
                        }
                      >
                        {item.title}
                      </p>
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        {formatDate(item.createdAt)}
                      </span>
                    </div>
                    {item.description && (
                      <p className="mt-0.5 line-clamp-2 break-words text-label text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                    {item.rawType === 'automation' && item.sessionId && (
                      <button
                        type="button"
                        data-testid="notice-session-link"
                        data-session-id={item.sessionId}
                        onClick={(e) => {
                          // 深链优先:点「查看会话」不再顺带触发整条通知的 onItemClick
                          e.stopPropagation()
                          onSessionLinkClick?.(item.sessionId!)
                        }}
                        className="mt-1 inline-flex items-center gap-0.5 rounded-sm text-label font-medium text-primary hover:underline"
                      >
                        {t('viewConversation')}
                        <ArrowUpRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  {!item.read && (
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
