'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  Tag,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Switch,
} from '@ihui/ui'

interface Category {
  categoryId: string
  name: string
  description: string | null
  icon: string | null
  sort: number
  status: string
  isPaid: boolean
  createdAt: string
  updatedAt: string
}

interface CategoriesData {
  list: Category[]
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

function fetchCategories(params: { page: number; keyword: string }): Promise<CategoriesData> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) })
  if (params.keyword) qs.set('keyword', params.keyword)
  return api<CategoriesData>(`/api/categories/list?${qs.toString()}`)
}

interface CategoryForm {
  name: string
  description: string
  icon: string
  sort: string
  status: boolean
  isPaid: boolean
}

const EMPTY_FORM: CategoryForm = {
  name: '',
  description: '',
  icon: '',
  sort: '0',
  status: true,
  isPaid: false,
}

export default function AdminCategoriesPage() {
  const t = useTranslations('admin.agents.categories')
  const tc = useTranslations('common')
  const locale = useLocale()
  const qc = useQueryClient()

  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)

  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Category | null>(null)
  const [form, setForm] = React.useState<CategoryForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'agents', 'categories', debounced, page],
    queryFn: () => fetchCategories({ page, keyword: debounced }),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        icon: form.icon.trim() || undefined,
        sort: Number(form.sort) || 0,
        status: form.status ? '1' : '0',
        isPaid: form.isPaid,
      }
      if (editing) {
        return api<Category>(`/api/categories/${editing.categoryId}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      }
      return api<Category>('/api/categories/create', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'agents', 'categories'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const togglePaidMut = useMutation({
    mutationFn: (p: { cat: Category; enable: boolean }) =>
      api<Category>(
        `/api/categories/${p.cat.categoryId}/${p.enable ? 'enable' : 'disable'}`,
        { method: 'POST' },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'agents', 'categories'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'agents', 'categories'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }

  function openEdit(cat: Category) {
    setEditing(cat)
    setForm({
      name: cat.name,
      description: cat.description ?? '',
      icon: cat.icon ?? '',
      sort: String(cat.sort),
      status: cat.status === '1',
      isPaid: cat.isPaid,
    })
    setErr(null)
    setOpen(true)
  }

  function closeDialog() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
    setErr(null)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.name.trim()) {
      setErr(t('nameRequired'))
      return
    }
    saveMut.mutate()
  }

  function handleDelete(cat: Category) {
    if (!window.confirm(t('deleteConfirm'))) return
    deleteMut.mutate(cat.categoryId)
  }

  const categories = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Tag className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {tc('create')}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="h-9 pl-8"
            aria-label={tc('search')}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">{t('colName')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colDescription')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colIcon')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colSort')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colPaid')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colCreatedAt')}</TableHead>
              <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={8} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  <Tag className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('empty')}
                </TableCell>
              </TableRow>
            ) : (
              categories.map((c) => {
                const enabled = c.status === '1'
                return (
                  <TableRow key={c.categoryId} className="transition-colors hover:bg-muted/30">
                    <TableCell className="px-4 py-2.5 font-medium">{c.name}</TableCell>
                    <TableCell className="px-4 py-2.5 text-muted-foreground">
                      <span className="line-clamp-1">{c.description || '-'}</span>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-muted-foreground">
                      {c.icon || '-'}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-muted-foreground">{c.sort}</TableCell>
                    <TableCell className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                          enabled
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            enabled ? 'bg-emerald-500' : 'bg-muted-foreground',
                          )}
                        />
                        {enabled ? t('enabled') : t('disabled')}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <Switch
                        checked={c.isPaid}
                        disabled={togglePaidMut.isPending}
                        onCheckedChange={(v) =>
                          togglePaidMut.mutate({ cat: c, enable: v })
                        }
                        aria-label={t('colPaid')}
                      />
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                      {dateFmt.format(new Date(c.createdAt))}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEdit(c)}
                          title={tc('edit')}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(c)}
                          disabled={deleteMut.isPending}
                          title={tc('delete')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
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
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">
                {t('fieldName')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cat-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                maxLength={100}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-desc">{t('fieldDescription')}</Label>
              <textarea
                id="cat-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cat-icon">{t('fieldIcon')}</Label>
                <Input
                  id="cat-icon"
                  value={form.icon}
                  onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                  placeholder={t('fieldIconPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-sort">{t('fieldSort')}</Label>
                <Input
                  id="cat-sort"
                  type="number"
                  min={0}
                  value={form.sort}
                  onChange={(e) => setForm((f) => ({ ...f, sort: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="cat-status"
                  checked={form.status}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, status: v }))}
                />
                <Label htmlFor="cat-status" className="cursor-pointer">
                  {t('fieldStatus')}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="cat-paid"
                  checked={form.isPaid}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isPaid: v }))}
                />
                <Label htmlFor="cat-paid" className="cursor-pointer">
                  {t('fieldIsPaid')}
                </Label>
              </div>
            </div>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog} disabled={saveMut.isPending}>
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {tc('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
