'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Package, Download, ChevronLeft, ChevronRight } from 'lucide-react'

import { exportToExcel } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { Button } from '@ihui/ui'

import { ProductFilter } from './ProductFilter'
import { ProductTable } from './ProductTable'
import { ProductDialog } from './ProductDialog'
import { PAGE_SIZE, api, EMPTY_FORM, EXPORT_COLUMNS, productToForm } from './helpers'
import type { Product, ListData, ProductForm, ProductSearch } from './types'

export default function AdminShopProductsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState<ProductSearch>({
    name: '',
    category: '',
    status: '',
    type: '',
  })
  const [debounced, setDebounced] = React.useState(search)
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Product | null>(null)
  const [form, setForm] = React.useState<ProductForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [search])

  const qs = React.useMemo(() => {
    const q = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    if (debounced.name) q.set('name', debounced.name)
    if (debounced.category) q.set('category', debounced.category)
    if (debounced.status) q.set('status', debounced.status)
    if (debounced.type) q.set('type', debounced.type)
    return q.toString()
  }, [debounced, page])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'shop', 'products', qs],
    queryFn: () => api<ListData>(`/api/admin/shop/products?${qs}`),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        category: form.category.trim(),
        price: Number(form.price) || 0,
        stock: Number(form.stock) || 0,
        sales: Number(form.sales) || 0,
        desc: form.desc.trim() || undefined,
        images: form.images.join(',') || undefined,
        status: form.status ? 'online' : 'offline',
        type: form.type.trim() || undefined,
        denomination: form.denomination.trim() || undefined,
        denominationVip: form.denominationVip.trim() || undefined,
        denominationOperate: form.denominationOperate.trim() || undefined,
      }
      return editing
        ? api(`/api/admin/shop/products/${editing.id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          })
        : api('/api/admin/shop/products', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '新增成功')
      qc.invalidateQueries({ queryKey: ['admin', 'shop', 'products'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const toggleMut = useMutation({
    mutationFn: (p: Product) =>
      api(`/api/admin/shop/products/${p.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: p.status === 'online' ? 'offline' : 'online' }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'shop', 'products'] }),
    onError: (e: Error) => toast.error(e.message),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/shop/products/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'shop', 'products'] })
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
    if (!form.name.trim()) return setErr('请输入商品名称')
    if (form.price === '' || Number(form.price) < 0) return setErr('请输入有效价格')
    if (form.stock === '' || Number(form.stock) < 0) return setErr('请输入有效库存')
    if (form.sales === '' || Number(form.sales) < 0) return setErr('请输入有效销量')
    if (!form.category.trim()) return setErr('请输入分类')
    if (!form.type.trim()) return setErr('请输入类型')
    saveMut.mutate()
  }
  function handleDelete(p: Product) {
    if (!window.confirm(`确认删除 "${p.name}" ?`)) return
    delMut.mutate(p.id)
  }
  function handleReset() {
    setSearch({ name: '', category: '', status: '', type: '' })
  }
  function handleExport() {
    exportToExcel(
      '商品',
      EXPORT_COLUMNS,
      (data?.list ?? []) as unknown as Record<string, unknown>[],
    )
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Package className="h-6 w-6 text-primary" />
            商品管理
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">商品列表、分类与上下架</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            导出
          </Button>
          <HasPermi code="ai:zhs_product:add">
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              新建商品
            </Button>
          </HasPermi>
        </div>
      </div>

      <ProductFilter search={search} setSearch={setSearch} onReset={handleReset} />

      <ProductTable
        list={list}
        isLoading={isLoading}
        togglePending={toggleMut.isPending}
        onToggle={toggleMut.mutate}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
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
        onSubmit={submit}
        onClose={closeDialog}
      />
    </div>
  )
}
