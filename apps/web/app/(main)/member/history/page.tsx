'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { History, Loader2, Trash2, FileText, Folder } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button } from '@ihui/ui'
import { Alert } from '@/components/feedback'

type ResourceType = 'project' | 'file' | 'doc' | 'post'

interface HistoryItem {
  id: string
  resourceType: ResourceType
  resourceId: string
  title?: string | null
  visitedAt: string
}

const TYPE_ICON: Record<ResourceType, React.ComponentType<{ className?: string }>> = {
  project: Folder,
  file: FileText,
  doc: FileText,
  post: FileText,
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function MemberHistoryPage() {
  const locale = useLocale()
  const qc = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['member', 'history'],
    queryFn: () =>
      api<{ list: HistoryItem[] }>('/api/history')
        .then((d) => d.list ?? [])
        .catch(() => [] as HistoryItem[]),
  })

  const clearMut = useMutation({
    mutationFn: () => api('/api/history', { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member', 'history'] }),
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <History className="h-5 w-5 text-primary" />
            浏览历史
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">最近浏览过的内容</p>
        </div>
        {items.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => clearMut.mutate()}
            disabled={clearMut.isPending}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {clearMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            清空
          </Button>
        )}
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <History className="h-8 w-8 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">暂无浏览记录</p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {items.map((item) => {
            const Icon = TYPE_ICON[item.resourceType] ?? FileText
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/30"
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {item.resourceType}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {item.title ?? item.resourceId}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {dateFmt.format(new Date(item.visitedAt))}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
