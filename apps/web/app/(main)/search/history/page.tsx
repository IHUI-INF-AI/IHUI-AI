'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { History, Trash2, Clock, Loader2, Search } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button } from '@ihui/ui'

interface HistoryItem {
  id: string
  query: string
  resultsCount: number
  createdAt: string
}

async function fetchHistory(): Promise<HistoryItem[]> {
  const res = await fetchApi<{ list: HistoryItem[] }>('/api/search/history')
  if (!res.success) throw new Error(res.error)
  return res.data.list
}

export default function HistoryPage() {
  const t = useTranslations('searchHistory')
  const locale = useLocale()
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['search', 'history'],
    queryFn: fetchHistory,
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchApi('/api/search/history', { method: 'DELETE' })
      if (!res.success) throw new Error(res.error)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['search', 'history'] }),
  })

  const deleteOneMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchApi(`/api/search/history/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (!res.success) throw new Error(res.error)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['search', 'history'] }),
  })

  const items = data ?? []

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <History className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        {items.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => clearAllMutation.mutate()}
            disabled={clearAllMutation.isPending}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            {t('clearAll')}
          </Button>
        )}
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
          <Search className="h-8 w-8 opacity-40" />
          <p className="text-sm">{t('empty')}</p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {items.map((item) => (
            <li
              key={item.id}
              className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/30"
            >
              <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
              <button
                onClick={() => router.push(`/search?q=${encodeURIComponent(item.query)}`)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="break-words text-sm font-medium">{item.query}</p>
                <p className="text-xs text-muted-foreground">
                  {dateFmt.format(new Date(item.createdAt))} ·{' '}
                  {t('resultCount', { count: item.resultsCount })}
                </p>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => deleteOneMutation.mutate(item.id)}
                disabled={deleteOneMutation.isPending}
                title={t('delete')}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
