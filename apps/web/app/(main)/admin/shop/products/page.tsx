'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Pencil, Trash2, Package, Search } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@ihui/ui'
import { cn } from '@/lib/utils'

interface Product {
  id: string
  name: string
  category: string
  price: number
  stock: number
  status: 'online' | 'offline'
  createdAt: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const EMPTY = { name: '', category: '', price: '0', stock: '0' }

export default function AdminShopProductsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Product | null>(null)
  const [form, setForm] = React.useState(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['admin', 'shop', 'products'],
    queryFn: () => api<{ list: Product[] }>('/api/admin/shop/products').then((d) => d.list ?? []),
  })

  const filtered = React.useMemo(() => {
    const kw = search.trim().toLowerCase()
    if (!kw) return list
    return list.filter((p) => p.name.toLowerCase().includes(kw) || p.category.toLowerCase().includes(kw))
  }, [list, search])

  const saveMut = useMutation({
    mutationFn: () => {
      const body = { name: form.name, category: form.category, price: Number(form.price) || 0, stock: Number(form.stock) || 0 }
      return editing
        ? api(`/api/admin/shop/products/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : api('/api/admin/shop/products', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'shop', 'products'] }); setOpen(false) },
    onError: (e: Error) => setErr(e.message),
  })

  const toggleMut = useMutation({
    mutationFn: (p: Product) =>
      api(`/api/admin/shop/products/${p.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: p.status === 'online' ? 'offline' : 'online' }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'shop', 'products'] }),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/shop/products/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'shop', 'products'] }),
  })

  const openCreate = () => { setEditing(null); setForm(EMPTY); setErr(null); setOpen(true) }
  const openEdit = (p: Product) => {
    setEditing(p)
    setForm({ name: p.name, category: p.category, price: String(p.price), stock: String(p.stock) })
    setErr(null); setOpen(true)
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setErr(null)
    if (!form.name.trim()) { setErr('请输入商品名称'); return }
    saveMut.mutate()
  }

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
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />新建商品</Button>
      </div>

      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索商品/分类" className="h-9 pl-8" />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs uppercase">商品</TableHead>
              <TableHead className="text-xs uppercase">分类</TableHead>
              <TableHead className="text-xs uppercase">价格</TableHead>
              <TableHead className="text-xs uppercase">库存</TableHead>
              <TableHead className="text-xs uppercase">状态</TableHead>
              <TableHead className="text-right text-xs uppercase">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">暂无商品</TableCell></TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell><span className="rounded bg-muted px-1.5 py-0.5 text-xs">{p.category || '-'}</span></TableCell>
                  <TableCell>¥{(p.price / 100).toFixed(2)}</TableCell>
                  <TableCell>{p.stock}</TableCell>
                  <TableCell>
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs', p.status === 'online' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground')}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', p.status === 'online' ? 'bg-emerald-500' : 'bg-muted-foreground')} />
                      {p.status === 'online' ? '上架' : '下架'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => toggleMut.mutate(p)} disabled={toggleMut.isPending}>
                        {p.status === 'online' ? '下架' : '上架'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm('确认删除？')) delMut.mutate(p.id) }}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={(o) => (o ? null : (setOpen(false), setErr(null)))}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? '编辑商品' : '新建商品'}</DialogTitle>
              <DialogDescription>配置商品信息</DialogDescription>
            </DialogHeader>
            {err && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
            <div className="space-y-2">
              <Label htmlFor="pr-name">商品名称</Label>
              <Input id="pr-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-cat">分类</Label>
              <Input id="pr-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="输入分类" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="pr-price">价格（分）</Label>
                <Input id="pr-price" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pr-stock">库存</Label>
                <Input id="pr-stock" type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saveMut.isPending}>取消</Button>
              <Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}保存</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
