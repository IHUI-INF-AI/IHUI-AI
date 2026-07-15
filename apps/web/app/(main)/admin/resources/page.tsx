'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderTree,
  Package,
} from 'lucide-react'
import {
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import { type Resource, type Category, fetchResources, api, selectClass, PAGE_SIZE } from './types'
import { StatCard } from './StatCard'
import { ResourcesTable } from './ResourcesTable'
import { ResourceFormDialog } from './ResourceFormDialog'

export default function AdminResourcesPage() {
  const t = useTranslations('admin.resources')

  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [categoryId, setCategoryId] = React.useState('all')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Resource | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  React.useEffect(() => {
    setPage(1)
  }, [categoryId])

  const { data: categoriesData } = useQuery({
    queryKey: ['admin', 'resources', 'categories', 'all'],
    queryFn: () =>
      api<{ list: Category[] }>(`/api/admin/resources/categories`).then((d) => d.list ?? []),
  })
  const categories = categoriesData ?? []

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'resources', debounced, categoryId, page],
    queryFn: () => fetchResources({ page, search: debounced, categoryId }),
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const resources = data?.list ?? []

  function openCreate() {
    setEditing(null)
    setOpen(true)
  }
  function openEdit(res: Resource) {
    setEditing(res)
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
            <Link href="/admin/resources/categories">
              <FolderTree className="h-4 w-4" />
              {t('categories')}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/resources/products">
              <Package className="h-4 w-4" />
              {t('products')}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/resources/tags">
              <FileText className="h-4 w-4" />
              {t('tags')}
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          icon={FileText}
          label={t('statResourceTotal')}
          value={total}
          gradient="bg-gradient-to-br from-indigo-500 to-purple-700"
        />
        <StatCard
          icon={FolderTree}
          label={t('statCategoryTotal')}
          value={categories.length}
          gradient="bg-gradient-to-br from-teal-500 to-emerald-600"
        />
      </div>

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
        <div className="w-full max-w-[200px]">
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
        <Button onClick={openCreate} size="sm" className="ml-auto">
          <Plus className="h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      <ResourcesTable resources={resources} isLoading={isLoading} error={error} onEdit={openEdit} />

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

      <ResourceFormDialog
        open={open}
        editing={editing}
        categories={categories}
        onClose={closeDialog}
        t={t}
      />
    </div>
  )
}
