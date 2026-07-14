'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Users, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import {
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui'

import { UserFilter } from './UserFilter'
import { UserTable } from './UserTable'
import { UserDialog } from './UserDialog'
import { PAGE_SIZE, fetchUsers, api } from './helpers'
import type { AdminUser } from './types'

export default function AdminUsersPage() {
  const t = useTranslations('admin.users')
  const locale = useLocale()
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [role, setRole] = React.useState('all')
  const [status, setStatus] = React.useState('all')
  const [page, setPage] = React.useState(1)
  const [quickUser, setQuickUser] = React.useState<AdminUser | null>(null)
  const [detailUser, setDetailUser] = React.useState<AdminUser | null>(null)
  const [confirmUser, setConfirmUser] = React.useState<AdminUser | null>(null)
  const [confirmMode, setConfirmMode] = React.useState<'status' | 'delete'>('status')
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createForm, setCreateForm] = React.useState({
    nickname: '',
    phone: '',
    email: '',
    password: '',
  })

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'users', debounced, role, status, page],
    queryFn: () => fetchUsers({ page, search: debounced, role, status }),
  })

  const patchMut = useMutation({
    mutationFn: (p: { id: string; body: { role?: number; status?: number } }) =>
      api<{ user: AdminUser }>(`/api/admin/users/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify(p.body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })

  const createMut = useMutation({
    mutationFn: (body: { nickname: string; phone?: string; email?: string; password: string }) =>
      api<{ user: AdminUser }>('/api/admin/users', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('用户创建成功')
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      setCreateOpen(false)
      setCreateForm({ nickname: '', phone: '', email: '', password: '' })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('用户已删除')
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const users = data?.list ?? []
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const handleStatusConfirm = () => {
    if (!confirmUser) return
    const isActive = (confirmUser.status ?? 0) >= 1
    patchMut.mutate({ id: confirmUser.id, body: { status: isActive ? 0 : 1 } })
    setConfirmUser(null)
  }
  const handleDeleteConfirm = () => {
    if (!confirmUser) return
    deleteMut.mutate(confirmUser.id)
    setConfirmUser(null)
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
  const askStatusToggle = (u: AdminUser) => {
    setConfirmUser(u)
    setConfirmMode('status')
  }
  const askDelete = (u: AdminUser) => {
    setConfirmUser(u)
    setConfirmMode('delete')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Users className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          新增用户
        </Button>
      </div>

      <UserFilter
        search={search}
        onSearchChange={setSearch}
        role={role}
        onRoleChange={(v) => {
          setRole(v)
          setPage(1)
        }}
        status={status}
        onStatusChange={(v) => {
          setStatus(v)
          setPage(1)
        }}
      />

      <UserTable
        list={users}
        isLoading={isLoading}
        error={error as Error | null}
        patchPending={patchMut.isPending}
        dateFmt={dateFmt}
        onQuickView={setQuickUser}
        onDetail={setDetailUser}
        onRoleChange={(id, r) => patchMut.mutate({ id, body: { role: r } })}
        onStatusToggle={askStatusToggle}
        onDelete={askDelete}
      />

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            {t('prev')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('page', { page, total: totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('next')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <UserDialog
        quickUser={quickUser}
        onCloseQuick={() => setQuickUser(null)}
        detailUser={detailUser}
        onCloseDetail={() => setDetailUser(null)}
        confirmUser={confirmUser}
        confirmMode={confirmMode}
        onConfirmStatus={handleStatusConfirm}
        onConfirmDelete={handleDeleteConfirm}
        onCancelStatus={() => setConfirmUser(null)}
        patchPending={patchMut.isPending}
        dateFmt={dateFmt}
        deletePending={deleteMut.isPending}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建用户</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="create-nickname" className="text-sm font-medium">
                昵称
              </label>
              <Input
                id="create-nickname"
                value={createForm.nickname}
                onChange={(e) => setCreateForm((f) => ({ ...f, nickname: e.target.value }))}
                placeholder="请输入昵称"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label htmlFor="create-phone" className="text-sm font-medium">
                  手机号
                </label>
                <Input
                  id="create-phone"
                  aria-label="手机号"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="可选"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="create-email" className="text-sm font-medium">
                  邮箱
                </label>
                <Input
                  id="create-email"
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="可选"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="create-password" className="text-sm font-medium">
                密码(至少 6 位)
              </label>
              <Input
                id="create-password"
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
    </div>
  )
}
