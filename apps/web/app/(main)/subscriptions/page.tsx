'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Bell, BellOff, User, Folder, Tag, FolderTree, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button } from '@ihui/ui'
import { Tooltip } from '@/components/feedback'
import { cn } from '@/lib/utils'

type TargetType = 'user' | 'project' | 'tag' | 'category'

interface Subscription {
  id: string
  targetType: TargetType
  targetId: string
  createdAt: string
}

const TYPE_ICON: Record<TargetType, React.ComponentType<{ className?: string }>> = {
  user: User,
  project: Folder,
  tag: Tag,
  category: FolderTree,
}

const TABS: { value: 'all' | TargetType }[] = [
  { value: 'all' },
  { value: 'user' },
  { value: 'project' },
  { value: 'tag' },
]

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function SubscriptionsPage() {
  const t = useTranslations('subscriptions')
  const locale = useLocale()
  const qc = useQueryClient()
  const [tab, setTab] = React.useState<'all' | TargetType>('all')

  const { data, isLoading, error } = useQuery({
    queryKey: ['subscriptions', tab],
    queryFn: () =>
      api<{ list: Subscription[] }>(
        `/api/subscriptions?pageSize=100${tab !== 'all' ? `&targetType=${tab}` : ''}`,
      ).then((d) => d.list ?? []),
  })

  const cancelMut = useMutation({
    mutationFn: (s: { targetType: TargetType; targetId: string }) =>
      api(`/api/subscriptions/${s.targetType}/${s.targetId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscriptions'] }),
  })

  const dateFmt = new Intl.DateTimeFormat(locale, { month: '2-digit', day: '2-digit' })
  const items = data ?? []

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Bell className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1">
        {TABS.map((tabItem) => (
          <button
            key={tabItem.value}
            onClick={() => setTab(tabItem.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === tabItem.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`tabs.${tabItem.value}`)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="py-10 text-center text-destructive">{(error as Error).message}</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
          <BellOff className="h-8 w-8 opacity-40" />
          <p className="text-sm">{t('empty')}</p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {items.map((s) => {
            const Icon = TYPE_ICON[s.targetType]
            return (
              <li
                key={s.id}
                className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/30"
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium">{t(`types.${s.targetType}`)}</p>
                  <p className="break-words font-mono text-xs text-muted-foreground">
                    {s.targetId}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {dateFmt.format(new Date(s.createdAt))}
                </span>
                <Tooltip content={t('cancel')}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() =>
                      cancelMut.mutate({ targetType: s.targetType, targetId: s.targetId })
                    }
                    disabled={cancelMut.isPending}
                  >
                    <BellOff className="h-3.5 w-3.5" />
                  </Button>
                </Tooltip>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
