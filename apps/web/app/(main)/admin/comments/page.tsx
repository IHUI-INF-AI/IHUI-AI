'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, MessageSquare, Search } from 'lucide-react'
import { Button, Input, Label } from '@ihui/ui-react'

import { CommentsTable, CommentDrawer } from './CommentsTable'
import {
  PAGE_SIZE,
  STATUS_OPTIONS,
  TOPIC_TYPES,
  deleteComment,
  fetchComments,
  selectClass,
} from './helpers'
import type { CommentItem, StatusFilter, TopicType } from './types'

export default function AdminCommentsPage() {
  const t = useTranslations('admin.comments')
  const qc = useQueryClient()

  const [keyword, setKeyword] = React.useState('')
  const [debouncedKw, setDebouncedKw] = React.useState('')
  const [topicType, setTopicType] = React.useState<TopicType | ''>('')
  const [status, setStatus] = React.useState<StatusFilter>('normal')
  const [page, setPage] = React.useState(1)
  const [drawerId, setDrawerId] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebouncedKw(keyword)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [keyword])

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'comments', debouncedKw, topicType, status, page],
    queryFn: () =>
      fetchComments({
        page,
        keyword: debouncedKw || undefined,
        topicType: topicType || undefined,
        status,
      }),
    retry: false,
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteComment(id),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'comments'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function handleDelete(item: CommentItem) {
    if (window.confirm(t('deleteConfirm'))) deleteMut.mutate(item.id)
  }

  function resetFilters() {
    setKeyword('')
    setTopicType('')
    setStatus('normal')
    setPage(1)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const list = data?.list ?? []
  const mockMode = !!error && list.length === 0

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <MessageSquare className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t('keywordLabel')}</Label>
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t('keywordPlaceholder')}
            className="h-9 w-56"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t('topicTypeLabel')}</Label>
          <select
            value={topicType}
            onChange={(e) => {
              setTopicType(e.target.value as TopicType | '')
              setPage(1)
            }}
            className={selectClass}
            style={{ width: '160px' }}
          >
            <option value="">{t('topicAll')}</option>
            {TOPIC_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey as never)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t('statusLabel')}</Label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as StatusFilter)
              setPage(1)
            }}
            className={selectClass}
            style={{ width: '120px' }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey as never)}
              </option>
            ))}
          </select>
        </div>
        <Button variant="outline" size="sm" onClick={resetFilters} className="h-9">
          <Search className="h-4 w-4" />
          {t('reset')}
        </Button>
      </div>

      {mockMode && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          [!] {t('mockMode')}
        </div>
      )}

      <CommentsTable
        list={list}
        isLoading={isLoading}
        onOpenDetail={setDrawerId}
        onDelete={handleDelete}
        deletePending={deleteMut.isPending}
      />

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            {t('prev')}
          </Button>
          <span className="text-sm text-muted-foreground">{t('pageOf', { page, totalPages })}</span>
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
      </div>

      <CommentDrawer
        open={drawerId !== null}
        commentId={drawerId}
        onClose={() => setDrawerId(null)}
      />
    </div>
  )
}
