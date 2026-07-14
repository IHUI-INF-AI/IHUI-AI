'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { Heart, Loader2, Trash2, Folder, FileText } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button } from '@ihui/ui'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

type ResourceType = 'project' | 'file' | 'doc' | 'post' | 'comment'

interface Favorite {
  id: string
  resourceType: ResourceType
  resourceId: string
  title?: string | null
  createdAt: string
}

const TYPE_ICON: Record<ResourceType, React.ComponentType<{ className?: string }>> = {
  project: Folder,
  file: FileText,
  doc: FileText,
  post: FileText,
  comment: FileText,
}

const TABS: { value: 'all' | ResourceType; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'project', label: '项目' },
  { value: 'file', label: '文件' },
  { value: 'doc', label: '文档' },
]

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function MemberFavoritesPage() {
  const locale = useLocale()
  const qc = useQueryClient()
  const [tab, setTab] = React.useState<'all' | ResourceType>('all')

  const { data, isLoading, error } = useQuery({
    queryKey: ['member', 'favorites', tab],
    queryFn: () =>
      api<{ list: Favorite[] }>(
        `/api/favorites?pageSize=100${tab !== 'all' ? `&resourceType=${tab}` : ''}`,
      )
        .then((d) => d.list ?? [])
        .catch(() => [] as Favorite[]),
  })

  const removeMut = useMutation({
    mutationFn: (f: Favorite) =>
      api(`/api/favorites/${f.resourceType}/${f.resourceId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member', 'favorites'] }),
  })

  const items = data ?? []
  const dateFmt = new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Heart className="h-5 w-5 text-primary" />
          收藏夹
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">管理你收藏的项目、文件和文档</p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === t.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <Heart className="h-8 w-8 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">还没有收藏任何内容</p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {items.map((item) => {
            const Icon = TYPE_ICON[item.resourceType] ?? FileText
            return (
              <li
                key={item.id}
                className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/30"
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {item.resourceType}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {item.title ?? item.resourceId}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {dateFmt.format(new Date(item.createdAt))}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-destructive opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  onClick={() => removeMut.mutate(item)}
                  disabled={removeMut.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
