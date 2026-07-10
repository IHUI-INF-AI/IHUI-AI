'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, Loader2, ChevronLeft, ChevronRight, Users, Search } from 'lucide-react'
import { eduApi, buildQs, selectClass, type PageData } from '@/lib/edu'
import { cn } from '@/lib/utils'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Label, Select, SelectTrigger, SelectContent, SelectItem, SelectValue, Card, CardContent,
} from '@ihui/ui'

interface ClassGroup {
  id: string; name: string; courseId: string | null; courseName: string | null
  teacherName: string | null; studentCount: number
  startDate: string; endDate: string; status: string
}
interface CForm { name: string; courseId: string; teacherName: string; startDate: string; endDate: string; status: string }
const EMPTY: CForm = { name: '', courseId: '', teacherName: '', startDate: '', endDate: '', status: 'active' }

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  active: { label: '进行中', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' },
  pending: { label: '未开始', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  ended: { label: '已结束', cls: 'bg-muted text-muted-foreground' },
}
const PAGE_SIZE = 10

export default function EduClassPage() {
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ClassGroup | null>(null)
  const [form, setForm] = React.useState<CForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => { const tm = setTimeout(() => { setDebounced(search); setPage(1) }, 300); return () => clearTimeout(tm) }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'class', debounced, page],
    queryFn: () => eduApi<PageData<ClassGroup>>(`/api/admin/edu/classes${buildQs({ page, pageSize: PAGE_SIZE, search: debounced })}`),
    retry: false,
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = { name: form.name.trim(), courseId: form.courseId || null, teacherName: form.teacherName.trim() || null, startDate: form.startDate, endDate: form.endDate, status: form.status }
      if (editing) return eduApi(`/api/admin/edu/classes/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
      return eduApi(`/api/admin/edu/classes`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => { toast.success(editing ? '更新成功' : '创建成功'); qc.invalidateQueries({ queryKey: ['edu', 'class'] }); closeDialog() },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/edu/classes/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('删除成功'); qc.invalidateQueries({ queryKey: ['edu', 'class'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() { setEditing(null); setForm(EMPTY); setErr(null); setOpen(true) }
  function openEdit(c: ClassGroup) { setEditing(c); setForm({ name: c.name, courseId: c.courseId ?? '', teacherName: c.teacherName ?? '', startDate: c.startDate, endDate: c.endDate, status: c.status }); setErr(null); setOpen(true) }
  function closeDialog() { if (saveMut.isPending) return; setOpen(false); setEditing(null); setErr(null) }
  function submit(e: React.FormEvent) { e.preventDefault(); setErr(null); if (!form.name.trim()) return setErr('班级名称不能为空'); saveMut.mutate() }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []
  const noEndpoint = !!(error as Error) && (error as Error).message.includes('请求失败')

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold tracking-tight">班级管理</h1><p className="mt-1 text-sm text-muted-foreground">管理班级、学员与排课</p></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">班级总数</div><div className="mt-1 text-2xl font-semibold">{total}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">进行中</div><div className="mt-1 text-2xl font-semibold">{rows.filter((c) => c.status === 'active').length}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">当前页学员</div><div className="mt-1 text-2xl font-semibold">{rows.reduce((a, c) => a + c.studentCount, 0)}</div></CardContent></Card>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm"><Link href="/admin/edu"><ChevronLeft className="h-4 w-4" />返回教育后台</Link></Button>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索班级..." className="h-9 pl-8" />
        </div>
        <Button onClick={openCreate} size="sm" className="ml-auto"><Plus className="h-4 w-4" />新建班级</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50"><TableRow>
            <TableHead className="px-4 py-2.5">班级</TableHead><TableHead className="px-4 py-2.5">课程</TableHead>
            <TableHead className="px-4 py-2.5">讲师</TableHead><TableHead className="px-4 py-2.5">学员数</TableHead>
            <TableHead className="px-4 py-2.5">周期</TableHead><TableHead className="px-4 py-2.5">状态</TableHead>
            <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
          </TableRow></TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (<TableRow><TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />加载中...</TableCell></TableRow>
            ) : noEndpoint ? (<TableRow><TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground"><Users className="mx-auto mb-2 h-8 w-8 opacity-40" />班级端点未配置</TableCell></TableRow>
            ) : rows.length === 0 ? (<TableRow><TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground"><Users className="mx-auto mb-2 h-8 w-8 opacity-40" />暂无班级</TableCell></TableRow>
            ) : rows.map((c) => {
              const st = STATUS_MAP[c.status] ?? { label: c.status, cls: 'bg-muted text-muted-foreground' }
              return (
                <TableRow key={c.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">{c.name}</TableCell>
                  <TableCell className="px-4 py-2.5">{c.courseName ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{c.teacherName ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{c.studentCount}</TableCell>
                  <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">{c.startDate} ~ {c.endDate}</TableCell>
                  <TableCell className="px-4 py-2.5"><span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', st.cls)}>{st.label}</span></TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(c)} title="编辑"><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => { if (window.confirm('确定删除？')) deleteMut.mutate(c.id) }} title="删除" className="text-destructive hover:text-destructive" disabled={deleteMut.isPending}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
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
            <DialogHeader><DialogTitle>{editing ? '编辑班级' : '新建班级'}</DialogTitle></DialogHeader>
            {err && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
            <div className="space-y-2"><Label htmlFor="cls-name">班级名称</Label><Input id="cls-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label htmlFor="cls-course">课程ID</Label><Input id="cls-course" value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })} placeholder="可选" /></div>
              <div className="space-y-2"><Label htmlFor="cls-teacher">讲师</Label><Input id="cls-teacher" value={form.teacherName} onChange={(e) => setForm({ ...form, teacherName: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label htmlFor="cls-start">开始日期</Label><Input id="cls-start" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="cls-end">结束日期</Label><Input id="cls-end" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="cls-status">状态</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className={selectClass} id="cls-status"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="active">进行中</SelectItem><SelectItem value="pending">未开始</SelectItem><SelectItem value="ended">已结束</SelectItem></SelectContent>
              </Select>
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={closeDialog} disabled={saveMut.isPending}>取消</Button><Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}保存</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
