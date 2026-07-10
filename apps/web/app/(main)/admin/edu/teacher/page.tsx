'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, Loader2, ChevronLeft, ChevronRight, UserCog, Search } from 'lucide-react'
import { eduApi, buildQs, selectClass, type PageData } from '@/lib/edu'
import { cn } from '@/lib/utils'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Label, Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from '@ihui/ui'

interface Teacher {
  id: string; nickname: string; phone: string | null
  title: string; intro: string | null; courseCount: number
  studentCount: number; rating: number; status: number
}
interface TForm { nickname: string; phone: string; title: string; intro: string; status: number }
const EMPTY: TForm = { nickname: '', phone: '', title: '讲师', intro: '', status: 1 }
const PAGE_SIZE = 10

export default function EduTeacherPage() {
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Teacher | null>(null)
  const [form, setForm] = React.useState<TForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => { setDebounced(search); setPage(1) }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'teacher', debounced, page],
    queryFn: () => eduApi<PageData<Teacher>>(`/api/admin/users${buildQs({ page, pageSize: PAGE_SIZE, search: debounced, role: 'teacher' })}`),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = { nickname: form.nickname.trim(), phone: form.phone.trim() || null, title: form.title, intro: form.intro.trim() || null, status: form.status }
      if (editing) return eduApi(`/api/admin/users/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
      return eduApi(`/api/admin/users`, { method: 'POST', body: JSON.stringify({ ...body, role: 'teacher' }) })
    },
    onSuccess: () => { toast.success(editing ? '更新成功' : '创建成功'); qc.invalidateQueries({ queryKey: ['edu', 'teacher'] }); closeDialog() },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('删除成功'); qc.invalidateQueries({ queryKey: ['edu', 'teacher'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() { setEditing(null); setForm(EMPTY); setErr(null); setOpen(true) }
  function openEdit(t: Teacher) { setEditing(t); setForm({ nickname: t.nickname, phone: t.phone ?? '', title: t.title, intro: t.intro ?? '', status: t.status }); setErr(null); setOpen(true) }
  function closeDialog() { if (saveMut.isPending) return; setOpen(false); setEditing(null); setErr(null) }
  function submit(e: React.FormEvent) { e.preventDefault(); setErr(null); if (!form.nickname.trim()) return setErr('昵称不能为空'); saveMut.mutate() }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold tracking-tight">讲师管理</h1><p className="mt-1 text-sm text-muted-foreground">管理讲师信息、课程与学生数</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm"><Link href="/admin/edu"><ChevronLeft className="h-4 w-4" />返回教育后台</Link></Button>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索讲师..." className="h-9 pl-8" />
        </div>
        <Button onClick={openCreate} size="sm" className="ml-auto"><Plus className="h-4 w-4" />新建讲师</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50"><TableRow>
            <TableHead className="px-4 py-2.5">昵称</TableHead><TableHead className="px-4 py-2.5">头衔</TableHead>
            <TableHead className="px-4 py-2.5">课程数</TableHead><TableHead className="px-4 py-2.5">学生数</TableHead>
            <TableHead className="px-4 py-2.5">评分</TableHead><TableHead className="px-4 py-2.5">状态</TableHead>
            <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
          </TableRow></TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (<TableRow><TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />加载中...</TableCell></TableRow>
            ) : error ? (<TableRow><TableCell colSpan={7} className="px-4 py-10 text-center text-destructive">{(error as Error).message}</TableCell></TableRow>
            ) : rows.length === 0 ? (<TableRow><TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground"><UserCog className="mx-auto mb-2 h-8 w-8 opacity-40" />暂无讲师</TableCell></TableRow>
            ) : rows.map((t) => (
              <TableRow key={t.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5"><div className="font-medium">{t.nickname}</div>{t.phone && <div className="text-xs text-muted-foreground">{t.phone}</div>}</TableCell>
                <TableCell className="px-4 py-2.5">{t.title}</TableCell>
                <TableCell className="px-4 py-2.5">{t.courseCount}</TableCell>
                <TableCell className="px-4 py-2.5">{t.studentCount}</TableCell>
                <TableCell className="px-4 py-2.5"><span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">★ {t.rating.toFixed(1)}</span></TableCell>
                <TableCell className="px-4 py-2.5"><span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', t.status === 1 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' : 'bg-muted text-muted-foreground')}>{t.status === 1 ? '在职' : '离职'}</span></TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(t)} title="编辑"><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => { if (window.confirm('确定删除？')) deleteMut.mutate(t.id) }} title="删除" className="text-destructive hover:text-destructive" disabled={deleteMut.isPending}><Trash2 className="h-4 w-4" /></Button>
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
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader><DialogTitle>{editing ? '编辑讲师' : '新建讲师'}</DialogTitle></DialogHeader>
            {err && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label htmlFor="t-nick">昵称</Label><Input id="t-nick" value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="t-phone">手机</Label><Input id="t-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="t-title">头衔</Label><Input id="t-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="t-intro">简介</Label><Input id="t-intro" value={form.intro} onChange={(e) => setForm({ ...form, intro: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="t-status">状态</Label>
              <Select value={String(form.status)} onValueChange={(v) => setForm({ ...form, status: Number(v) })}>
                <SelectTrigger className={selectClass} id="t-status"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="1">在职</SelectItem><SelectItem value="0">离职</SelectItem></SelectContent>
              </Select>
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={closeDialog} disabled={saveMut.isPending}>取消</Button><Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}保存</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
