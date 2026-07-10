'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Pencil, Trash2, Shield } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@ihui/ui'

interface Role {
  id: string
  name: string
  displayName: string
  description: string | null
  memberCount: number
  isSystem: boolean
  createdAt: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const EMPTY = { name: '', displayName: '', description: '' }

export default function AdminMemberRolesPage() {
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Role | null>(null)
  const [form, setForm] = React.useState(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['admin', 'member', 'roles'],
    queryFn: () => api<{ list: Role[] }>('/api/admin/member/roles').then((d) => d.list ?? []),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = { name: form.name.trim(), displayName: form.displayName.trim(), description: form.description }
      return editing
        ? api(`/api/admin/member/roles/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : api('/api/admin/member/roles', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'member', 'roles'] }); setOpen(false) },
    onError: (e: Error) => setErr(e.message),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/member/roles/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'member', 'roles'] }),
  })

  const openCreate = () => { setEditing(null); setForm(EMPTY); setErr(null); setOpen(true) }
  const openEdit = (r: Role) => { setEditing(r); setForm({ name: r.name, displayName: r.displayName, description: r.description ?? '' }); setErr(null); setOpen(true) }
  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setErr(null)
    if (!form.name.trim()) { setErr('请输入角色标识'); return }
    saveMut.mutate()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Shield className="h-6 w-6 text-primary" />
            会员角色
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">管理会员角色体系</p>
        </div>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />新建角色</Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs uppercase">角色</TableHead>
              <TableHead className="text-xs uppercase">描述</TableHead>
              <TableHead className="text-xs uppercase">成员数</TableHead>
              <TableHead className="text-xs uppercase">类型</TableHead>
              <TableHead className="text-xs uppercase">创建时间</TableHead>
              <TableHead className="text-right text-xs uppercase">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /></TableCell></TableRow>
            ) : list.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">暂无角色</TableCell></TableRow>
            ) : (
              list.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.displayName}</div>
                    <div className="text-xs text-muted-foreground">{r.name}</div>
                  </TableCell>
                  <TableCell className="max-w-[240px] truncate text-muted-foreground">{r.description || '-'}</TableCell>
                  <TableCell>
                    <span className="inline-flex rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">{r.memberCount}</span>
                  </TableCell>
                  <TableCell>
                    {r.isSystem ? (
                      <span className="inline-flex rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-600">内置</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">自定义</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" disabled={r.isSystem} onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" />编辑</Button>
                      <Button size="sm" variant="ghost" disabled={r.isSystem} onClick={() => { if (confirm('确认删除？')) delMut.mutate(r.id) }}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={(o) => (o ? null : (setOpen(false), setErr(null)))}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? '编辑角色' : '新建角色'}</DialogTitle>
              <DialogDescription>配置会员角色</DialogDescription>
            </DialogHeader>
            {err && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
            <div className="space-y-2">
              <Label htmlFor="mr-name">角色标识</Label>
              <Input id="mr-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如：vip_member" disabled={!!editing} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mr-display">显示名称</Label>
              <Input id="mr-display" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mr-desc">描述</Label>
              <Input id="mr-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saveMut.isPending}>取消</Button>
              <Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}保存</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
