// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Archive, Bell, CheckCheck, Loader2 } from 'lucide-react'
import { getUnreadCount, markAllNotificationsRead } from '@ihui/api-client'
import type { NotificationPartition } from '@ihui/types'
import { Button } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { AuthGatePrompt, BackButton } from '@/components/common'
import { useAuthGate } from '@/hooks/use-auth-gate'
import {
  NotificationFeed,
  type NotificationTabType,
  type NotificationView,
} from '@/components/business/NotificationFeed'

const TABS: {
  value: 'all' | NotificationTabType
  labelKey: 'all' | 'system' | 'order' | 'project' | 'comment' | 'follow'
}[] = [
  { value: 'all', labelKey: 'all' },
  { value: 'follow', labelKey: 'follow' },
  { value: 'system', labelKey: 'system' },
  { value: 'order', labelKey: 'order' },
  { value: 'project', labelKey: 'project' },
  { value: 'comment', labelKey: 'comment' },
]

const TAB_KEY: Record<string, string> = {
  all: 'tab.all',
  follow: 'tab.follow',
  system: 'tab.system',
  order: 'tab.order',
  project: 'tab.project',
  comment: 'tab.comment',
}

async function unwrap<T>(p: Promise<{ success: boolean; data?: T; error?: string }>): Promise<T> {
  const r = await p
  if (!r.success) throw new Error(r.error)
  return r.data as T
}

export default function NotificationsPage() {
  const t = useTranslations('user.notifications')
  const qc = useQueryClient()
  const [tab, setTab] = React.useState<'all' | NotificationTabType>('all')
  const [view, setView] = React.useState<NotificationView>('list')
  const [partition, setPartition] = React.useState<NotificationPartition>('active')
  const [readAllFailed, setReadAllFailed] = React.useState(false)

  // 2026-09-30 登录态门:未登录不发注定 401 的请求
  const { allow } = useAuthGate()

  // 红点只数"未归档且未读"(与后端 countUnread 同口径):隐藏一条动态后角标必须随之退掉,
  // 否则"隐藏"只挪走了列表里的一行,该消失的红点还亮着。
  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => unwrap(getUnreadCount()),
    enabled: allow,
  })

  const readAllMut = useMutation({
    mutationFn: () => unwrap(markAllNotificationsRead()),
    onSuccess: () => {
      setReadAllFailed(false)
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: () => setReadAllFailed(true),
  })

  const unread = unreadData?.count ?? 0

  return (
    <div className="px-4 py-4 mx-auto max-w-3xl space-y-4">
      <BackButton />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex min-w-0 items-center gap-2 text-2xl font-bold tracking-tight">
            <Bell className="h-6 w-6 shrink-0 text-primary" />
            <span className="truncate">{t('title')}</span>
          </h1>
          <p className="mt-1 whitespace-nowrap text-sm tabular-nums text-muted-foreground">
            {unread > 0 ? t('unreadCount', { count: unread }) : t('allRead')}
          </p>
          {readAllFailed && (
            <p className="mt-1 text-xs text-destructive">{t('markAllReadFailed')}</p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => readAllMut.mutate()}
          disabled={unread === 0 || readAllMut.isPending}
          className="shrink-0 whitespace-nowrap"
        >
          {readAllMut.isPending ? (
            <Loader2 className="mr-1.5 h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <CheckCheck className="mr-1.5 h-4 w-4 shrink-0" />
          )}
          {t('markAllRead')}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* D195 分区开关:动态流 ↔ 已归档。归档不是删除,撤销入口必须和入口常驻在同一个门面上。 */}
        <div className="flex shrink-0 flex-nowrap gap-1 rounded-lg border bg-muted/30 p-1">
          {(['active', 'archived'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPartition(p)}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-colors',
                partition === p
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {p === 'archived' && <Archive className="mr-1.5 h-4 w-4 shrink-0" />}
              <span>{p === 'archived' ? t('archived') : t('viewActive')}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-1 flex-nowrap gap-1 overflow-x-auto rounded-lg border bg-muted/30 p-1">
          {TABS.map((tabItem) => (
            <button
              key={tabItem.value}
              onClick={() => setTab(tabItem.value)}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-colors',
                tab === tabItem.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t(TAB_KEY[tabItem.labelKey] ?? `tab.${tabItem.labelKey}`)}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 flex-nowrap gap-1 rounded-lg border bg-muted/30 p-1">
          <button
            onClick={() => setView('list')}
            className={cn(
              'rounded-sm px-3 py-1.5 text-sm font-medium transition-colors',
              view === 'list'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t('viewList')}
          </button>
          <button
            onClick={() => setView('timeline')}
            className={cn(
              'rounded-sm px-3 py-1.5 text-sm font-medium transition-colors',
              view === 'timeline'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t('viewTimeline')}
          </button>
        </div>
      </div>

      {!allow ? (
        <AuthGatePrompt message="请先登录后查看消息通知" />
      ) : (
        <NotificationFeed tab={tab} partition={partition} view={view} />
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
