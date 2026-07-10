'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Trash2, Loader2, ChevronLeft, UserPlus, Users } from 'lucide-react'
import { eduApi, buildQs, type PageData } from '@/lib/edu'
import { cn } from '@/lib/utils'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Label,
} from '@ihui/ui'

interface Member {
  id: string; userId: string; userName: string | null
  joinedAt: string; status: string; role: string
}
const PAGE_SIZE = 10

export default function EduClassMembersPage() {
  const qc = useQueryClient()
  const [classId, setClassId] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [userId, setUserId] = React.useState('')
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'class', 'members', classId, page],
    queryFn: () => eduApi<PageData<Member>>(`/api/admin/edu/classes/${classId}/members${buildQs({ page, pageSize: PAGE_SIZE })}`),
    enabled: !!classId,
    retry: false,
  })

  const addMut = useMutation({
    mutationFn: () => eduApi(`/api/admin/edu/classes/${classId}/members`, { method: 'POST', body: JSON.stringify({ userId: userId.trim() }) }),
    onSuccess: () => { toast.success('添加成功'); qc.invalidateQueries({ queryKey: ['edu', 'class', 'members', classId] }); closeDialog() },
    onError: (e: Error) => setErr(e.message),
  })
  const removeMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/edu/classes/${classId}/members/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('移除成功'); qc.invalidateQueries({ queryKey: ['edu', 'class', 'members', classId] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  function closeDialog() { if (addMut.isPending) return; setOpen(false); setUserId(''); setErr(null) }
  function submit(e: React.FormEvent) { e.preventDefault(); setErr(null); if (!userId.trim()) return setErr('用户ID不能为空'); addMut.mutate() }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []
  const noEndpoint = !!(error as Error) && (error as Error).message.includes('请求失败')

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold tracking-tight">班级成员</h1><p className="mt-1 text-sm text-muted-foreground">管理班级学员名单</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm"><Link href="/admin/edu/class"><ChevronLeft className="h-4 w-4" />返回班级管理</Link></Button>
        <div className="w-full max-w-xs">
          <Input value={classId} onChange={(e) => { setClassId(e.target.value); setPage(1) }} placeholder="输入班级ID..." className="h-9" />
        </div>
        {classId && <Button onClick={() => { setUserId(''); setErr(null); setOpen(true) }} size="sm" className="ml-auto"><UserPlus className="h-4 w-4" />添加成员</Button>}
      </div>
      {!classId ? (
        <div className="rounded-lg border px-4 py-10 text-center text-muted-foreground"><Users className="mx-auto mb-2 h-8 w-8 opacity-40" />请输入班级ID</div>
      ) : isLoading ? (
        <div className="rounded-lg border px-4 py-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />加载中...</div>
      ) : noEndpoint ? (
        <div className="rounded-lg border px-4 py-10 text-center text-muted-foreground"><Users className="mx-auto mb-2 h-8 w-8 opacity-40" />成员端点未配置</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border px-4 py-10 text-center text-muted-foreground"><Users className="mx-auto mb-2 h-8 w-8 opacity-40" />暂无成员</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/50"><TableRow>
              <TableHead className="px-4 py-2.5">学员</TableHead><TableHead className="px-4 py-2.5">角色</TableHead>
              <TableHead className="px-4 py-2.5">加入时间</TableHead><TableHead className="px-4 py-2.5">状态</TableHead>
              <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
            </TableRow></TableHeader>
            <TableBody className="divide-y">
              {rows.map((m) => (
                <TableRow key={m.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">{m.userName ?? m.userId.slice(0, 8)}</TableCell>
                  <TableCell className="px-4 py-2.5"><span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', m.role === 'teacher' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-sky-500/10 text-sky-600 dark:text-sky-400')}>{m.role === 'teacher' ? '讲师' : '学员'}</span></TableCell>
                  <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">{m.joinedAt}</TableCell>
                  <TableCell className="px-4 py-2.5"><span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', m.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' : 'bg-muted text-muted-foreground')}>{m.status === 'active' ? '在读' : '退出'}</span></TableCell>
                  <TableCell className="px-4 py-2.5 text-right"><Button variant="ghost" size="sm" onClick={() => { if (window.confirm('确定移除？')) removeMut.mutate(m.id) }} title="移除" className="text-destructive hover:text-destructive" disabled={removeMut.isPending}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {classId && rows.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">共 {total} 条</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>上一页</Button>
            <span className="text-sm text-muted-foreground">第 {page} / {totalPages} 页</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>下一页</Button>
          </div>
        </div>
      )}
      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader><DialogTitle>添加班级成员</DialogTitle></DialogHeader>
            {err && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
            <div className="space-y-2"><Label htmlFor="m-uid">用户ID</Label><Input id="m-uid" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="输入用户ID" /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={closeDialog} disabled={addMut.isPending}>取消</Button><Button type="submit" disabled={addMut.isPending}>{addMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}添加</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
