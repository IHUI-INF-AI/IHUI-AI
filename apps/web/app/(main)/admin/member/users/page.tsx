'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@ihui/ui-react'

import { UserFilter } from './UserFilter'
import { UserTable } from './UserTable'
import { CreateUserDialog } from './CreateUserDialog'
import { DeleteUserDialog } from './DeleteUserDialog'
import { PAGE_SIZE, api } from './helpers'
import type { ListData, MemberUser, CreateUserForm } from './types'

const EMPTY_FORM: CreateUserForm = {
  nickname: '',
  phone: '',
  email: '',
  password: '',
}

export default function AdminMemberUsersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [level, setLevel] = React.useState('all')
  const [status, setStatus] = React.useState('all')
  const [page, setPage] = React.useState(1)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createForm, setCreateForm] = React.useState<CreateUserForm>(EMPTY_FORM)
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
      setCreateForm(EMPTY_FORM)
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

  const handleLevelChange = (v: string) => {
    setLevel(v)
    setPage(1)
  }
  const handleStatusChange = (v: string) => {
    setStatus(v)
    setPage(1)
  }

  const handleStatusToggle = (u: MemberUser) => {
    const isActive = (u.status ?? 0) === 1
    patchMut.mutate({ id: u.id, body: { status: isActive ? 0 : 1 } })
  }

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

      <UserFilter
        search={search}
        onSearchChange={setSearch}
        level={level}
        onLevelChange={handleLevelChange}
        status={status}
        onStatusChange={handleStatusChange}
      />

      <UserTable
        list={list}
        isLoading={isLoading}
        patchPending={patchMut.isPending}
        deletePending={deleteMut.isPending}
        onStatusToggle={handleStatusToggle}
        onDelete={setDeleteTarget}
      />

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

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        form={createForm}
        onChange={setCreateForm}
        submitting={createMut.isPending}
        onSubmit={handleCreateSubmit}
      />

      <DeleteUserDialog
        target={deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        submitting={deleteMut.isPending}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
      />
    </div>
  )
}
