'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Pencil, Trash2, Package } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
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

interface ApiPackage {
  id: string
  name: string
  price: number
  quota: number
  period: 'month' | 'year' | 'permanent'
  description: string | null
  status: number
  createdAt: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const selectClass = 'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const PERIODS: ApiPackage['period'][] = ['month', 'year', 'permanent']
const PERIOD_LABEL: Record<ApiPackage['period'], string> = { month: '月', year: '年', permanent: '永久' }
const EMPTY = { name: '', price: '0', quota: '0', period: 'month' as ApiPackage['period'], description: '' }

export default function AdminApiPlatformPackagesPage() {
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ApiPackage | null>(null)
  const [form, setForm] = React.useState(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['admin', 'api-platform', 'packages'],
    queryFn: () => api<{ list: ApiPackage[] }>('/api/admin/api-platform/packages').then((d) => d.list ?? []),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        price: Number(form.price) || 0,
        quota: Number(form.quota) || 0,
        period: form.period,
        description: form.description,
      }
      return editing
        ? api(`/api/admin/api-platform/packages/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : api('/api/admin/api-platform/packages', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'api-platform', 'packages'] })
      setOpen(false)
    },
    onError: (e: Error) => setErr(e.message),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/api-platform/packages/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'api-platform', 'packages'] }),
  })

  const openCreate = () => { setEditing(null); setForm(EMPTY); setErr(null); setOpen(true) }
  const openEdit = (p: ApiPackage) => {
    setEditing(p)
    setForm({ name: p.name, price: String(p.price), quota: String(p.quota), period: p.period, description: p.description ?? '' })
    setErr(null); setOpen(true)
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setErr(null)
    if (!form.name.trim()) { setErr('请输入套餐名称'); return }
    saveMut.mutate()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Package className="h-6 w-6 text-primary" />
            API 套餐管理
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">管理 API 计费套餐</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          新建套餐
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs uppercase">套餐名称</TableHead>
              <TableHead className="text-xs uppercase">价格</TableHead>
              <TableHead className="text-xs uppercase">配额</TableHead>
              <TableHead className="text-xs uppercase">周期</TableHead>
              <TableHead className="text-xs uppercase">状态</TableHead>
              <TableHead className="text-right text-xs uppercase">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">暂无套餐</TableCell>
              </TableRow>
            ) : (
              list.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    {p.name}
                    {p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}
                  </TableCell>
                  <TableCell>¥{p.price}</TableCell>
                  <TableCell>{p.quota.toLocaleString()}</TableCell>
                  <TableCell>{PERIOD_LABEL[p.period]}</TableCell>
                  <TableCell>
                    {p.status === 1 ? (
                      <span className="inline-flex rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-600">上架</span>
                    ) : (
                      <span className="inline-flex rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">下架</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" />编辑</Button>
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm('确认删除？')) delMut.mutate(p.id) }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
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
              <DialogTitle>{editing ? '编辑套餐' : '新建套餐'}</DialogTitle>
              <DialogDescription>配置 API 计费套餐</DialogDescription>
            </DialogHeader>
            {err && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
            <div className="space-y-2">
              <Label htmlFor="pk-name">套餐名称</Label>
              <Input id="pk-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="pk-price">价格</Label>
                <Input id="pk-price" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pk-quota">配额</Label>
                <Input id="pk-quota" type="number" value={form.quota} onChange={(e) => setForm({ ...form, quota: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>周期</Label>
                <Select value={form.period} onValueChange={(v) => setForm({ ...form, period: v as ApiPackage['period'] })}>
                  <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIODS.map((p) => <SelectItem key={p} value={p}>{PERIOD_LABEL[p]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pk-desc">描述</Label>
              <Input id="pk-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saveMut.isPending}>取消</Button>
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
