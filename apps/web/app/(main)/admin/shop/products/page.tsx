'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Package,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { exportToExcel } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { ImageUpload } from '@/components/form/ImageUpload'
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
  Switch,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import { cn } from '@/lib/utils'

interface Product {
  id: string
  name: string
  category: string
  price: number
  stock: number
  sales?: number
  desc?: string
  images?: string | string[]
  status: 'online' | 'offline'
  type?: string
  denomination?: string
  denominationVip?: string
  denominationOperate?: string
  createdAt: string
}

interface ListData {
  list: Product[]
  total: number
}

const PAGE_SIZE = 10

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const EMPTY = {
  name: '',
  category: '',
  price: '0',
  stock: '0',
  sales: '0',
  desc: '',
  images: [] as string[],
  status: true,
  type: '',
  denomination: '',
  denominationVip: '',
  denominationOperate: '',
}

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

const EXPORT_COLUMNS = [
  { key: 'id', title: 'ID' },
  { key: 'name', title: '商品名称' },
  { key: 'price', title: '价格(分)' },
  { key: 'stock', title: '库存' },
  { key: 'sales', title: '销量' },
  { key: 'category', title: '分类' },
  { key: 'desc', title: '描述' },
  {
    key: 'status',
    title: '状态',
    formatter: (v: unknown) => (v === 'online' || v === 1 ? '上架' : '下架'),
  },
  { key: 'type', title: '类型' },
  { key: 'denomination', title: '面额' },
  { key: 'denominationVip', title: 'VIP面额' },
  { key: 'denominationOperate', title: '运营商面额' },
]

function toArrayImages(v?: string | string[]): string[] {
  if (!v) return []
  if (Array.isArray(v)) return v
  return String(v).split(',').filter(Boolean)
}

export default function AdminShopProductsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState({ name: '', category: '', status: '', type: '' })
  const [debounced, setDebounced] = React.useState(search)
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Product | null>(null)
  const [form, setForm] = React.useState(EMPTY)
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
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(p: Product) {
    setEditing(p)
    setForm({
      name: p.name,
      category: p.category,
      price: String(p.price),
      stock: String(p.stock),
      sales: String(p.sales ?? 0),
      desc: p.desc ?? '',
      images: toArrayImages(p.images),
      status: p.status === 'online',
      type: p.type ?? '',
      denomination: p.denomination ?? '',
      denominationVip: p.denominationVip ?? '',
      denominationOperate: p.denominationOperate ?? '',
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
      setErr('请输入商品名称')
      return
    }
    if (form.price === '' || Number(form.price) < 0) {
      setErr('请输入有效价格')
      return
    }
    if (form.stock === '' || Number(form.stock) < 0) {
      setErr('请输入有效库存')
      return
    }
    if (form.sales === '' || Number(form.sales) < 0) {
      setErr('请输入有效销量')
      return
    }
    if (!form.category.trim()) {
      setErr('请输入分类')
      return
    }
    if (!form.type.trim()) {
      setErr('请输入类型')
      return
    }
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

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search.name}
            onChange={(e) => setSearch({ ...search, name: e.target.value })}
            placeholder="搜索商品名称"
            className="h-9 pl-8"
          />
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search.category}
            onChange={(e) => setSearch({ ...search, category: e.target.value })}
            placeholder="搜索分类"
            className="h-9 pl-8"
          />
        </div>
        <Input
          value={search.type}
          onChange={(e) => setSearch({ ...search, type: e.target.value })}
          placeholder="搜索类型"
          className="h-9 w-full max-w-[160px]"
        />
        <Select
          value={search.status}
          onValueChange={(v) => setSearch({ ...search, status: v === 'all' ? '' : v })}
        >
          <SelectTrigger className={cn(selectClass, 'w-[120px]')}>
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="online">上架</SelectItem>
            <SelectItem value="offline">下架</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RotateCcw className="h-4 w-4" />
          重置
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-3 py-2.5 text-xs uppercase">商品</TableHead>
              <TableHead className="px-3 py-2.5 text-xs uppercase">分类</TableHead>
              <TableHead className="px-3 py-2.5 text-xs uppercase">价格</TableHead>
              <TableHead className="px-3 py-2.5 text-xs uppercase">库存</TableHead>
              <TableHead className="px-3 py-2.5 text-xs uppercase">销量</TableHead>
              <TableHead className="px-3 py-2.5 text-xs uppercase">类型</TableHead>
              <TableHead className="px-3 py-2.5 text-xs uppercase">面额</TableHead>
              <TableHead className="px-3 py-2.5 text-xs uppercase">VIP面额</TableHead>
              <TableHead className="px-3 py-2.5 text-xs uppercase">运营商面额</TableHead>
              <TableHead className="px-3 py-2.5 text-xs uppercase">图片</TableHead>
              <TableHead className="px-3 py-2.5 text-xs uppercase">状态</TableHead>
              <TableHead className="px-3 py-2.5 text-right text-xs uppercase">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={12} className="px-3 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中…
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="px-3 py-10 text-center text-muted-foreground">
                  暂无商品
                </TableCell>
              </TableRow>
            ) : (
              list.map((p) => {
                const imgs = toArrayImages(p.images)
                return (
                  <TableRow key={p.id} className="hover:bg-muted/30">
                    <TableCell className="px-3 py-2.5 font-medium">{p.name}</TableCell>
                    <TableCell className="px-3 py-2.5">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        {p.category || '-'}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2.5">¥{(p.price / 100).toFixed(2)}</TableCell>
                    <TableCell className="px-3 py-2.5">{p.stock}</TableCell>
                    <TableCell className="px-3 py-2.5">{p.sales ?? 0}</TableCell>
                    <TableCell className="px-3 py-2.5">{p.type || '-'}</TableCell>
                    <TableCell className="px-3 py-2.5">{p.denomination || '-'}</TableCell>
                    <TableCell className="px-3 py-2.5">{p.denominationVip || '-'}</TableCell>
                    <TableCell className="px-3 py-2.5">{p.denominationOperate || '-'}</TableCell>
                    <TableCell className="px-3 py-2.5">
                      {imgs.length > 0 ? (
                        <div className="flex gap-1">
                          {imgs.slice(0, 3).map((src, i) => (
                            <img
                              key={i}
                              src={src}
                              alt=""
                              className="h-8 w-8 rounded object-cover"
                              onError={(e) =>
                                ((e.target as HTMLImageElement).style.display = 'none')
                              }
                            />
                          ))}
                          {imgs.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{imgs.length - 3}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
                          p.status === 'online'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            p.status === 'online' ? 'bg-emerald-500' : 'bg-muted-foreground',
                          )}
                        />
                        {p.status === 'online' ? '上架' : '下架'}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleMut.mutate(p)}
                          disabled={toggleMut.isPending}
                        >
                          {p.status === 'online' ? '下架' : '上架'}
                        </Button>
                        <HasPermi code="ai:zhs_product:edit">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEdit(p)}
                            title="编辑"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </HasPermi>
                        <HasPermi code="ai:zhs_product:remove">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(p)}
                            title="删除"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </HasPermi>
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

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? '编辑商品' : '新建商品'}</DialogTitle>
              <DialogDescription>配置商品信息</DialogDescription>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="pr-name">商品名称 *</Label>
                <Input
                  id="pr-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="请输入商品名称"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pr-cat">分类 *</Label>
                <Input
                  id="pr-cat"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="请输入分类"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pr-price">价格（分）*</Label>
                <Input
                  id="pr-price"
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pr-stock">库存 *</Label>
                <Input
                  id="pr-stock"
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pr-sales">销量 *</Label>
                <Input
                  id="pr-sales"
                  type="number"
                  value={form.sales}
                  onChange={(e) => setForm({ ...form, sales: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pr-type">类型 *</Label>
                <Input
                  id="pr-type"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  placeholder="请输入类型"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pr-den">面额</Label>
                <Input
                  id="pr-den"
                  value={form.denomination}
                  onChange={(e) => setForm({ ...form, denomination: e.target.value })}
                  placeholder="请输入面额"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pr-den-vip">VIP面额</Label>
                <Input
                  id="pr-den-vip"
                  value={form.denominationVip}
                  onChange={(e) => setForm({ ...form, denominationVip: e.target.value })}
                  placeholder="请输入VIP面额"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pr-den-op">运营商面额</Label>
                <Input
                  id="pr-den-op"
                  value={form.denominationOperate}
                  onChange={(e) => setForm({ ...form, denominationOperate: e.target.value })}
                  placeholder="请输入运营商面额"
                />
              </div>
              <div className="flex items-center gap-2 pt-7">
                <Switch
                  checked={form.status}
                  onCheckedChange={(v) => setForm({ ...form, status: v })}
                />
                <Label>{form.status ? '上架' : '下架'}</Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-desc">描述</Label>
              <textarea
                id="pr-desc"
                value={form.desc}
                onChange={(e) => setForm({ ...form, desc: e.target.value })}
                placeholder="请输入描述"
                className="min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>商品图片</Label>
              <ImageUpload
                value={form.images}
                onChange={(v) => setForm({ ...form, images: Array.isArray(v) ? v : v ? [v] : [] })}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={saveMut.isPending}
              >
                取消
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
