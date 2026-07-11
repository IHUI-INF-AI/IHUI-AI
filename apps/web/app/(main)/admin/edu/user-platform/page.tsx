'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Plus,
  Edit,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Download,
  Users,
} from 'lucide-react'
import { eduApi, buildQs, selectClass, type PageData } from '@/lib/edu'
import { cn } from '@/lib/utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { exportFromApi } from '@/lib/export-utils'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'

interface UserPlatform {
  id: string
  userUuid: string
  platformId: string
  identityId: string
  status: number
  isDel: number
  field1?: string
  createdAt: string
  updator?: string
}
interface CForm {
  userUuid: string
  platformId: string
  identityId: string
  status: string
  isDel: string
  field1: string
}
const EMPTY: CForm = {
  userUuid: '',
  platformId: '',
  identityId: '',
  status: '0',
  isDel: '0',
  field1: '',
}
const PAGE_SIZE = 10
const PERM = 'course:userPlatform:'
const fmt = (s?: string | null) =>
  s
    ? new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(s))
    : '-'

export default function EduUserPlatformPage() {
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [q, setQ] = React.useState({ userUuid: '', platformId: '', identityId: '', status: '' })
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<UserPlatform | null>(null)
  const [form, setForm] = React.useState<CForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const params = { page, pageSize: PAGE_SIZE, ...q }
  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'user-platform', params],
    queryFn: () => eduApi<PageData<UserPlatform>>(`/api/admin/user-platform${buildQs(params)}`),
  })
  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        userUuid: form.userUuid,
        platformId: form.platformId,
        identityId: form.identityId,
        status: Number(form.status),
        isDel: Number(form.isDel),
        field1: form.field1 || undefined,
      }
      return editing
        ? eduApi(`/api/admin/user-platform/${editing.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : eduApi(`/api/admin/user-platform`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '创建成功')
      qc.invalidateQueries({ queryKey: ['edu', 'user-platform'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/user-platform/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['edu', 'user-platform'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(r: UserPlatform) {
    setEditing(r)
    setForm({
      userUuid: r.userUuid,
      platformId: r.platformId,
      identityId: r.identityId,
      status: String(r.status),
      isDel: String(r.isDel),
      field1: r.field1 ?? '',
    })
    setErr(null)
    setOpen(true)
  }
  function closeDialog() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
    setErr(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.userUuid.trim()) return setErr('用户UUID不能为空')
    if (!form.platformId.trim()) return setErr('平台ID不能为空')
    saveMut.mutate()
  }
  function handleExport() {
    exportFromApi(
      `/api/admin/user-platform${buildQs({ ...q, pageSize: 10000 })}`,
      `userPlatform_${Date.now()}`,
      [
        { key: 'id', title: 'ID' },
        { key: 'userUuid', title: '用户UUID' },
        { key: 'platformId', title: '平台ID' },
        { key: 'identityId', title: '身份ID' },
        { key: 'status', title: '状态' },
        { key: 'isDel', title: '是否删除' },
        { key: 'createdAt', title: '注册时间' },
        { key: 'updator', title: '更新人' },
      ],
    ).then((ok) => toast[ok ? 'success' : 'error'](ok ? '导出成功' : '导出失败'))
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []
  const set = (k: keyof typeof q, v: string) => {
    setQ({ ...q, [k]: v })
    setPage(1)
  }
  const inputCls = 'h-9 w-40'

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">用户平台关系</h1>
        <p className="mt-1 text-sm text-muted-foreground">用户与教育平台的绑定关系</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="用户UUID"
          value={q.userUuid}
          onChange={(e) => set('userUuid', e.target.value)}
          className={inputCls}
        />
        <Input
          placeholder="平台ID"
          value={q.platformId}
          onChange={(e) => set('platformId', e.target.value)}
          className={inputCls}
        />
        <Input
          placeholder="身份ID"
          value={q.identityId}
          onChange={(e) => set('identityId', e.target.value)}
          className={inputCls}
        />
        <Select
          value={q.status || 'all'}
          onValueChange={(v) => set('status', v === 'all' ? '' : v)}
        >
          <SelectTrigger className={cn(selectClass, 'w-32')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="0">正常</SelectItem>
            <SelectItem value="1">禁用</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setQ({ userUuid: '', platformId: '', identityId: '', status: '' })
            setPage(1)
          }}
        >
          重置
        </Button>
        <div className="ml-auto flex gap-2">
          <HasPermi code={`${PERM}add`}>
            <Button onClick={openCreate} size="sm">
              <Plus className="h-4 w-4" />
              新建
            </Button>
          </HasPermi>
          <HasPermi code={`${PERM}export`}>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" />
              导出
            </Button>
          </HasPermi>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">ID</TableHead>
              <TableHead className="px-4 py-2.5">用户UUID</TableHead>
              <TableHead className="px-4 py-2.5">平台ID</TableHead>
              <TableHead className="px-4 py-2.5">身份ID</TableHead>
              <TableHead className="px-4 py-2.5">注册时间</TableHead>
              <TableHead className="px-4 py-2.5">更新人</TableHead>
              <TableHead className="px-4 py-2.5">状态</TableHead>
              <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={8} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5">{r.id}</TableCell>
                  <TableCell className="px-4 py-2.5 font-medium">{r.userUuid}</TableCell>
                  <TableCell className="px-4 py-2.5">{r.platformId}</TableCell>
                  <TableCell className="px-4 py-2.5">{r.identityId}</TableCell>
                  <TableCell className="px-4 py-2.5">{fmt(r.createdAt)}</TableCell>
                  <TableCell className="px-4 py-2.5">{r.updator ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        r.status === 0
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          r.status === 0 ? 'bg-emerald-500' : 'bg-muted-foreground',
                        )}
                      />
                      {r.status === 0 ? '正常' : '禁用'}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <HasPermi code={`${PERM}edit`}>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(r)} title="编辑">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </HasPermi>
                      <HasPermi code={`${PERM}remove`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (window.confirm('确定删除？')) deleteMut.mutate(r.id)
                          }}
                          title="删除"
                          className="text-destructive hover:text-destructive"
                          disabled={deleteMut.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </HasPermi>
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
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            第 {page} / {totalPages} 页
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? '编辑用户平台关系' : '新建用户平台关系'}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="space-y-2">
              <Label>用户UUID</Label>
              <Input
                value={form.userUuid}
                onChange={(e) => setForm({ ...form, userUuid: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>平台ID</Label>
                <Input
                  value={form.platformId}
                  onChange={(e) => setForm({ ...form, platformId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>身份ID</Label>
                <Input
                  value={form.identityId}
                  onChange={(e) => setForm({ ...form, identityId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>状态</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className={selectClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">正常</SelectItem>
                    <SelectItem value="1">禁用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>是否删除</Label>
                <Select value={form.isDel} onValueChange={(v) => setForm({ ...form, isDel: v })}>
                  <SelectTrigger className={selectClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">否</SelectItem>
                    <SelectItem value="1">是</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>扩展字段</Label>
              <Input
                value={form.field1}
                onChange={(e) => setForm({ ...form, field1: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={saveMut.isPending}
              >
                取消
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
