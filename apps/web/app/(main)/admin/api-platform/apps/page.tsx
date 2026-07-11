'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, KeyRound, Trash2, Copy, Power } from 'lucide-react'

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
import { cn } from '@/lib/utils'
import { useLocale } from 'next-intl'

interface ApiApp {
  id: string
  name: string
  appId: string
  appSecret?: string
  permissions: string[]
  status: number
  createdAt: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const EMPTY = { name: '', permissions: '' }

export default function AdminApiPlatformAppsPage() {
  const qc = useQueryClient()
  const locale = useLocale()
  const [createOpen, setCreateOpen] = React.useState(false)
  const [form, setForm] = React.useState(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)
  const [created, setCreated] = React.useState<ApiApp | null>(null)
  const [delTarget, setDelTarget] = React.useState<ApiApp | null>(null)

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ['admin', 'api-platform', 'apps'],
    queryFn: () =>
      api<{ list: ApiApp[] }>('/api/admin/api-platform/apps').then((d) => d.list ?? []),
  })

  const createMut = useMutation({
    mutationFn: () =>
      api<ApiApp>('/api/admin/api-platform/apps', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          permissions: form.permissions
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['admin', 'api-platform', 'apps'] })
      setCreateOpen(false)
      setForm(EMPTY)
      setErr(null)
      setCreated(data)
    },
    onError: (e: Error) => setErr(e.message),
  })

  const toggleMut = useMutation({
    mutationFn: (a: ApiApp) =>
      api(`/api/admin/api-platform/apps/${a.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: a.status === 1 ? 0 : 1 }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'api-platform', 'apps'] }),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/api-platform/apps/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'api-platform', 'apps'] })
      setDelTarget(null)
    },
    onError: (e: Error) => setErr(e.message),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!form.name.trim()) {
      setErr('请输入应用名称')
      return
    }
    createMut.mutate()
  }

  const copy = (text: string) => navigator.clipboard?.writeText(text)

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <KeyRound className="h-6 w-6 text-primary" />
            API 应用管理
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">管理 API 平台应用、密钥与权限</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setForm(EMPTY)
            setErr(null)
            setCreateOpen(true)
          }}
        >
          <Plus className="h-4 w-4" />
          新建应用
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs uppercase">应用名称</TableHead>
              <TableHead className="text-xs uppercase">AppID</TableHead>
              <TableHead className="text-xs uppercase">权限</TableHead>
              <TableHead className="text-xs uppercase">状态</TableHead>
              <TableHead className="text-xs uppercase">创建时间</TableHead>
              <TableHead className="text-right text-xs uppercase">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                </TableCell>
              </TableRow>
            ) : apps.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  暂无应用
                </TableCell>
              </TableRow>
            ) : (
              apps.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-xs">{a.appId}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => copy(a.appId)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[220px]">
                    <div className="flex flex-wrap gap-1">
                      {(a.permissions ?? []).map((p) => (
                        <span key={p} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {p}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {a.status === 1 ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-600">
                        启用
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        停用
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat(locale).format(new Date(a.createdAt))}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleMut.mutate(a)}
                        disabled={toggleMut.isPending}
                      >
                        <Power className="h-3.5 w-3.5" />
                        {a.status === 1 ? '停用' : '启用'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setErr(null)
                          setDelTarget(a)
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={(o) => (o ? null : (setCreateOpen(false), setErr(null)))}
      >
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>新建 API 应用</DialogTitle>
              <DialogDescription>创建后将生成 AppID 与 AppSecret</DialogDescription>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="ap-name">应用名称</Label>
              <Input
                id="ap-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="输入应用名称"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ap-perms">权限（逗号分隔）</Label>
              <Input
                id="ap-perms"
                value={form.permissions}
                onChange={(e) => setForm({ ...form, permissions: e.target.value })}
                placeholder="例如：read:users,write:orders"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={createMut.isPending}
              >
                取消
              </Button>
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                创建
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!created} onOpenChange={(o) => (o ? null : setCreated(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建成功</DialogTitle>
            <DialogDescription>请妥善保管 AppSecret，仅展示一次</DialogDescription>
          </DialogHeader>
          {created && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>AppID</Label>
                <code className="block rounded-md bg-muted/50 px-3 py-2 text-xs">
                  {created.appId}
                </code>
              </div>
              <div className="space-y-1">
                <Label>AppSecret</Label>
                <code className={cn('block rounded-md bg-amber-500/10 px-3 py-2 text-xs')}>
                  {created.appSecret}
                </code>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" onClick={() => setCreated(null)}>
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!delTarget}
        onOpenChange={(o) => (o ? null : (setDelTarget(null), setErr(null)))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除应用</DialogTitle>
            <DialogDescription>该操作不可恢复</DialogDescription>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
            <span className="font-medium">{delTarget?.name}</span>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDelTarget(null)}
              disabled={delMut.isPending}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={delMut.isPending}
              onClick={() => delTarget && delMut.mutate(delTarget.id)}
            >
              {delMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
