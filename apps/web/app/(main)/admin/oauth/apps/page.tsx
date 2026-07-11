'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, KeyRound, Trash2, Power, ShieldCheck } from 'lucide-react'

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

interface OAuthApp {
  id: string
  name: string
  clientId: string
  ownerId: string
  ownerName: string
  redirectUris: string[]
  scopes: string[]
  status: 'active' | 'disabled' | 'pending'
  createdAt: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const EMPTY = { name: '', redirectUris: '', scopes: '', ownerId: '' }
const STATUS_LABEL: Record<OAuthApp['status'], string> = {
  active: '正常',
  disabled: '已禁用',
  pending: '待审核',
}
const STATUS_STYLE: Record<OAuthApp['status'], string> = {
  active: 'bg-emerald-500/10 text-emerald-600',
  disabled: 'bg-muted text-muted-foreground',
  pending: 'bg-amber-500/10 text-amber-600',
}

export default function AdminOAuthAppsPage() {
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)
  const [delTarget, setDelTarget] = React.useState<OAuthApp | null>(null)

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ['admin', 'oauth', 'apps'],
    queryFn: () => api<{ list: OAuthApp[] }>('/api/admin/oauth/apps').then((d) => d.list ?? []),
  })

  const createMut = useMutation({
    mutationFn: () =>
      api<OAuthApp>('/api/admin/oauth/apps', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          ownerId: form.ownerId.trim(),
          redirectUris: form.redirectUris
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          scopes: form.scopes
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'oauth', 'apps'] })
      setOpen(false)
      setForm(EMPTY)
      setErr(null)
    },
    onError: (e: Error) => setErr(e.message),
  })

  const toggleMut = useMutation({
    mutationFn: (a: OAuthApp) =>
      api(`/api/admin/oauth/apps/${a.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: a.status === 'active' ? 'disabled' : 'active' }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'oauth', 'apps'] }),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/oauth/apps/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'oauth', 'apps'] })
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
    if (!form.ownerId.trim()) {
      setErr('请输入所属用户ID')
      return
    }
    createMut.mutate()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <KeyRound className="h-6 w-6 text-primary" />
            OAuth 应用管理
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">管理开放平台 OAuth 应用</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setForm(EMPTY)
            setErr(null)
            setOpen(true)
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
              <TableHead className="text-xs uppercase">ClientID</TableHead>
              <TableHead className="text-xs uppercase">所属用户</TableHead>
              <TableHead className="text-xs uppercase">回调地址</TableHead>
              <TableHead className="text-xs uppercase">权限</TableHead>
              <TableHead className="text-xs uppercase">状态</TableHead>
              <TableHead className="text-right text-xs uppercase">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                </TableCell>
              </TableRow>
            ) : apps.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  暂无应用
                </TableCell>
              </TableRow>
            ) : (
              apps.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell className="font-mono text-xs">{a.clientId}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {a.ownerName || a.ownerId}
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <div className="space-y-0.5 text-xs text-muted-foreground">
                      {(a.redirectUris ?? []).slice(0, 2).map((u) => (
                        <div key={u} className="break-words">
                          {u}
                        </div>
                      ))}
                      {a.redirectUris.length > 2 && (
                        <div className="text-xs">+{a.redirectUris.length - 2}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(a.scopes ?? []).slice(0, 3).map((s) => (
                        <span key={s} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {s}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
                        STATUS_STYLE[a.status],
                      )}
                    >
                      <ShieldCheck className="h-3 w-3" />
                      {STATUS_LABEL[a.status]}
                    </span>
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
                        {a.status === 'active' ? '禁用' : '启用'}
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

      <Dialog open={open} onOpenChange={(o) => (o ? null : (setOpen(false), setErr(null)))}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>新建 OAuth 应用</DialogTitle>
              <DialogDescription>创建开放平台 OAuth 应用</DialogDescription>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="oa-name">应用名称</Label>
              <Input
                id="oa-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="oa-owner">所属用户ID</Label>
              <Input
                id="oa-owner"
                value={form.ownerId}
                onChange={(e) => setForm({ ...form, ownerId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="oa-redirect">回调地址（逗号分隔）</Label>
              <Input
                id="oa-redirect"
                value={form.redirectUris}
                onChange={(e) => setForm({ ...form, redirectUris: e.target.value })}
                placeholder="https://example.com/callback"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="oa-scopes">权限（逗号分隔）</Label>
              <Input
                id="oa-scopes"
                value={form.scopes}
                onChange={(e) => setForm({ ...form, scopes: e.target.value })}
                placeholder="user:read,user:write"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
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
