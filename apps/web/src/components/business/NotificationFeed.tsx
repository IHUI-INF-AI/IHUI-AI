// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:依赖 DOM/next-intl/react-query,仅 web 端使用。

'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  AtSign,
  Bell,
  FolderGit,
  Loader2,
  MessageSquare,
  ShoppingCart,
  User,
} from 'lucide-react'
import {
  archiveNotification,
  getNotifications,
  markNotificationRead,
  restoreNotification,
} from '@ihui/api-client'
import type {
  ApiResult,
  NotificationItem as NotificationRow,
  NotificationPartition,
} from '@ihui/types'
import { apiFailureToError } from '@ihui/shared/utils'
import { Button } from '@ihui/ui-react'
import { Timeline } from '@/components/data/Timeline'
import { formatDateOnly } from '@/lib/date-utils'
import { NotificationItem } from './NotificationItem'

export type NotificationView = 'list' | 'timeline'
export type NotificationTabType = 'system' | 'order' | 'project' | 'comment' | 'mention' | 'follow'

const PAGE_SIZE = 10

const TYPE_ICON: Partial<Record<string, React.ComponentType<{ className?: string }>>> = {
  system: Bell,
  order: ShoppingCart,
  project: FolderGit,
  comment: MessageSquare,
  mention: AtSign,
  follow: User,
}

/** 行级状态:文案 + 语气 + 是否在飞(在飞时按钮禁用,避免同一行叠两次迁移)。 */
interface RowState {
  text: string
  tone: 'muted' | 'destructive'
  pending?: boolean
}

async function unwrap<T>(p: Promise<ApiResult<T>>): Promise<T> {
  const r = await p
  // 失败分支必须走具名出口:手搓 new Error(r.error) 会把 status/errorCode 整份丢掉,
  // 401 因此冒充「提交的信息有误」,把"去登录"引导成"改表单"。
  if (!r.success) throw apiFailureToError(r)
  return r.data
}

function relativeTime(iso: string, t: ReturnType<typeof useTranslations>): string {
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return t('justNow')
  const min = Math.floor(sec / 60)
  if (min < 60) return t('minutesAgo', { min })
  const hr = Math.floor(min / 60)
  if (hr < 24) return t('hoursAgo', { hr })
  const day = Math.floor(hr / 24)
  if (day < 30) return t('daysAgo', { day })
  return formatDateOnly(iso)
}

export interface NotificationFeedProps {
  tab: 'all' | NotificationTabType
  partition: NotificationPartition
  view: NotificationView
}

/**
 * D195 动态流本体:一次查询 + 「隐藏(归档)↔恢复」这条可撤销的状态迁移。
 *
 * 页面只留门面(标题、分区开关、类型 tab、视图开关与全部已读),列表/时间线两种渲染
 * 都要能撤销,所以操作槽同时给到 NotificationItem 与 Timeline —— 时间线里看不见「恢复」
 * 就等于归档不可撤销,那一型是本仓记过的"只有硬删没有可追认形态"。
 */
export function NotificationFeed({ tab, partition, view }: NotificationFeedProps) {
  const t = useTranslations('user.notifications')
  const tn = useTranslations('notifications')
  const qc = useQueryClient()
  const [rowStates, setRowStates] = React.useState<Record<string, RowState>>({})

  // 换分区/换类型后上一次失败的回显不再有意义(行集已换),整表清掉而不是留着串台。
  React.useEffect(() => {
    setRowStates({})
  }, [tab, partition])

  const { data, isLoading, error } = useQuery({
    queryKey: ['notifications', 'list', tab, partition],
    queryFn: () => {
      const query: Record<string, string | number> = { page: 1, pageSize: PAGE_SIZE, partition }
      if (tab !== 'all') query.type = tab
      return unwrap(getNotifications(query))
    },
  })

  const readMut = useMutation({
    mutationFn: (id: string) => unwrap(markNotificationRead(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const statusMut = useMutation({
    mutationFn: ({ id, to }: { id: string; to: NotificationPartition }) =>
      unwrap(to === 'archived' ? archiveNotification(id) : restoreNotification(id)),
    onMutate: ({ id, to }) => {
      setRowStates((s) => ({
        ...s,
        [id]: {
          text: to === 'archived' ? t('hiding') : t('restoring'),
          tone: 'muted',
          pending: true,
        },
      }))
    },
    onSuccess: (_r, { id }) => {
      setRowStates((s) => {
        const { [id]: _drop, ...rest } = s
        return rest
      })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: (_e, { id, to }) => {
      setRowStates((s) => ({
        ...s,
        [id]: {
          text: to === 'archived' ? t('hideFailed') : t('restoreFailed'),
          tone: 'destructive',
        },
      }))
    },
  })

  const rows = (data?.list ?? []) as unknown as NotificationRow[]

  const actionOf = (n: NotificationRow) => {
    const st = rowStates[n.id]
    const isArchivedView = partition === 'archived'
    return (
      <Button
        variant="ghost"
        size="xs"
        disabled={st?.pending === true}
        // 整行 role=button 的 onClick 是"标为已读";行尾操作必须挡住冒泡,否则隐藏一条已读
        // 动态会顺带把已读态再写一次。
        onClick={(e) => {
          e.stopPropagation()
          statusMut.mutate({ id: n.id, to: isArchivedView ? 'active' : 'archived' })
        }}
      >
        {st?.pending ? (
          <Loader2 className="animate-spin" />
        ) : isArchivedView ? (
          <ArchiveRestore />
        ) : (
          <Archive />
        )}
        {isArchivedView ? t('restore') : t('hide')}
      </Button>
    )
  }

  if (isLoading) {
    return (
      <div className="whitespace-nowrap py-10 text-center text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        {t('loading')}
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-1 py-10 text-center">
        <p className="text-sm font-medium text-destructive">{t('unavailable')}</p>
        <p className="text-xs text-muted-foreground">{(error as Error).message}</p>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center justify-center gap-2 py-8 text-center text-muted-foreground">
        <Bell className="h-8 w-8 opacity-40" />
        <p className="text-sm">{t('noData')}</p>
        <p className="text-xs">
          {partition === 'archived' ? t('emptyArchivedDescription') : t('emptyDescription')}
        </p>
      </div>
    )
  }

  if (view === 'timeline') {
    return (
      <div className="rounded-lg border p-3">
        <Timeline
          items={rows.map((n) => ({
            title: n.title,
            description: n.content ?? undefined,
            time: relativeTime(n.createdAt, tn),
            icon: TYPE_ICON[n.type] ?? AlertCircle,
            color: n.isRead ? 'var(--muted-foreground)' : 'var(--primary)',
            action: actionOf(n),
          }))}
        />
      </div>
    )
  }

  const unreadRows = rows.filter((n) => !n.isRead)
  const readRows = rows.filter((n) => n.isRead)
  const renderRow = (n: NotificationRow) => {
    const st = rowStates[n.id]
    return (
      <NotificationItem
        key={n.id}
        icon={TYPE_ICON[n.type] ?? AlertCircle}
        title={n.title}
        content={n.content ?? undefined}
        time={relativeTime(n.createdAt, tn)}
        read={n.isRead}
        onClick={() => !n.isRead && readMut.mutate(n.id)}
        action={actionOf(n)}
        status={st ? { text: st.text, tone: st.tone } : undefined}
        className="rounded-none first:rounded-t-lg last:rounded-b-lg"
      />
    )
  }

  // 已归档分区不按已读/未读分节:这里的组织维度是"何时收走的",未读只是行的一个属性。
  if (partition === 'archived') {
    return <div className="space-y-1 rounded-lg border">{rows.map(renderRow)}</div>
  }

  return (
    <div className="space-y-3">
      {/* active 分区把未读单独收在「需要了解」一节:红点与这条分组同源(都只数未归档未读)。 */}
      {unreadRows.length > 0 && (
        <div className="space-y-1">
          <p className="px-1 text-xs font-semibold text-muted-foreground">{t('important')}</p>
          <div className="space-y-1 rounded-lg border">{unreadRows.map(renderRow)}</div>
        </div>
      )}
      {readRows.length > 0 && (
        <div className="space-y-1 rounded-lg border">{readRows.map(renderRow)}</div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
