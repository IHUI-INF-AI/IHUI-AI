'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { FileText, Loader2, Trash2, ChevronLeft, ChevronRight, Eye, Download } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent } from '@ihui/ui'

interface MyResource {
  id: string
  title: string
  description?: string | null
  fileType?: string | null
  fileSize?: number | null
  viewCount: number
  downloadCount: number
  status: number
  createdAt: string
}

interface ResourcesData {
  list: MyResource[]
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
  3: 'bg-red-500/10 text-red-600 dark:text-red-400',
}

export default function MyResourcesPage() {
  const t = useTranslations('student')
  const tr = useTranslations('myResources')
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)

  const { data, isLoading, error } = useQuery({
    queryKey: ['student', 'my-resources', page],
    queryFn: () => api<ResourcesData>(`/api/resources/mine?page=${page}&pageSize=${PAGE_SIZE}`),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/resources/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['student', 'my-resources'] }),
  })

  function handleDelete(resource: MyResource) {
    if (!window.confirm(tr('deleteConfirm'))) return
    delMut.mutate(resource.id)
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const fmtDate = (v?: string | null) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('zh-CN')
  }

  const fmtSize = (bytes?: number | null) => {
    if (!bytes) return '-'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <FileText className="h-7 w-7 text-primary" />
          {tr('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{tr('subtitle')}</p>
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
          <FileText className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((resource) => {
              const statusKey =
                resource.status === 1
                  ? 'statusPublished'
                  : resource.status === 2
                    ? 'statusOffline'
                    : resource.status === 3
                      ? 'statusRejected'
                      : 'statusPending'
              return (
                <Card
                  key={resource.id}
                  className="overflow-hidden transition-colors hover:bg-accent"
                >
                  <Link href={`/resources/${resource.id}`}>
                    <div className="flex h-28 items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                      <FileText className="h-10 w-10 text-primary/40" />
                    </div>
                  </Link>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/resources/${resource.id}`} className="min-w-0 flex-1">
                        <h3 className="font-medium hover:text-primary">{resource.title}</h3>
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0 text-destructive hover:text-destructive"
                        disabled={delMut.isPending}
                        onClick={() => handleDelete(resource)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {resource.description && (
                      <p className="text-xs text-muted-foreground">{resource.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" />
                        {resource.viewCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Download className="h-3.5 w-3.5" />
                        {resource.downloadCount}
                      </span>
                      {resource.fileType && <span>{resource.fileType}</span>}
                      {resource.fileSize !== null && <span>{fmtSize(resource.fileSize)}</span>}
                      <span>{fmtDate(resource.createdAt)}</span>
                    </div>
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                        STATUS_STYLE[resource.status] ?? STATUS_STYLE[0]
                      }`}
                    >
                      {tr(statusKey)}
                    </span>
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
