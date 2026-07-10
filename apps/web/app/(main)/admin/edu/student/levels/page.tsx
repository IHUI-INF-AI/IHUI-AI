'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, Loader2, ChevronLeft, Star } from 'lucide-react'
import { eduApi, type PageData } from '@/lib/edu'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Label,
} from '@ihui/ui'

interface Level {
  id: string; name: string; level: number
  minScore: number; maxScore: number; discount: number; sort: number
}
interface LForm { name: string; level: string; minScore: string; maxScore: string; discount: string }
const EMPTY: LForm = { name: '', level: '1', minScore: '0', maxScore: '100', discount: '1' }

export default function EduStudentLevelsPage() {
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Level | null>(null)
  const [form, setForm] = React.useState<LForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'student', 'levels'],
    queryFn: () => eduApi<PageData<Level>>(`/api/admin/member-levels`),
    retry: false,
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = { name: form.name.trim(), level: Number(form.level), minScore: Number(form.minScore), maxScore: Number(form.maxScore), discount: Number(form.discount) }
      if (editing) return eduApi(`/api/admin/member-levels/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
      return eduApi(`/api/admin/member-levels`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => { toast.success(editing ? '更新成功' : '创建成功'); qc.invalidateQueries({ queryKey: ['edu', 'student', 'levels'] }); closeDialog() },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/member-levels/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('删除成功'); qc.invalidateQueries({ queryKey: ['edu', 'student', 'levels'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() { setEditing(null); setForm(EMPTY); setErr(null); setOpen(true) }
  function openEdit(l: Level) { setEditing(l); setForm({ name: l.name, level: String(l.level), minScore: String(l.minScore), maxScore: String(l.maxScore), discount: String(l.discount) }); setErr(null); setOpen(true) }
  function closeDialog() { if (saveMut.isPending) return; setOpen(false); setEditing(null); setErr(null) }
  function submit(e: React.FormEvent) { e.preventDefault(); setErr(null); if (!form.name.trim()) return setErr('名称不能为空'); saveMut.mutate() }

  const rows = data?.list ?? []
  const noEndpoint = !!(error as Error) && (error as Error).message.includes('请求失败')

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold tracking-tight">学员等级</h1><p className="mt-1 text-sm text-muted-foreground">管理学员等级与折扣权益</p></div>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm"><Link href="/admin/edu/student"><ChevronLeft className="h-4 w-4" />返回学员管理</Link></Button>
        <Button onClick={openCreate} size="sm" className="ml-auto"><Plus className="h-4 w-4" />新建等级</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50"><TableRow>
            <TableHead className="px-4 py-2.5">等级</TableHead><TableHead className="px-4 py-2.5">名称</TableHead>
            <TableHead className="px-4 py-2.5">积分区间</TableHead><TableHead className="px-4 py-2.5">折扣</TableHead>
            <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
          </TableRow></TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (<TableRow><TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />加载中...</TableCell></TableRow>
            ) : noEndpoint ? (<TableRow><TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground"><Star className="mx-auto mb-2 h-8 w-8 opacity-40" />等级端点未配置</TableCell></TableRow>
            ) : rows.length === 0 ? (<TableRow><TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground"><Star className="mx-auto mb-2 h-8 w-8 opacity-40" />暂无等级</TableCell></TableRow>
            ) : rows.map((l) => (
              <TableRow key={l.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5"><span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/10 text-xs font-bold text-amber-600 dark:text-amber-400">L{l.level}</span></TableCell>
                <TableCell className="px-4 py-2.5 font-medium">{l.name}</TableCell>
                <TableCell className="px-4 py-2.5 text-xs">{l.minScore} ~ {l.maxScore}</TableCell>
                <TableCell className="px-4 py-2.5">{(l.discount * 10).toFixed(1)} 折</TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(l)} title="编辑"><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => { if (window.confirm('确定删除？')) deleteMut.mutate(l.id) }} title="删除" className="text-destructive hover:text-destructive" disabled={deleteMut.isPending}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader><DialogTitle>{editing ? '编辑等级' : '新建等级'}</DialogTitle></DialogHeader>
            {err && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
            <div className="space-y-2"><Label htmlFor="lv-name">名称</Label><Input id="lv-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label htmlFor="lv-level">等级序号</Label><Input id="lv-level" type="number" min="1" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="lv-discount">折扣（0-1）</Label><Input id="lv-discount" type="number" min="0" max="1" step="0.1" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label htmlFor="lv-min">最低积分</Label><Input id="lv-min" type="number" min="0" value={form.minScore} onChange={(e) => setForm({ ...form, minScore: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="lv-max">最高积分</Label><Input id="lv-max" type="number" min="0" value={form.maxScore} onChange={(e) => setForm({ ...form, maxScore: e.target.value })} /></div>
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={closeDialog} disabled={saveMut.isPending}>取消</Button><Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}保存</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
