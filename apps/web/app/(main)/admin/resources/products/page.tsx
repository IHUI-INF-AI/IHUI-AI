'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@ihui/ui-react'

import { ProductFilter } from './ProductFilter'
import { ProductTable } from './ProductTable'
import { ProductDialog } from './ProductDialog'
import { PAGE_SIZE, api, EMPTY_FORM, fetchProducts, productToForm } from './helpers'
import type { Product, ProductForm, ResourcesData } from './types'

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
    setForm(productToForm(p))
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

      <ProductFilter search={search} setSearch={setSearch} onCreate={openCreate} />

      <ProductTable
        list={products}
        isLoading={isLoading}
        error={error}
        deletePending={deleteMut.isPending}
        onEdit={openEdit}
        onDelete={handleDelete}
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

      <ProductDialog
        open={open}
        editing={editing}
        form={form}
        setForm={setForm}
        err={err}
        savePending={saveMut.isPending}
        resources={resources}
        onSubmit={submit}
        onClose={closeDialog}
      />
    </div>
  )
}
