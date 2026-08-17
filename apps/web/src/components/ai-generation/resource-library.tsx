'use client'

import * as React from 'react'
import Image from 'next/image'
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
} from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { formatDate } from '@/lib/date-utils'

interface AigcRecord {
  taskId: string
  type: string
  status: string
  /** output 字段解析后的 JSON(可为 { url } / 纯字符串 / null) */
  result: unknown
  /** input 字段解析后的 JSON({ prompt, model, params }) */
  input: unknown
  createdAt: string
}

type ResourceType = 'image' | 'video' | 'audio' | '3d'

const TYPE_OPTIONS: ResourceType[] = ['image', 'video', 'audio', '3d']
const PAGE_SIZE = 12

/** 从后端 result 字段提取可展示/播放的 URL */
function extractResultUrl(result: unknown): string | undefined {
  if (!result) return undefined
  if (typeof result === 'string') return result
  if (typeof result === 'object') {
    const url = (result as Record<string, unknown>).url
    if (typeof url === 'string') return url
  }
  return undefined
}

/** 从后端 input 字段提取 prompt / model */
function extractInputInfo(input: unknown): { prompt?: string; model?: string } {
  if (typeof input !== 'object' || input === null) return {}
  const raw = input as Record<string, unknown>
  return {
    prompt: typeof raw.prompt === 'string' ? raw.prompt : undefined,
    model: typeof raw.model === 'string' ? raw.model : undefined,
  }
}

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
    // 后端 GET /ai/aigc/records 不分 type(仅按用户分页),统一 key 复用同一份数据,前端过滤
    queryKey: ['aigc-records'],
    queryFn: async () => {
      // 后端返回分页对象 { list, total, page, pageSize }(aigc-routes.ts)。
      // 注意:必须取 data.list,不能把整个 data 当数组,否则已登录成功响应会触发
      // "filter is not a function" 渲染崩溃(2026-08-17 修复)。
      const res = await fetchApi<{
        list: AigcRecord[]
        total: number
        page: number
        pageSize: number
      }>('/api/ai/aigc/records?pageSize=100')
      if (!res.success) throw new Error(res.error)
      return res.data.list
    },
  })

  const filtered = React.useMemo(() => {
    const list = (records ?? []).filter(
      (r) => activeType === 'all' || r.type === activeType,
    )
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter((r) => (extractInputInfo(r.input).prompt ?? '').toLowerCase().includes(q))
  }, [records, activeType, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const renderPreview = (record: AigcRecord): React.ReactNode => {
    const url = extractResultUrl(record.result)
    const { prompt } = extractInputInfo(record.input)
    if (!url) return <p className="text-sm text-muted-foreground">{t('noResult')}</p>
    switch (record.type) {
      case 'image':
        return (
          <Image
            src={url}
            alt={prompt ?? record.type}
            width={800}
            height={600}
            unoptimized
            className="h-auto max-h-[70vh] w-full rounded-md border"
          />
        )
      case 'video':
        return (
          <video src={url} controls className="w-full rounded-md border">
            <track kind="captions" />
          </video>
        )
      case 'audio':
        return (
          <audio src={url} controls className="w-full">
            <track kind="captions" />
          </audio>
        )
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
            <Select
              value={activeType}
              onValueChange={(v) => {
                setActiveType(v)
                setPage(1)
              }}
            >
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
          <div className="flex-1 min-w-0 space-y-2">
            <Label>{t('search')}</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
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
            <div className="grid grid-cols-2 gap-3 min-[640px]:grid-cols-2 min-[768px]:grid-cols-2 tablet-min-[1024px]:grid-cols-4">
              {pageItems.map((record) => {
                const url = extractResultUrl(record.result)
                const { prompt, model } = extractInputInfo(record.input)
                return (
                  <button
                    key={record.taskId}
                    type="button"
                    onClick={() => setPreview(record)}
                    className="space-y-1 rounded-md border p-2 text-left transition-colors hover:bg-accent"
                  >
                    <div className="relative flex h-24 items-center justify-center overflow-hidden rounded bg-muted">
                      {record.type === 'image' && url ? (
                        <Image
                          src={url}
                          alt={prompt ?? record.type}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      ) : (
                        <span className="text-xs uppercase text-muted-foreground">
                          {record.type}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-foreground">{prompt || t('noResult')}</p>
                    <p className="text-xs text-muted-foreground">
                      {model || record.type} · {formatDate(record.createdAt)}
                    </p>
                  </button>
                )
              })}
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

        <Dialog
          open={!!preview}
          onOpenChange={(open) => {
            if (!open) setPreview(null)
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('preview')}</DialogTitle>
            </DialogHeader>
            {preview ? (
              <div className="space-y-3">
                {renderPreview(preview)}
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>
                    {t('type')}: {preview.type}
                  </p>
                  <p>
                    {t('vendor')}: {extractInputInfo(preview.input).model || '-'}
                  </p>
                  <p>
                    {t('prompt')}: {extractInputInfo(preview.input).prompt || t('noResult')}
                  </p>
                  <p>
                    {t('createdAt')}: {formatDate(preview.createdAt)}
                  </p>
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
