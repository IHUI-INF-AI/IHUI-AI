'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, Loader2, ChevronLeft, ChevronRight, FileStack, Play } from 'lucide-react'
import { eduApi, buildQs, type PageData } from '@/lib/edu'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Label,
} from '@ihui/ui'

interface Recorded {
  id: string; title: string; intro: string | null
  videoUrl: string | null; duration: number; lecturerName: string | null
  viewCount: number; isPublished: boolean
}
interface RForm { title: string; intro: string; videoUrl: string; duration: string; lecturerName: string }
const EMPTY: RForm = { title: '', intro: '', videoUrl: '', duration: '0', lecturerName: '' }

const PAGE_SIZE = 10

export default function EduLearnRecordedPage() {
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Recorded | null>(null)
  const [form, setForm] = React.useState<RForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'learn', 'recorded', page],
    queryFn: () => eduApi<PageData<Recorded>>(`/api/admin/learn/recorded${buildQs({ page, pageSize: PAGE_SIZE })}`),
    retry: false,
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title.trim(), intro: form.intro.trim() || null,
        videoUrl: form.videoUrl.trim() || null, duration: Number(form.duration) || 0,
        lecturerName: form.lecturerName.trim() || null,
      }
      if (editing) return eduApi(`/api/admin/learn/recorded/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
      return eduApi(`/api/admin/learn/recorded`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => { toast.success(editing ? '更新成功' : '创建成功'); qc.invalidateQueries({ queryKey: ['edu', 'learn', 'recorded'] }); closeDialog() },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/learn/recorded/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('删除成功'); qc.invalidateQueries({ queryKey: ['edu', 'learn', 'recorded'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() { setEditing(null); setForm(EMPTY); setErr(null); setOpen(true) }
  function openEdit(r: Recorded) {
    setEditing(r)
    setForm({ title: r.title, intro: r.intro ?? '', videoUrl: r.videoUrl ?? '', duration: String(r.duration), lecturerName: r.lecturerName ?? '' })
    setErr(null); setOpen(true)
  }
  function closeDialog() { if (saveMut.isPending) return; setOpen(false); setEditing(null); setErr(null) }
  function submit(e: React.FormEvent) { e.preventDefault(); setErr(null); if (!form.title.trim()) return setErr('标题不能为空'); saveMut.mutate() }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []
  const noEndpoint = !!(error as Error & { message?: string }) && (error as Error).message.includes('请求失败')

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold tracking-tight">录播学习</h1><p className="mt-1 text-sm text-muted-foreground">管理录播课程视频与播放</p></div>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm"><Link href="/admin/edu/learn"><ChevronLeft className="h-4 w-4" />返回学习管理</Link></Button>
        <Button onClick={openCreate} size="sm" className="ml-auto"><Plus className="h-4 w-4" />新建录播</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50"><TableRow>
            <TableHead className="px-4 py-2.5">标题</TableHead><TableHead className="px-4 py-2.5">讲师</TableHead>
            <TableHead className="px-4 py-2.5">时长</TableHead><TableHead className="px-4 py-2.5">播放</TableHead>
            <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
          </TableRow></TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (<TableRow><TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />加载中...</TableCell></TableRow>
            ) : noEndpoint ? (<TableRow><TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground"><FileStack className="mx-auto mb-2 h-8 w-8 opacity-40" />录播端点未配置，请补充后端端点</TableCell></TableRow>
            ) : rows.length === 0 ? (<TableRow><TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground"><FileStack className="mx-auto mb-2 h-8 w-8 opacity-40" />暂无录播</TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5"><div className="flex items-center gap-2"><Play className="h-3.5 w-3.5 text-primary" /><span className="font-medium">{r.title}</span></div></TableCell>
                <TableCell className="px-4 py-2.5">{r.lecturerName ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5">{r.duration} 分钟</TableCell>
                <TableCell className="px-4 py-2.5">{r.viewCount}</TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(r)} title="编辑"><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => { if (window.confirm('确定删除？')) deleteMut.mutate(r.id) }} title="删除" className="text-destructive hover:text-destructive" disabled={deleteMut.isPending}><Trash2 className="h-4 w-4" /></Button>
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
            <DialogHeader><DialogTitle>{editing ? '编辑录播' : '新建录播'}</DialogTitle></DialogHeader>
            {err && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
            <div className="space-y-2"><Label htmlFor="r-title">标题</Label><Input id="r-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="r-intro">简介</Label><Input id="r-intro" value={form.intro} onChange={(e) => setForm({ ...form, intro: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label htmlFor="r-lec">讲师</Label><Input id="r-lec" value={form.lecturerName} onChange={(e) => setForm({ ...form, lecturerName: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="r-dur">时长（分钟）</Label><Input id="r-dur" type="number" min="0" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="r-url">视频地址</Label><Input id="r-url" value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} placeholder="https://..." /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={closeDialog} disabled={saveMut.isPending}>取消</Button><Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}保存</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
