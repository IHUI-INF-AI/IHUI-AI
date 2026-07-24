'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Package, ChevronLeft, ChevronRight, Plus, Trash2, Save, X } from 'lucide-react'
import { Button, Input } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import type { ResourceProduct, ResourceProductListData, ResourceProductForm } from './types'

const PAGE_SIZE = 20
const EMPTY: ResourceProductForm = {
  resourceId: '',
  name: '',
  price: '0',
  originalPrice: '',
  description: '',
  isPublished: true,
  sort: '0',
}
const API = '/api/v1/admin/resource/products'

export default function AdminResourceProductPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [editing, setEditing] = React.useState<ResourceProduct | null>(null)
  const [form, setForm] = React.useState<ResourceProductForm>(EMPTY)
  const [creating, setCreating] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
  if (search) qs.set('name', search)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'resource-product', search, page],
    queryFn: async () => {
      const r = await fetchApi<ResourceProductListData>(`${API}?${qs.toString()}`)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
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
      return editing
        ? fetchApi(`${API}/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : fetchApi(API, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '创建成功')
      qc.invalidateQueries({ queryKey: ['admin', 'resource-product'] })
      closeForm()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => fetchApi(`${API}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'resource-product'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setCreating(true)
    setErr(null)
  }
  function openEdit(p: ResourceProduct) {
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
    setCreating(true)
    setErr(null)
  }
  function closeForm() {
    if (saveMut.isPending) return
    setCreating(false)
    setEditing(null)
    setErr(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.resourceId) {
      setErr('资源 ID 不能为空')
      return
    }
    if (!form.name.trim()) {
      setErr('产品名称不能为空')
      return
    }
    saveMut.mutate()
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Package className="h-6 w-6 text-primary" />
            资源产品
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">管理可售卖资源产品及价格</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          新建产品
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          placeholder="搜索产品名称"
          className="max-w-sm"
        />
      </div>

      {creating ? (
        <form onSubmit={submit} className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label htmlFor="rp-resource-id" className="space-y-1 text-sm">
              <span className="text-muted-foreground">资源 ID</span>
              <Input
                id="rp-resource-id"
                value={form.resourceId}
                onChange={(e) => setForm({ ...form, resourceId: e.target.value })}
                required
              />
            </label>
            <label htmlFor="rp-name" className="space-y-1 text-sm">
              <span className="text-muted-foreground">产品名称</span>
              <Input id="rp-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label htmlFor="rp-price" className="space-y-1 text-sm">
              <span className="text-muted-foreground">价格</span>
              <Input
                id="rp-price"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="tabular-nums"
              />
            </label>
            <label htmlFor="rp-original-price" className="space-y-1 text-sm">
              <span className="text-muted-foreground">原价</span>
              <Input
                id="rp-original-price"
                value={form.originalPrice}
                onChange={(e) => setForm({ ...form, originalPrice: e.target.value })}
                className="tabular-nums"
              />
            </label>
            <label htmlFor="rp-description" className="space-y-1 text-sm md:col-span-2">
              <span className="text-muted-foreground">描述</span>
              <Input
                id="rp-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </label>
            <label htmlFor="rp-sort" className="space-y-1 text-sm">
              <span className="text-muted-foreground">排序</span>
              <Input
                id="rp-sort"
                type="number"
                value={form.sort}
                onChange={(e) => setForm({ ...form, sort: e.target.value })}
                className="tabular-nums"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
              />
              上架
            </label>
          </div>
          {err ? <p className="text-xs text-destructive">{err}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={closeForm}>
              <X className="h-4 w-4" />
              取消
            </Button>
            <Button type="submit" size="sm" disabled={saveMut.isPending}>
              <Save className="h-4 w-4" />
              {saveMut.isPending ? '保存中…' : '保存'}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">产品名称</th>
              <th className="px-3 py-2 text-left">资源 ID</th>
              <th className="px-3 py-2 text-right">价格</th>
              <th className="px-3 py-2 text-right">原价</th>
              <th className="px-3 py-2 text-right">排序</th>
              <th className="px-3 py-2 text-left">状态</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">加载中…</td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">暂无产品</td>
              </tr>
            ) : (
              list.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{p.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.resourceId}</td>
                  <td className="px-3 py-2 text-right tabular-nums">¥{p.price}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {p.originalPrice ? `¥${p.originalPrice}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.sort}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs ${
                        p.isPublished
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {p.isPublished ? '上架' : '下架'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => openEdit(p)}>编辑</Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={deleteMut.isPending}
                        onClick={() => {
                          if (window.confirm(`确定删除产品 ${p.name} 吗？`)) deleteMut.mutate(p.id)
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">共 {total} 个产品</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft className="h-4 w-4" />
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            下一页
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
