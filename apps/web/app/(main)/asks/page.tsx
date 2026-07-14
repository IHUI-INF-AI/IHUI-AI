'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { HelpCircle, Plus } from 'lucide-react'
import { Button } from '@ihui/ui'

import { AsksFilter } from './AsksFilter'
import { AsksList } from './AsksList'
import { AsksDialog } from './AsksDialog'
import { PAGE_SIZE, api } from './helpers'
import type { AskItem, AsksData, Filter } from './types'

export default function AsksPage() {
  const t = useTranslations('asks')
  const qc = useQueryClient()

  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [filter, setFilter] = React.useState<Filter>('all')
  const [open, setOpen] = React.useState(false)
  const [title, setTitle] = React.useState('')
  const [content, setContent] = React.useState('')
  const [formError, setFormError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['asks', debounced],
    queryFn: () =>
      api<AsksData>(
        `/api/asks?page=1&pageSize=${PAGE_SIZE}&search=${encodeURIComponent(debounced)}`,
      ),
  })

  const createMut = useMutation({
    mutationFn: (payload: { title: string; content: string }) =>
      api<{ ask: AskItem }>(`/api/asks`, { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asks'] })
      setOpen(false)
      setTitle('')
      setContent('')
      setFormError(null)
    },
    onError: (e: Error) => setFormError(e.message),
  })

  const list = (data?.list ?? []).filter((a) =>
    filter === 'all' ? true : filter === 'resolved' ? a.isResolved : !a.isResolved,
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!title.trim() || !content.trim()) {
      setFormError(t('required'))
      return
    }
    createMut.mutate({ title: title.trim(), content: content.trim() })
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <HelpCircle className="h-7 w-7 text-primary" />
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/asks/edit">
            <Button variant="outline">
              <Plus className="h-4 w-4" />
              发布需求
            </Button>
          </Link>
          <AsksDialog
            open={open}
            setOpen={(o) => {
              if (!o && createMut.isPending) return
              setOpen(o)
              if (!o) setFormError(null)
            }}
            title={title}
            setTitle={setTitle}
            content={content}
            setContent={setContent}
            formError={formError}
            pending={createMut.isPending}
            onSubmit={handleSubmit}
          />
        </div>
      </div>

      <AsksFilter search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} />

      <AsksList list={list} isLoading={isLoading} error={error} />
    </div>
  )
}
