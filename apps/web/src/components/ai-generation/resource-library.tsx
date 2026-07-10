'use client'

import * as React from 'react'
import { Loader2, Search } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ihui/ui'
import { fetchApi } from '@/lib/api'

interface AigcRecord {
  recordId: string
  userId: string
  type: string
  vendor: string
  prompt: string
  resultUrl?: string
  createdAt: number
}

type ResourceType = 'image' | 'video' | 'audio' | '3d'

const TYPE_OPTIONS: ResourceType[] = ['image', 'video', 'audio', '3d']
const PAGE_SIZE = 12

export interface ResourceLibraryProps {
  type?: ResourceType
}

export function ResourceLibrary({ type }: ResourceLibraryProps) {
  const t = useTranslations('aiGeneration')
  const [activeType, setActiveType] = React.useState<string>(type ?? 'all')
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [preview, setPreview] = React.useState<AigcRecord | null>(null)

  const { data: records, isLoading } = useQuery({
    queryKey: ['aigc-records', activeType],
    queryFn: async () => {
      const query = activeType !== 'all' ? `?type=${activeType}` : ''
      const res = await fetchApi<AigcRecord[]>(`/api/ai/aigc/records${query}`)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
  })

  const filtered = React.useMemo(() => {
    const list = records ?? []
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter((r) => r.prompt.toLowerCase().includes(q))
  }, [records, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  const formatDate = (ts: number): string => new Date(ts).toLocaleString()

  const renderPreview = (record: AigcRecord): React.ReactNode => {
    const url = record.resultUrl
    if (!url) return <p className="text-sm text-muted-foreground">{t('noResult')}</p>
    switch (record.type) {
      case 'image':
        return <img src={url} alt={record.prompt} className="max-h-[70vh] w-full rounded-md border" />
      case 'video':
        return <video src={url} controls className="w-full rounded-md border" />
      case 'audio':
        return <audio src={url} controls className="w-full" />
      case '3d':
        return (
          <a
            href={url}
            download
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {t('downloadModel')}
          </a>
        )
      default:
        return (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {t('download')}
          </a>
        )
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('resourceLibraryTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('resourceLibrarySubtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label>{t('type')}</Label>
            <Select value={activeType} onValueChange={(v) => { setActiveType(v); setPage(1) }}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allTypes')}</SelectItem>
                {TYPE_OPTIONS.map((tp) => (
                  <SelectItem key={tp} value={tp}>
                    {tp}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-2">
            <Label>{t('search')}</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                placeholder={t('searchPlaceholder')}
                className="pl-8"
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('polling')}
          </div>
        ) : pageItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noData')}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {pageItems.map((record) => (
                <button
                  key={record.recordId}
                  type="button"
                  onClick={() => setPreview(record)}
                  className="space-y-1 rounded-md border p-2 text-left transition-colors hover:bg-accent"
                >
                  <div className="flex h-24 items-center justify-center overflow-hidden rounded bg-muted">
                    {record.type === 'image' && record.resultUrl ? (
                      <img
                        src={record.resultUrl}
                        alt={record.prompt}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs uppercase text-muted-foreground">
                        {record.type}
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-1 text-xs text-foreground">{record.prompt || t('noResult')}</p>
                  <p className="text-xs text-muted-foreground">
                    {record.vendor} · {formatDate(record.createdAt)}
                  </p>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {t('page', { current: currentPage, total: totalPages })}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="rounded-md border px-3 py-1 text-sm transition-colors hover:bg-accent disabled:opacity-50"
                >
                  {t('prev')}
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="rounded-md border px-3 py-1 text-sm transition-colors hover:bg-accent disabled:opacity-50"
                >
                  {t('next')}
                </button>
              </div>
            </div>
          </>
        )}

        <Dialog open={!!preview} onOpenChange={(open) => { if (!open) setPreview(null) }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('preview')}</DialogTitle>
            </DialogHeader>
            {preview ? (
              <div className="space-y-3">
                {renderPreview(preview)}
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>{t('type')}: {preview.type}</p>
                  <p>{t('vendor')}: {preview.vendor}</p>
                  <p>{t('prompt')}: {preview.prompt || t('noResult')}</p>
                  <p>{t('createdAt')}: {formatDate(preview.createdAt)}</p>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

export default ResourceLibrary
