'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  HelpCircle,
  Loader2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Eye,
  MessageSquare,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent } from '@ihui/ui'

interface MyAsk {
  id: string
  title: string
  content?: string | null
  viewCount: number
  answerCount: number
  status: number
  createdAt: string
}

interface AsksData {
  list: MyAsk[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 20

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const STATUS_STYLE: Record<number, string> = {
  0: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  1: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  2: 'bg-muted text-muted-foreground',
}

export default function MyAsksPage() {
  const t = useTranslations('student')
  const ta = useTranslations('myAsks')
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)

  const { data, isLoading, error } = useQuery({
    queryKey: ['student', 'my-asks', page],
    queryFn: () => api<AsksData>(`/api/asks/mine?page=${page}&pageSize=${PAGE_SIZE}`),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/asks/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['student', 'my-asks'] }),
  })

  function handleDelete(ask: MyAsk) {
    if (!window.confirm(ta('deleteConfirm'))) return
    delMut.mutate(ask.id)
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const fmtDate = (v?: string | null) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('zh-CN')
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <HelpCircle className="h-7 w-7 text-primary" />
          {ta('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{ta('subtitle')}</p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
          <HelpCircle className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {list.map((ask) => {
              const statusKey =
                ask.status === 1
                  ? 'statusResolved'
                  : ask.status === 2
                    ? 'statusClosed'
                    : 'statusPending'
              return (
                <Card key={ask.id} className="transition-colors hover:bg-accent">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/asks/${ask.id}`} className="min-w-0 flex-1">
                        <h3 className="font-medium hover:text-primary">{ask.title}</h3>
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0 text-destructive hover:text-destructive"
                        disabled={delMut.isPending}
                        onClick={() => handleDelete(ask)}
                      >
                        <Trash2 className="h-4 w-4" />
                        {ta('delete')}
                      </Button>
                    </div>
                    {ask.content && <p className="text-sm text-muted-foreground">{ask.content}</p>}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3.5 w-3.5" />
                          {ask.viewCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3.5 w-3.5" />
                          {ask.answerCount}
                        </span>
                        <span>{fmtDate(ask.createdAt)}</span>
                      </div>
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                          STATUS_STYLE[ask.status] ?? STATUS_STYLE[0]
                        }`}
                      >
                        {ta(statusKey)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                {t('prev')}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t('page', { page, total: totalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('next')}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
