'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Users, Search, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { fetchApi } from '@/lib/api'
import {
  Input,
  Button,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui'
import { cn } from '@/lib/utils'

interface MemberUser {
  id: string
  nickname: string | null
  phone: string | null
  email: string | null
  level: number
  status: number
  createdAt: string | null
}

interface ListData {
  list: MemberUser[]
  total: number
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const PAGE_SIZE = 10
const selectClass =
  'h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function AdminMemberUsersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [level, setLevel] = React.useState('all')
  const [status, setStatus] = React.useState('all')
  const [page, setPage] = React.useState(1)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createForm, setCreateForm] = React.useState({
    nickname: '',
    phone: '',
    email: '',
    password: '',
  })
  const [deleteTarget, setDeleteTarget] = React.useState<MemberUser | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'member', 'users', debounced, level, status, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (debounced) qs.set('search', debounced)
      if (level !== 'all') qs.set('level', level)
      if (status !== 'all') qs.set('status', status)
      return api<ListData>(`/api/admin/member/users?${qs.toString()}`)
    },
  })

  const patchMut = useMutation({
    mutationFn: (p: { id: string; body: { status?: number; level?: number } }) =>
      api(`/api/admin/member/users/${p.id}`, { method: 'PATCH', body: JSON.stringify(p.body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'member', 'users'] }),
  })

  const createMut = useMutation({
    mutationFn: (body: { nickname: string; phone?: string; email?: string; password: string }) =>
      api('/api/admin/member/users', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('用户创建成功')
      qc.invalidateQueries({ queryKey: ['admin', 'member', 'users'] })
      setCreateOpen(false)
      setCreateForm({ nickname: '', phone: '', email: '', password: '' })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/member/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('用户已删除')
      qc.invalidateQueries({ queryKey: ['admin', 'member', 'users'] })
      setDeleteTarget(null)
    },
    onError: (e: Error) => {
      toast.error(e.message)
      setDeleteTarget(null)
    },
  })

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!createForm.nickname.trim()) return toast.error('请输入昵称')
    if (!createForm.phone.trim() && !createForm.email.trim())
      return toast.error('手机号和邮箱至少填一个')
    if (createForm.password.length < 6) return toast.error('密码至少 6 位')
    const body: { nickname: string; phone?: string; email?: string; password: string } = {
      nickname: createForm.nickname.trim(),
      password: createForm.password,
    }
    if (createForm.phone.trim()) body.phone = createForm.phone.trim()
    if (createForm.email.trim()) body.email = createForm.email.trim()
    createMut.mutate(body)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Users className="h-6 w-6 text-primary" />
            会员用户列表
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">管理平台会员用户</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          新增用户
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索昵称/手机号"
            className="h-9 pl-8"
          />
        </div>
        <Select
          value={level}
          onValueChange={(v) => {
            setLevel(v)
            setPage(1)
          }}
        >
          <SelectTrigger className={selectClass} aria-label="等级">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部等级</SelectItem>
            <SelectItem value="0">普通</SelectItem>
            <SelectItem value="1">白银</SelectItem>
            <SelectItem value="2">黄金</SelectItem>
            <SelectItem value="3">钻石</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v)
            setPage(1)
          }}
        >
          <SelectTrigger className={selectClass} aria-label="状态">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="1">正常</SelectItem>
            <SelectItem value="0">禁用</SelectItem>
            <SelectItem value="3">已注销</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">用户</th>
              <th className="px-4 py-2.5 font-medium">联系方式</th>
              <th className="px-4 py-2.5 font-medium">等级</th>
              <th className="px-4 py-2.5 font-medium">状态</th>
              <th className="px-4 py-2.5 font-medium">注册时间</th>
              <th className="px-4 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  暂无用户
                </td>
              </tr>
            ) : (
              list.map((u) => {
                const statusVal = u.status ?? 0
                const isActive = statusVal === 1
                const isCancelled = statusVal === 3
                const levelLabel = ['普通', '白银', '黄金', '钻石'][u.level] ?? '普通'
                return (
                  <tr key={u.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium">
                      {u.nickname || u.phone || u.email || u.id}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      <div>{u.phone || '-'}</div>
                      <div className="text-muted-foreground/80">{u.email || '-'}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs',
                          u.level >= 2
                            ? 'bg-amber-500/10 text-amber-600'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {levelLabel}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
                          isCancelled
                            ? 'bg-zinc-500/10 text-zinc-500'
                            : isActive
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            isCancelled
                              ? 'bg-zinc-500'
                              : isActive
                                ? 'bg-emerald-500'
                                : 'bg-muted-foreground',
                          )}
                        />
                        {isCancelled ? '已注销' : isActive ? '正常' : '禁用'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={patchMut.isPending}
                          onClick={() =>
                            patchMut.mutate({ id: u.id, body: { status: isActive ? 0 : 1 } })
                          }
                        >
                          {isActive ? '禁用' : '启用'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={deleteMut.isPending}
                          onClick={() => setDeleteTarget(u)}
                          className="text-destructive hover:text-destructive"
                          aria-label="删除用户"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建用户</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="member-create-nickname" className="text-sm font-medium">
                昵称
              </label>
              <Input
                id="member-create-nickname"
                aria-label="昵称"
                value={createForm.nickname}
                onChange={(e) => setCreateForm((f) => ({ ...f, nickname: e.target.value }))}
                placeholder="请输入昵称"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label htmlFor="member-create-phone" className="text-sm font-medium">
                  手机号
                </label>
                <Input
                  id="member-create-phone"
                  aria-label="手机号"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="可选"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="member-create-email" className="text-sm font-medium">
                  邮箱
                </label>
                <Input
                  id="member-create-email"
                  aria-label="邮箱"
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="可选"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="member-create-password" className="text-sm font-medium">
                密码(至少 6 位)
              </label>
              <Input
                id="member-create-password"
                aria-label="密码"
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="请输入密码"
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
                {createMut.isPending ? '创建中…' : '创建'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除用户</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确认要删除用户
            <span className="mx-1 font-medium text-foreground">
              "
              {deleteTarget?.nickname ||
                deleteTarget?.phone ||
                deleteTarget?.email ||
                deleteTarget?.id}
              "
            </span>
            吗?此操作不可恢复。
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteMut.isPending}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? '删除中…' : '删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
