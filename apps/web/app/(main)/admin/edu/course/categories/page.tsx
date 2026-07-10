'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, Loader2, ChevronLeft, FolderTree } from 'lucide-react'
import { eduApi } from '@/lib/edu'
import { cn } from '@/lib/utils'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Label, Switch,
} from '@ihui/ui'

interface Category { id: string; name: string; sort: number; status: number }
interface CForm { name: string; sort: string; status: boolean }
const EMPTY: CForm = { name: '', sort: '0', status: true }

export default function EduCourseCategoriesPage() {
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Category | null>(null)
  const [form, setForm] = React.useState<CForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'course', 'categories', 'all'],
    queryFn: () => eduApi<{ list: Category[] }>(`/api/admin/learn/categories`).then((d) => d.list ?? []),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = { name: form.name.trim(), sort: Number(form.sort) || 0, status: form.status ? 1 : 0 }
      if (editing) return eduApi(`/api/admin/learn/categories/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
      return eduApi(`/api/admin/learn/categories`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => { toast.success(editing ? '更新成功' : '创建成功'); qc.invalidateQueries({ queryKey: ['edu', 'course', 'categories'] }); closeDialog() },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/learn/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('删除成功'); qc.invalidateQueries({ queryKey: ['edu', 'course', 'categories'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() { setEditing(null); setForm(EMPTY); setErr(null); setOpen(true) }
  function openEdit(c: Category) { setEditing(c); setForm({ name: c.name, sort: String(c.sort), status: c.status === 1 }); setErr(null); setOpen(true) }
  function closeDialog() { if (saveMut.isPending) return; setOpen(false); setEditing(null); setErr(null) }
  function submit(e: React.FormEvent) { e.preventDefault(); setErr(null); if (!form.name.trim()) return setErr('名称不能为空'); saveMut.mutate() }

  const rows = data ?? []

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold tracking-tight">课程分类</h1><p className="mt-1 text-sm text-muted-foreground">管理课程分类树</p></div>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm"><Link href="/admin/edu/course"><ChevronLeft className="h-4 w-4" />返回课程管理</Link></Button>
        <Button onClick={openCreate} size="sm" className="ml-auto"><Plus className="h-4 w-4" />新建分类</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50"><TableRow>
            <TableHead className="px-4 py-2.5">名称</TableHead><TableHead className="px-4 py-2.5">排序</TableHead>
            <TableHead className="px-4 py-2.5">状态</TableHead><TableHead className="px-4 py-2.5 text-right">操作</TableHead>
          </TableRow></TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (<TableRow><TableCell colSpan={4} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />加载中...</TableCell></TableRow>
            ) : error ? (<TableRow><TableCell colSpan={4} className="px-4 py-10 text-center text-destructive">{(error as Error).message}</TableCell></TableRow>
            ) : rows.length === 0 ? (<TableRow><TableCell colSpan={4} className="px-4 py-10 text-center text-muted-foreground"><FolderTree className="mx-auto mb-2 h-8 w-8 opacity-40" />暂无分类</TableCell></TableRow>
            ) : rows.map((c) => {
              const enabled = c.status === 1
              return (
                <TableRow key={c.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">{c.name}</TableCell>
                  <TableCell className="px-4 py-2.5">{c.sort}</TableCell>
                  <TableCell className="px-4 py-2.5"><span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', enabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' : 'bg-muted text-muted-foreground')}><span className={cn('h-1.5 w-1.5 rounded-full', enabled ? 'bg-emerald-500' : 'bg-muted-foreground')} />{enabled ? '启用' : '禁用'}</span></TableCell>
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
      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader><DialogTitle>{editing ? '编辑分类' : '新建分类'}</DialogTitle></DialogHeader>
            {err && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
            <div className="space-y-2"><Label htmlFor="cat-name">名称</Label><Input id="cat-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label htmlFor="cat-sort">排序</Label><Input id="cat-sort" type="number" min="0" value={form.sort} onChange={(e) => setForm({ ...form, sort: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="cat-status">状态</Label><div className="flex h-9 items-center gap-2"><Switch id="cat-status" checked={form.status} onCheckedChange={(v) => setForm({ ...form, status: v })} /><span className="text-sm text-muted-foreground">{form.status ? '启用' : '禁用'}</span></div></div>
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={closeDialog} disabled={saveMut.isPending}>取消</Button><Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}保存</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
