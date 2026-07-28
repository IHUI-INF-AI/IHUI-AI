'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Plus, Search, ChevronLeft, ChevronRight, FolderTree, Users } from 'lucide-react'
import {
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui-react'
import {
  type Channel,
  type Category,
  type Lecturer,
  fetchChannels,
  api,
  selectClass,
  PAGE_SIZE,
} from './types'
import { LiveStats } from './LiveStats'
import { ChannelsTable } from './ChannelsTable'
import { ChannelFormDialog } from './ChannelFormDialog'

export default function AdminLivePage() {
  const t = useTranslations('admin.live')

  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [categoryId, setCategoryId] = React.useState('all')
  const [lecturerId, setLecturerId] = React.useState('all')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Channel | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  React.useEffect(() => {
    setPage(1)
  }, [categoryId, lecturerId])

  const { data: categoriesData } = useQuery({
    queryKey: ['admin', 'live', 'categories', 'all'],
    queryFn: () =>
      api<{ list: Category[] }>(`/api/admin/live/categories`).then((d) => d.list ?? []),
  })
  const categories = categoriesData ?? []

  const { data: lecturersData } = useQuery({
    queryKey: ['admin', 'live', 'lecturers', 'all'],
    queryFn: () =>
      api<{ list: Lecturer[] }>(`/api/admin/live/lecturers?page=1&pageSize=100`).then(
        (d) => d.list ?? [],
      ),
  })
  const lecturers = lecturersData ?? []

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'live', 'channels', debounced, categoryId, lecturerId, page],
    queryFn: () => fetchChannels({ page, search: debounced, categoryId, lecturerId }),
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const channels = data?.list ?? []

  function openCreate() {
    setEditing(null)
    setOpen(true)
  }
  function openEdit(ch: Channel) {
    setEditing(ch)
    setOpen(true)
  }
  function closeDialog() {
    setOpen(false)
    setEditing(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/live/categories">
              <FolderTree className="h-4 w-4" />
              {t('categories')}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/live/lecturers">
              <Users className="h-4 w-4" />
              {t('lecturers')}
            </Link>
          </Button>
        </div>
      </div>

      <LiveStats t={t} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="h-9 pl-8"
            aria-label={t('search')}
          />
        </div>
        <div className="w-full max-w-[180px]">
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className={selectClass} aria-label={t('allCategories')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allCategories')}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full max-w-[180px]">
          <Select value={lecturerId} onValueChange={setLecturerId}>
            <SelectTrigger className={selectClass} aria-label={t('allLecturers')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allLecturers')}</SelectItem>
              {lecturers.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openCreate} size="sm" className="ml-auto">
          <Plus className="h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      <ChannelsTable channels={channels} isLoading={isLoading} error={error} onEdit={openEdit} />

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
      </div>

      <ChannelFormDialog
        open={open}
        editing={editing}
        categories={categories}
        lecturers={lecturers}
        onClose={closeDialog}
        t={t}
      />
    </div>
  )
}
