'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, Search, Loader2, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react'
import { eduApi, buildQs, selectClass, type PageData } from '@/lib/edu'
import { cn } from '@/lib/utils'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Label, Select, SelectTrigger, SelectContent, SelectItem, SelectValue, Switch, Card, CardContent,
} from '@ihui/ui'

interface Course {
  id: string; title: string; intro: string | null
  categoryName: string | null; lecturerName: string | null
  price: string; isFree: boolean; isPublished: boolean
  signupCount: number; viewCount: number
}
interface Category { id: string; name: string }
interface CForm { title: string; categoryId: string; intro: string; lecturerName: string; price: string; isFree: boolean; isPublished: boolean }
const EMPTY: CForm = { title: '', categoryId: '', intro: '', lecturerName: '', price: '0', isFree: false, isPublished: false }
const PAGE_SIZE = 10

export default function EduCoursePage() {
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [categoryId, setCategoryId] = React.useState('all')
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Course | null>(null)
  const [form, setForm] = React.useState<CForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => { const tm = setTimeout(() => { setDebounced(search); setPage(1) }, 300); return () => clearTimeout(tm) }, [search])
  React.useEffect(() => { setPage(1) }, [categoryId])

  const { data: catData } = useQuery({ queryKey: ['edu', 'course', 'categories'], queryFn: () => eduApi<{ list: Category[] }>(`/api/admin/learn/categories`).then((d) => d.list ?? []) })
  const categories = catData ?? []

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'course', debounced, categoryId, page],
    queryFn: () => eduApi<PageData<Course>>(`/api/admin/learn/lessons${buildQs({ page, pageSize: PAGE_SIZE, search: debounced, categoryId: categoryId === 'all' ? '' : categoryId })}`),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = { title: form.title.trim(), categoryId: form.categoryId || null, intro: form.intro.trim() || null, lecturerName: form.lecturerName.trim() || null, price: form.price, isFree: form.isFree, isPublished: form.isPublished }
      if (editing) return eduApi(`/api/admin/learn/lessons/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
      return eduApi(`/api/admin/learn/lessons`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => { toast.success(editing ? '更新成功' : '创建成功'); qc.invalidateQueries({ queryKey: ['edu', 'course'] }); closeDialog() },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/learn/lessons/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('删除成功'); qc.invalidateQueries({ queryKey: ['edu', 'course'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() { setEditing(null); setForm(EMPTY); setErr(null); setOpen(true) }
  function openEdit(c: Course) { setEditing(c); setForm({ title: c.title, categoryId: '', intro: c.intro ?? '', lecturerName: c.lecturerName ?? '', price: c.price, isFree: c.isFree, isPublished: c.isPublished }); setErr(null); setOpen(true) }
  function closeDialog() { if (saveMut.isPending) return; setOpen(false); setEditing(null); setErr(null) }
  function submit(e: React.FormEvent) { e.preventDefault(); setErr(null); if (!form.title.trim()) return setErr('标题不能为空'); saveMut.mutate() }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold tracking-tight">课程管理</h1><p className="mt-1 text-sm text-muted-foreground">课程 CRUD、分类与章节管理</p></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">课程总数</div><div className="mt-1 text-2xl font-semibold">{total}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">已上架</div><div className="mt-1 text-2xl font-semibold">{rows.filter((c) => c.isPublished).length}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">免费课程</div><div className="mt-1 text-2xl font-semibold">{rows.filter((c) => c.isFree).length}</div></CardContent></Card>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm"><Link href="/admin/edu"><ChevronLeft className="h-4 w-4" />返回教育后台</Link></Button>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索课程..." className="h-9 pl-8" />
        </div>
        <div className="w-full max-w-[180px]">
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className={selectClass} aria-label="分类"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">全部分类</SelectItem>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button onClick={openCreate} size="sm" className="ml-auto"><Plus className="h-4 w-4" />新建课程</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50"><TableRow>
            <TableHead className="px-4 py-2.5">标题</TableHead><TableHead className="px-4 py-2.5">分类</TableHead>
            <TableHead className="px-4 py-2.5">讲师</TableHead><TableHead className="px-4 py-2.5">报名</TableHead>
            <TableHead className="px-4 py-2.5">状态</TableHead><TableHead className="px-4 py-2.5 text-right">操作</TableHead>
          </TableRow></TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (<TableRow><TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />加载中...</TableCell></TableRow>
            ) : error ? (<TableRow><TableCell colSpan={6} className="px-4 py-10 text-center text-destructive">{(error as Error).message}</TableCell></TableRow>
            ) : rows.length === 0 ? (<TableRow><TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground"><BookOpen className="mx-auto mb-2 h-8 w-8 opacity-40" />暂无课程</TableCell></TableRow>
            ) : rows.map((c) => (
              <TableRow key={c.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5"><div className="font-medium">{c.title}</div>{c.intro && <div className="max-w-xs truncate text-xs text-muted-foreground">{c.intro}</div>}</TableCell>
                <TableCell className="px-4 py-2.5">{c.categoryName ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5">{c.lecturerName ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5">{c.signupCount}</TableCell>
                <TableCell className="px-4 py-2.5"><div className="flex flex-col gap-1">
                  <span className={cn('inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', c.isPublished ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' : 'bg-muted text-muted-foreground')}><span className={cn('h-1.5 w-1.5 rounded-full', c.isPublished ? 'bg-emerald-500' : 'bg-muted-foreground')} />{c.isPublished ? '已上架' : '未上架'}</span>
                  <span className={cn('inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium', c.isFree ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400')}>{c.isFree ? '免费' : '付费'}</span>
                </div></TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)} title="编辑"><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => { if (window.confirm('确定删除？')) deleteMut.mutate(c.id) }} title="删除" className="text-destructive hover:text-destructive" disabled={deleteMut.isPending}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
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
      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-w-xl">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader><DialogTitle>{editing ? '编辑课程' : '新建课程'}</DialogTitle></DialogHeader>
            {err && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
            <div className="space-y-2"><Label htmlFor="c-title">标题</Label><Input id="c-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label htmlFor="c-cat">分类</Label>
                <Select value={form.categoryId || 'none'} onValueChange={(v) => setForm({ ...form, categoryId: v === 'none' ? '' : v })}>
                  <SelectTrigger className={selectClass} id="c-cat"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">无分类</SelectItem>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label htmlFor="c-lec">讲师</Label><Input id="c-lec" value={form.lecturerName} onChange={(e) => setForm({ ...form, lecturerName: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="c-intro">简介</Label><Input id="c-intro" value={form.intro} onChange={(e) => setForm({ ...form, intro: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="c-price">价格</Label><Input id="c-price" type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2"><Switch id="c-free" checked={form.isFree} onCheckedChange={(v) => setForm({ ...form, isFree: v })} /><Label htmlFor="c-free">免费</Label></div>
              <div className="flex items-center gap-2"><Switch id="c-pub" checked={form.isPublished} onCheckedChange={(v) => setForm({ ...form, isPublished: v })} /><Label htmlFor="c-pub">上架</Label></div>
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={closeDialog} disabled={saveMut.isPending}>取消</Button><Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}保存</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
