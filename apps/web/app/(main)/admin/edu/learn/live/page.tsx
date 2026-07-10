'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, Loader2, ChevronLeft, Radio } from 'lucide-react'
import { eduApi, buildQs, selectClass, type PageData } from '@/lib/edu'
import { cn } from '@/lib/utils'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Label, Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from '@ihui/ui'

interface Live {
  id: string; title: string; lecturerName: string | null
  startTime: string; status: string; coverImage: string | null
}
interface LForm { title: string; lecturerName: string; startTime: string; status: string }
const EMPTY: LForm = { title: '', lecturerName: '', startTime: '', status: 'upcoming' }

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  upcoming: { label: '未开始', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  ongoing: { label: '直播中', cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  ended: { label: '已结束', cls: 'bg-muted text-muted-foreground' },
}

export default function EduLearnLivePage() {
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Live | null>(null)
  const [form, setForm] = React.useState<LForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'learn', 'live', page],
    queryFn: () => eduApi<PageData<Live>>(`/api/admin/live/channels${buildQs({ page, pageSize: 10 })}`),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = { ...form }
      if (editing) return eduApi(`/api/admin/live/channels/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
      return eduApi(`/api/admin/live/channels`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => { toast.success(editing ? '更新成功' : '创建成功'); qc.invalidateQueries({ queryKey: ['edu', 'learn', 'live'] }); closeDialog() },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/live/channels/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('删除成功'); qc.invalidateQueries({ queryKey: ['edu', 'learn', 'live'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() { setEditing(null); setForm(EMPTY); setErr(null); setOpen(true) }
  function openEdit(l: Live) { setEditing(l); setForm({ title: l.title, lecturerName: l.lecturerName ?? '', startTime: l.startTime, status: l.status }); setErr(null); setOpen(true) }
  function closeDialog() { if (saveMut.isPending) return; setOpen(false); setEditing(null); setErr(null) }
  function submit(e: React.FormEvent) { e.preventDefault(); setErr(null); if (!form.title.trim()) return setErr('标题不能为空'); saveMut.mutate() }

  const total = data?.total ?? 0
  const rows = data?.list ?? []

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold tracking-tight">直播学习</h1><p className="mt-1 text-sm text-muted-foreground">管理直播课程与排期</p></div>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm"><Link href="/admin/edu/learn"><ChevronLeft className="h-4 w-4" />返回学习管理</Link></Button>
        <Button onClick={openCreate} size="sm" className="ml-auto"><Plus className="h-4 w-4" />新建直播</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50"><TableRow>
            <TableHead className="px-4 py-2.5">标题</TableHead><TableHead className="px-4 py-2.5">讲师</TableHead>
            <TableHead className="px-4 py-2.5">开始时间</TableHead><TableHead className="px-4 py-2.5">状态</TableHead>
            <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
          </TableRow></TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (<TableRow><TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />加载中...</TableCell></TableRow>
            ) : error ? (<TableRow><TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground"><Radio className="mx-auto mb-2 h-8 w-8 opacity-40" />暂无直播（需直播端点）</TableCell></TableRow>
            ) : rows.length === 0 ? (<TableRow><TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground"><Radio className="mx-auto mb-2 h-8 w-8 opacity-40" />暂无直播</TableCell></TableRow>
            ) : rows.map((l) => {
              const st = STATUS_MAP[l.status] ?? { label: l.status, cls: 'bg-muted text-muted-foreground' }
              return (
                <TableRow key={l.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">{l.title}</TableCell>
                  <TableCell className="px-4 py-2.5">{l.lecturerName ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5 text-xs">{l.startTime}</TableCell>
                  <TableCell className="px-4 py-2.5"><span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', st.cls)}>{st.label}</span></TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(l)} title="编辑"><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => { if (window.confirm('确定删除？')) deleteMut.mutate(l.id) }} title="删除" className="text-destructive hover:text-destructive" disabled={deleteMut.isPending}><Trash2 className="h-4 w-4" /></Button>
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
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>上一页</Button>
          <Button variant="outline" size="sm" disabled={page >= Math.max(1, Math.ceil(total / 10))} onClick={() => setPage((p) => p + 1)}>下一页</Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader><DialogTitle>{editing ? '编辑直播' : '新建直播'}</DialogTitle></DialogHeader>
            {err && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
            <div className="space-y-2"><Label htmlFor="v-title">标题</Label><Input id="v-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label htmlFor="v-lec">讲师</Label><Input id="v-lec" value={form.lecturerName} onChange={(e) => setForm({ ...form, lecturerName: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="v-time">开始时间</Label><Input id="v-time" type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="v-status">状态</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className={selectClass} id="v-status"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="upcoming">未开始</SelectItem><SelectItem value="ongoing">直播中</SelectItem><SelectItem value="ended">已结束</SelectItem></SelectContent>
              </Select>
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={closeDialog} disabled={saveMut.isPending}>取消</Button><Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}保存</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
