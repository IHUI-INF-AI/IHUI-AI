'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, Loader2, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { eduApi, buildQs, selectClass, type PageData } from '@/lib/edu'
import { cn } from '@/lib/utils'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Label, Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from '@ihui/ui'

interface Plan {
  id: string; userId: string; userName: string | null
  title: string; startDate: string; endDate: string
  targetHours: number; status: string
}
interface PForm { title: string; userId: string; startDate: string; endDate: string; targetHours: string; status: string }
const EMPTY: PForm = { title: '', userId: '', startDate: '', endDate: '', targetHours: '10', status: 'active' }

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  active: { label: '进行中', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' },
  completed: { label: '已完成', cls: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  expired: { label: '已过期', cls: 'bg-muted text-muted-foreground' },
}

const PAGE_SIZE = 10

export default function EduLearnPlanPage() {
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Plan | null>(null)
  const [form, setForm] = React.useState<PForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'learn', 'plan', page],
    queryFn: () => eduApi<PageData<Plan>>(`/api/admin/learn/plans${buildQs({ page, pageSize: PAGE_SIZE })}`),
    retry: false,
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title.trim(), userId: form.userId || undefined,
        startDate: form.startDate, endDate: form.endDate,
        targetHours: Number(form.targetHours) || 0, status: form.status,
      }
      if (editing) return eduApi(`/api/admin/learn/plans/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
      return eduApi(`/api/admin/learn/plans`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => { toast.success(editing ? '更新成功' : '创建成功'); qc.invalidateQueries({ queryKey: ['edu', 'learn', 'plan'] }); closeDialog() },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/learn/plans/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('删除成功'); qc.invalidateQueries({ queryKey: ['edu', 'learn', 'plan'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() { setEditing(null); setForm(EMPTY); setErr(null); setOpen(true) }
  function openEdit(p: Plan) {
    setEditing(p)
    setForm({ title: p.title, userId: p.userId, startDate: p.startDate, endDate: p.endDate, targetHours: String(p.targetHours), status: p.status })
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
      <div><h1 className="text-2xl font-bold tracking-tight">学习计划</h1><p className="mt-1 text-sm text-muted-foreground">管理学员学习计划与目标</p></div>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm"><Link href="/admin/edu/learn"><ChevronLeft className="h-4 w-4" />返回学习管理</Link></Button>
        <Button onClick={openCreate} size="sm" className="ml-auto"><Plus className="h-4 w-4" />新建计划</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50"><TableRow>
            <TableHead className="px-4 py-2.5">标题</TableHead><TableHead className="px-4 py-2.5">学员</TableHead>
            <TableHead className="px-4 py-2.5">周期</TableHead><TableHead className="px-4 py-2.5">目标时长</TableHead>
            <TableHead className="px-4 py-2.5">状态</TableHead><TableHead className="px-4 py-2.5 text-right">操作</TableHead>
          </TableRow></TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (<TableRow><TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />加载中...</TableCell></TableRow>
            ) : noEndpoint ? (<TableRow><TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground"><CalendarDays className="mx-auto mb-2 h-8 w-8 opacity-40" />计划端点未配置</TableCell></TableRow>
            ) : rows.length === 0 ? (<TableRow><TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground"><CalendarDays className="mx-auto mb-2 h-8 w-8 opacity-40" />暂无计划</TableCell></TableRow>
            ) : rows.map((p) => {
              const st = STATUS_MAP[p.status] ?? { label: p.status, cls: 'bg-muted text-muted-foreground' }
              return (
                <TableRow key={p.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">{p.title}</TableCell>
                  <TableCell className="px-4 py-2.5">{p.userName ?? p.userId.slice(0, 8)}</TableCell>
                  <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">{p.startDate} ~ {p.endDate}</TableCell>
                  <TableCell className="px-4 py-2.5">{p.targetHours} 小时</TableCell>
                  <TableCell className="px-4 py-2.5"><span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', st.cls)}>{st.label}</span></TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(p)} title="编辑"><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => { if (window.confirm('确定删除？')) deleteMut.mutate(p.id) }} title="删除" className="text-destructive hover:text-destructive" disabled={deleteMut.isPending}><Trash2 className="h-4 w-4" /></Button>
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
            <DialogHeader><DialogTitle>{editing ? '编辑计划' : '新建计划'}</DialogTitle></DialogHeader>
            {err && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
            <div className="space-y-2"><Label htmlFor="p-title">标题</Label><Input id="p-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label htmlFor="p-start">开始日期</Label><Input id="p-start" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="p-end">结束日期</Label><Input id="p-end" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label htmlFor="p-hours">目标时长（小时）</Label><Input id="p-hours" type="number" min="0" value={form.targetHours} onChange={(e) => setForm({ ...form, targetHours: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="p-status">状态</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className={selectClass} id="p-status"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="active">进行中</SelectItem><SelectItem value="completed">已完成</SelectItem><SelectItem value="expired">已过期</SelectItem></SelectContent>
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
