'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Package,
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
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Switch,
} from '@ihui/ui'

interface Product {
  id: string
  resourceId: string
  resourceName: string | null
  name: string
  price: string
  originalPrice: string | null
  description: string | null
  isPublished: boolean
  sort: number
  status: number
  createdAt: string
  updatedAt: string
}

interface Resource {
  id: string
  title: string
  isPublished: boolean
}

interface ProductsData {
  list: Product[]
  total: number
  page: number
  pageSize: number
}

interface ResourcesData {
  list: Resource[]
  total: number
}

const PAGE_SIZE = 10

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function fetchProducts(params: { page: number; search: string }): Promise<ProductsData> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) })
  if (params.search) qs.set('name', params.search)
  return api<ProductsData>(`/api/admin/resources/products?${qs.toString()}`)
}

interface ProductForm {
  resourceId: string
  name: string
  price: string
  originalPrice: string
  description: string
  isPublished: boolean
  sort: string
}

const EMPTY_FORM: ProductForm = {
  resourceId: '',
  name: '',
  price: '0',
  originalPrice: '',
  description: '',
  isPublished: false,
  sort: '0',
}

export default function AdminResourceProductsPage() {
  const t = useTranslations('admin.resources')
  const qc = useQueryClient()

  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)

  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Product | null>(null)
  const [form, setForm] = React.useState<ProductForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data: resourcesData } = useQuery({
    queryKey: ['admin', 'resources', 'list', 'all'],
    queryFn: () => api<ResourcesData>(`/api/admin/resources?page=1&pageSize=100`).then((d) => d),
  })
  const resources = resourcesData?.list ?? []

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'resources', 'products', debounced, page],
    queryFn: () => fetchProducts({ page, search: debounced }),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        resourceId: form.resourceId,
        name: form.name.trim(),
        price: form.price,
        originalPrice: form.originalPrice.trim() || null,
        description: form.description.trim() || null,
        isPublished: form.isPublished,
        sort: Number(form.sort) || 0,
      }
      if (editing) {
        return api<{ product: Product }>(`/api/admin/resources/products/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      }
      return api<{ product: Product }>(`/api/admin/resources/products`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'resources', 'products'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/resources/products/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'resources', 'products'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }

  function openEdit(p: Product) {
    setEditing(p)
    setForm({
      resourceId: p.resourceId,
      name: p.name,
      price: p.price,
      originalPrice: p.originalPrice ?? '',
      description: p.description ?? '',
      isPublished: p.isPublished,
      sort: String(p.sort),
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
    if (!form.resourceId) {
      setErr(t('resourceRequired'))
      return
    }
    if (!form.name.trim()) {
      setErr(t('nameRequired'))
      return
    }
    saveMut.mutate()
  }

  function handleDelete(p: Product) {
    if (!window.confirm(t('deleteConfirm'))) return
    deleteMut.mutate(p.id)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const products = data?.list ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('productsTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('productsSubtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/resources">
            <ChevronLeft className="h-4 w-4" />
            {t('backToResources')}
          </Link>
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
            aria-label={t('search')}
          />
        </div>
        <Button onClick={openCreate} size="sm" className="ml-auto">
          <Plus className="h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">{t('colName')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colResource')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colPrice')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colOriginalPrice')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
              <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Package className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noData')}
                </TableCell>
              </TableRow>
            ) : (
              products.map((p) => {
                const published = p.isPublished
                return (
                  <TableRow key={p.id} className="hover:bg-muted/30">
                    <TableCell className="px-4 py-2.5">
                      <div className="font-medium">{p.name}</div>
                      {p.description ? (
                        <div className="max-w-xs break-words text-xs text-muted-foreground">
                          {p.description}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      {p.resourceName ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">¥{Number(p.price)}</TableCell>
                    <TableCell className="px-4 py-2.5">
                      {p.originalPrice ? `¥${Number(p.originalPrice)}` : '—'}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                          published
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            published ? 'bg-emerald-500' : 'bg-muted-foreground',
                          )}
                        />
                        {published ? t('published') : t('unpublished')}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(p)}
                          title={t('edit')}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(p)}
                          title={t('delete')}
                          className="text-destructive hover:text-destructive"
                          disabled={deleteMut.isPending}
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

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-w-xl">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="prod-resource">{t('fieldResource')}</Label>
              <Select
                value={form.resourceId || 'none'}
                onValueChange={(v) => setForm({ ...form, resourceId: v === 'none' ? '' : v })}
              >
                <SelectTrigger className={selectClass} id="prod-resource">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('noResource')}</SelectItem>
                  {resources.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.title}
                      {!r.isPublished ? `（${t('unpublished')}）` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prod-name">{t('fieldName')}</Label>
              <Input
                id="prod-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t('namePlaceholder')}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="prod-price">{t('fieldPrice')}</Label>
                <Input
                  id="prod-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder={t('pricePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prod-original">{t('fieldOriginalPrice')}</Label>
                <Input
                  id="prod-original"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.originalPrice}
                  onChange={(e) => setForm({ ...form, originalPrice: e.target.value })}
                  placeholder={t('pricePlaceholder')}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prod-desc">{t('fieldDescription')}</Label>
              <Input
                id="prod-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t('descPlaceholder')}
              />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="prod-published"
                  checked={form.isPublished}
                  onCheckedChange={(v) => setForm({ ...form, isPublished: v })}
                />
                <Label htmlFor="prod-published">{t('fieldPublished')}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="prod-sort">{t('fieldSort')}</Label>
                <Input
                  id="prod-sort"
                  type="number"
                  min="0"
                  value={form.sort}
                  onChange={(e) => setForm({ ...form, sort: e.target.value })}
                  className="w-24"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={saveMut.isPending}
              >
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
