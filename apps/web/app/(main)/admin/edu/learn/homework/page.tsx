'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, Loader2, ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react'
import { eduApi, buildQs, selectClass, textareaClass, type PageData } from '@/lib/edu'
import { cn } from '@/lib/utils'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Label, Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from '@ihui/ui'

interface Homework {
  id: string; title: string; description: string | null
  lessonTitle: string | null; dueDate: string | null; status: string
  submitCount: number
}
interface HForm { title: string; description: string; lessonId: string; dueDate: string; status: string }
const EMPTY: HForm = { title: '', description: '', lessonId: '', dueDate: '', status: 'active' }

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  active: { label: '进行中', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' },
  closed: { label: '已关闭', cls: 'bg-muted text-muted-foreground' },
  draft: { label: '草稿', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
}

const PAGE_SIZE = 10

export default function EduLearnHomeworkPage() {
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Homework | null>(null)
  const [form, setForm] = React.useState<HForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'learn', 'homework', page],
    queryFn: () => eduApi<PageData<Homework>>(`/api/admin/learn/homework${buildQs({ page, pageSize: PAGE_SIZE })}`),
    retry: false,
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title.trim(), description: form.description.trim() || null,
        lessonId: form.lessonId || null, dueDate: form.dueDate || null, status: form.status,
      }
      if (editing) return eduApi(`/api/admin/learn/homework/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
      return eduApi(`/api/admin/learn/homework`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => { toast.success(editing ? '更新成功' : '创建成功'); qc.invalidateQueries({ queryKey: ['edu', 'learn', 'homework'] }); closeDialog() },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/learn/homework/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('删除成功'); qc.invalidateQueries({ queryKey: ['edu', 'learn', 'homework'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() { setEditing(null); setForm(EMPTY); setErr(null); setOpen(true) }
  function openEdit(h: Homework) {
    setEditing(h)
    setForm({ title: h.title, description: h.description ?? '', lessonId: '', dueDate: h.dueDate ?? '', status: h.status })
    setErr(null); setOpen(true)
  }
  function closeDialog() { if (saveMut.isPending) return; setOpen(false); setEditing(null); setErr(null) }
  function submit(e: React.FormEvent) { e.preventDefault(); setErr(null); if (!form.title.trim()) return setErr('标题不能为空'); saveMut.mutate() }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []
  const noEndpoint = !!(error as Error) && (error as Error).message.includes('请求失败')

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold tracking-tight">作业学习</h1><p className="mt-1 text-sm text-muted-foreground">管理课程作业与提交情况</p></div>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm"><Link href="/admin/edu/learn"><ChevronLeft className="h-4 w-4" />返回学习管理</Link></Button>
        <Button onClick={openCreate} size="sm" className="ml-auto"><Plus className="h-4 w-4" />新建作业</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50"><TableRow>
            <TableHead className="px-4 py-2.5">标题</TableHead><TableHead className="px-4 py-2.5">课程</TableHead>
            <TableHead className="px-4 py-2.5">截止时间</TableHead><TableHead className="px-4 py-2.5">提交数</TableHead>
            <TableHead className="px-4 py-2.5">状态</TableHead><TableHead className="px-4 py-2.5 text-right">操作</TableHead>
          </TableRow></TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (<TableRow><TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />加载中...</TableCell></TableRow>
            ) : noEndpoint ? (<TableRow><TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground"><ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-40" />作业端点未配置</TableCell></TableRow>
            ) : rows.length === 0 ? (<TableRow><TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground"><ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-40" />暂无作业</TableCell></TableRow>
            ) : rows.map((h) => {
              const st = STATUS_MAP[h.status] ?? { label: h.status, cls: 'bg-muted text-muted-foreground' }
              return (
                <TableRow key={h.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">{h.title}</TableCell>
                  <TableCell className="px-4 py-2.5">{h.lessonTitle ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5 text-xs">{h.dueDate ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{h.submitCount}</TableCell>
                  <TableCell className="px-4 py-2.5"><span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', st.cls)}>{st.label}</span></TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(h)} title="编辑"><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => { if (window.confirm('确定删除？')) deleteMut.mutate(h.id) }} title="删除" className="text-destructive hover:text-destructive" disabled={deleteMut.isPending}><Trash2 className="h-4 w-4" /></Button>
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
        <DialogContent className="max-w-xl">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader><DialogTitle>{editing ? '编辑作业' : '新建作业'}</DialogTitle></DialogHeader>
            {err && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
            <div className="space-y-2"><Label htmlFor="h-title">标题</Label><Input id="h-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="h-desc">描述</Label><textarea id="h-desc" className={textareaClass} rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label htmlFor="h-due">截止时间</Label><Input id="h-due" type="datetime-local" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="h-status">状态</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className={selectClass} id="h-status"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="active">进行中</SelectItem><SelectItem value="closed">已关闭</SelectItem><SelectItem value="draft">草稿</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={closeDialog} disabled={saveMut.isPending}>取消</Button><Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}保存</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
