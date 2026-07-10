'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, Loader2, ChevronLeft, LayoutTemplate } from 'lucide-react'
import { eduApi, buildQs, textareaClass } from '@/lib/edu'
import { cn } from '@/lib/utils'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Label,
} from '@ihui/ui'

interface Template {
  id: string
  name: string
  description: string | null
  config: unknown
  createdAt: string
}
interface PageData<T> { list: T[]; total: number }

interface TForm { name: string; description: string; config: string }
const EMPTY: TForm = { name: '', description: '', config: '{\n  "single": 5,\n  "multi": 3,\n  "scorePerQuestion": 5\n}' }

export default function EduExamPapersTemplatePage() {
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Template | null>(null)
  const [form, setForm] = React.useState<TForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'exam', 'templates', page],
    queryFn: () => eduApi<PageData<Template>>(`/api/admin/edu/exam/templates${buildQs({ page, pageSize: 10 })}`),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      let config: unknown = {}
      try { config = JSON.parse(form.config) } catch (e) { return Promise.reject(new Error(`配置JSON错误：${(e as Error).message}`)) }
      const body = { name: form.name.trim(), description: form.description.trim() || null, config }
      if (editing) return eduApi(`/api/admin/edu/exam/templates/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
      return eduApi(`/api/admin/edu/exam/templates`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => { toast.success(editing ? '更新成功' : '创建成功'); qc.invalidateQueries({ queryKey: ['edu', 'exam', 'templates'] }); closeDialog() },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/edu/exam/templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('删除成功'); qc.invalidateQueries({ queryKey: ['edu', 'exam', 'templates'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() { setEditing(null); setForm(EMPTY); setErr(null); setOpen(true) }
  function openEdit(t: Template) { setEditing(t); setForm({ name: t.name, description: t.description ?? '', config: t.config ? JSON.stringify(t.config, null, 2) : EMPTY.config }); setErr(null); setOpen(true) }
  function closeDialog() { if (saveMut.isPending) return; setOpen(false); setEditing(null); setErr(null) }
  function submit(e: React.FormEvent) { e.preventDefault(); setErr(null); if (!form.name.trim()) return setErr('名称不能为空'); saveMut.mutate() }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / 10))
  const rows = data?.list ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">模板组卷</h1>
        <p className="mt-1 text-sm text-muted-foreground">维护组卷模板，可快速复用生成试卷</p>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm"><Link href="/admin/edu/exam"><ChevronLeft className="h-4 w-4" />返回考试管理</Link></Button>
        <Button onClick={openCreate} size="sm" className="ml-auto"><Plus className="h-4 w-4" />新建模板</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">名称</TableHead>
              <TableHead className="px-4 py-2.5">描述</TableHead>
              <TableHead className="px-4 py-2.5">创建时间</TableHead>
              <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />加载中...</TableCell></TableRow>
            ) : error ? (
              <TableRow><TableCell colSpan={4} className="px-4 py-10 text-center text-muted-foreground"><LayoutTemplate className="mx-auto mb-2 h-8 w-8 opacity-40" />暂无模板（需后端端点）</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="px-4 py-10 text-center text-muted-foreground"><LayoutTemplate className="mx-auto mb-2 h-8 w-8 opacity-40" />暂无模板</TableCell></TableRow>
            ) : (
              rows.map((t) => (
                <TableRow key={t.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">{t.name}</TableCell>
                  <TableCell className="max-w-xs truncate px-4 py-2.5 text-muted-foreground">{t.description ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5 text-xs">{t.createdAt}</TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(t)} title="编辑"><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => { if (window.confirm('确定删除？')) deleteMut.mutate(t.id) }} title="删除" className="text-destructive hover:text-destructive" disabled={deleteMut.isPending}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>上一页</Button>
          <span className="text-sm text-muted-foreground">第 {page} / {totalPages} 页</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>下一页</Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-w-xl">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader><DialogTitle>{editing ? '编辑模板' : '新建模板'}</DialogTitle></DialogHeader>
            {err && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
            <div className="space-y-2"><Label htmlFor="t-name">名称</Label><Input id="t-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="t-desc">描述</Label><Input id="t-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="t-config">配置 (JSON)</Label><textarea id="t-config" value={form.config} onChange={(e) => setForm({ ...form, config: e.target.value })} rows={6} className={cn(textareaClass)} /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={closeDialog} disabled={saveMut.isPending}>取消</Button><Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}保存</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
