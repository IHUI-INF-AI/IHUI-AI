'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Edit, FolderTree, Loader2, Plus, Search, Trash2 } from 'lucide-react'
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ihui/ui'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'

interface Category { id: string; name: string; sort: number; status: number; createdAt: string }
interface ListData { list: Category[]; total: number }
interface CategoryForm { name: string; sort: string; status: boolean }

const PAGE_SIZE = 20
const EMPTY_FORM: CategoryForm = { name: '', sort: '0', status: true }
const fmt = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function StatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium', enabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' : 'bg-muted text-muted-foreground')}>
      <span className={cn('h-1.5 w-1.5 rounded-full', enabled ? 'bg-emerald-500' : 'bg-muted-foreground')} />
      {enabled ? '启用' : '禁用'}
    </span>
  )
}

export default function AdminLearnTopicCategoryPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<string>('all')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Category | null>(null)
  const [form, setForm] = React.useState<CategoryForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => { setDebounced(search); setPage(1) }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'learn', 'topic', 'category', debounced, statusFilter, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (debounced) qs.set('keyword', debounced)
      if (statusFilter !== 'all') qs.set('status', statusFilter)
      return api<ListData>(`/api/learn/topics/categories?${qs.toString()}`)
    },
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = { name: form.name.trim(), sort: Number(form.sort) || 0, status: form.status ? 1 : 0 }
      const url = editing ? `/api/learn/topics/categories/${editing.id}` : '/api/learn/topics/categories'
      return api<{ category: Category }>(url, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '修改成功' : '创建成功')
      qc.invalidateQueries({ queryKey: ['admin', 'learn', 'topic', 'category'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/learn/topics/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('删除成功'); qc.invalidateQueries({ queryKey: ['admin', 'learn', 'topic', 'category'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() { setEditing(null); setForm(EMPTY_FORM); setErr(null); setOpen(true) }
  function openEdit(item: Category) { setEditing(item); setForm({ name: item.name, sort: String(item.sort), status: item.status === 1 }); setErr(null); setOpen(true) }
  function closeDialog() { if (saveMut.isPending) return; setOpen(false); setEditing(null); setErr(null) }
  function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null)
    if (!form.name.trim()) { setErr('请输入分类名称'); return }
    saveMut.mutate()
  }
  function handleDelete(item: Category) {
    if (!window.confirm(`确定删除分类「${item.name}」吗?`)) return
    deleteMut.mutate(item.id)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const list = data?.list ?? []

  function renderRows() {
    if (isLoading) return (<TableRow><TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />加载中...</TableCell></TableRow>)
    if (error) return (<TableRow><TableCell colSpan={5} className="px-4 py-10 text-center text-destructive">{(error as Error).message}</TableCell></TableRow>)
    if (list.length === 0) return (<TableRow><TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground"><FolderTree className="mx-auto mb-2 h-8 w-8 opacity-40" />暂无数据</TableCell></TableRow>)
    return list.map((item) => (
      <TableRow key={item.id} className="hover:bg-muted/30">
        <TableCell className="px-4 py-2.5 font-medium">{item.name}</TableCell>
        <TableCell className="px-4 py-2.5">{item.sort}</TableCell>
        <TableCell className="px-4 py-2.5"><StatusBadge enabled={item.status === 1} /></TableCell>
        <TableCell className="px-4 py-2.5 text-muted-foreground">{fmt.format(new Date(item.createdAt))}</TableCell>
        <TableCell className="px-4 py-2.5 text-right">
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => openEdit(item)} title="编辑"><Edit className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" onClick={() => handleDelete(item)} title="删除" className="text-destructive hover:text-destructive" disabled={deleteMut.isPending}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </TableCell>
      </TableRow>
    ))
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">学习专题分类</h1>
        <p className="mt-1 text-sm text-muted-foreground">管理学习专题下的分类,支持排序与状态切换</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/learn"><ChevronLeft className="h-4 w-4" />返回学习管理</Link>
        </Button>
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索分类名称" className="h-9 w-56 pl-8" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="h-9 w-32"><SelectValue placeholder="状态" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="1">启用</SelectItem>
            <SelectItem value="0">禁用</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4" />新建分类</Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">名称</TableHead>
              <TableHead className="px-4 py-2.5">排序</TableHead>
              <TableHead className="px-4 py-2.5">状态</TableHead>
              <TableHead className="px-4 py-2.5">创建时间</TableHead>
              <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{renderRows()}</TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft className="h-4 w-4" />上一页</Button>
          <span className="text-sm text-muted-foreground">第 {page} / {totalPages} 页</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>下一页<ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={(o) => { if (!o) closeDialog() }}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader><DialogTitle>{editing ? '编辑分类' : '新建分类'}</DialogTitle></DialogHeader>
            {err && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
            <div className="space-y-2">
              <Label htmlFor="cat-name">分类名称</Label>
              <Input id="cat-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="请输入分类名称" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cat-sort">排序</Label>
                <Input id="cat-sort" type="number" min="0" value={form.sort} onChange={(e) => setForm({ ...form, sort: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-status">状态</Label>
                <div className="flex h-9 items-center gap-2">
                  <Switch id="cat-status" checked={form.status} onCheckedChange={(v) => setForm({ ...form, status: v })} />
                  <span className="text-sm text-muted-foreground">{form.status ? '启用' : '禁用'}</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog} disabled={saveMut.isPending}>取消</Button>
              <Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}保存</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
