'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Star, Folder, FileText, Trash2, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button } from '@ihui/ui-react'
import { Tooltip } from '@/components/feedback'
import { cn } from '@/lib/utils'

type ResourceType = 'project' | 'file' | 'doc' | 'post' | 'comment'

interface Favorite {
  id: string
  resourceType: ResourceType
  resourceId: string
  createdAt: string
}

const TYPE_ICON: Record<ResourceType, React.ComponentType<{ className?: string }>> = {
  project: Folder,
  file: FileText,
  doc: FileText,
  post: FileText,
  comment: FileText,
}

const TABS: { value: 'all' | ResourceType; labelKey: 'all' | 'project' | 'file' }[] = [
  { value: 'all', labelKey: 'all' },
  { value: 'project', labelKey: 'project' },
  { value: 'file', labelKey: 'file' },
]

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function FavoritesPage() {
  const t = useTranslations('favorites')
  const locale = useLocale()
  const qc = useQueryClient()
  const [tab, setTab] = React.useState<'all' | ResourceType>('all')

  const { data, isLoading, error } = useQuery({
    queryKey: ['favorites', tab],
    queryFn: () =>
      api<{ list: Favorite[] }>(
        `/api/favorites?pageSize=100${tab !== 'all' ? `&resourceType=${tab}` : ''}`,
      ).then((d) => d.list ?? []),
  })

  const removeMut = useMutation({
    mutationFn: (f: Favorite) =>
      api(`/api/favorites/${f.resourceType}/${f.resourceId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const items = data ?? []

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Star className="h-6 w-6 text-primary" />
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
            {t(`tabs.${tabItem.labelKey}`)}
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
          <Star className="h-8 w-8 opacity-40" />
          <p className="text-sm">{t('empty')}</p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {items.map((item) => {
            const Icon = TYPE_ICON[item.resourceType] ?? FileText
            return (
              <li
                key={item.id}
                className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/30"
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {item.resourceType}
                </span>
                <span className="min-w-0 flex-1 break-words font-mono text-sm font-medium">
                  {item.resourceId}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {dateFmt.format(new Date(item.createdAt))}
                </span>
                <Tooltip content={t('remove')}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => removeMut.mutate(item)}
                    disabled={removeMut.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
