'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Users, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@ihui/ui'

import { UserFilter } from './UserFilter'
import { UserTable } from './UserTable'
import { UserDialog } from './UserDialog'
import { CreateUserDialog, type CreateUserForm } from './CreateUserDialog'
import { ResetPasswordDialog } from './ResetPasswordDialog'
import { RoleAssignDialog } from './RoleAssignDialog'
import { DeptTree } from './DeptTree'
import { PAGE_SIZE, fetchUsers, fetchDeptList } from './helpers'
import { useUserMutations } from './useUserMutations'
import type { AdminUser } from './types'

const EMPTY_FORM: CreateUserForm = { nickname: '', phone: '', email: '', password: '' }

export default function AdminUsersPage() {
  const t = useTranslations('admin.users')
  const locale = useLocale()
  const { patchMut, createMut, deleteMut, resetPwdMut, invalidateUsers } = useUserMutations()
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [role, setRole] = React.useState('all')
  const [status, setStatus] = React.useState('all')
  const [page, setPage] = React.useState(1)
  const [selectedDeptId, setSelectedDeptId] = React.useState<string | null>(null)
  const [quickUser, setQuickUser] = React.useState<AdminUser | null>(null)
  const [detailUser, setDetailUser] = React.useState<AdminUser | null>(null)
  const [confirmUser, setConfirmUser] = React.useState<AdminUser | null>(null)
  const [confirmMode, setConfirmMode] = React.useState<'status' | 'delete'>('status')
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createForm, setCreateForm] = React.useState<CreateUserForm>(EMPTY_FORM)
  const [resetUser, setResetUser] = React.useState<AdminUser | null>(null)
  const [roleUser, setRoleUser] = React.useState<AdminUser | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'users', debounced, role, status, page, selectedDeptId],
    queryFn: () => fetchUsers({ page, search: debounced, role, status, deptId: selectedDeptId }),
  })

  const { data: deptData } = useQuery({
    queryKey: ['admin', 'dept', 'list'],
    queryFn: fetchDeptList,
    staleTime: 5 * 60 * 1000,
  })
  const deptMap = React.useMemo(() => {
    const map = new Map<number, string>()
    deptData?.list.forEach((d) => map.set(d.deptId, d.deptName))
    return map
  }, [deptData])
  const getDeptName = React.useCallback(
    (deptId: number | null) => (deptId ? (deptMap.get(deptId) ?? null) : null),
    [deptMap],
  )

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
    const cur = confirmUser.status ?? 0
    patchMut.mutate({ id: confirmUser.id, body: { status: cur === 1 ? 3 : 1 } })
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
    const phone = createForm.phone.trim()
    if (phone) {
      const normalized = phone.replace(/^\+86/, '')
      if (!/^1[3-9]\d{9}$/.test(normalized)) return toast.error('手机号格式不正确')
    }
    if (createForm.password.length < 6) return toast.error('密码至少 6 位')
    const body: { nickname: string; phone?: string; email?: string; password: string } = {
      nickname: createForm.nickname.trim(),
      password: createForm.password,
    }
    if (phone) body.phone = phone
    if (createForm.email.trim()) body.email = createForm.email.trim()
    createMut.mutate(body, {
      onSuccess: () => {
        setCreateOpen(false)
        setCreateForm(EMPTY_FORM)
      },
    })
  }
  const handleRoleAssign = (r: number) => {
    if (!roleUser) return
    patchMut.mutate(
      { id: roleUser.id, body: { role: r } },
      {
        onSuccess: () => setRoleUser(null),
      },
    )
  }
  const handleAvatarUploaded = (u: AdminUser) => {
    setDetailUser(u)
    invalidateUsers()
    toast.success('头像已更新')
  }
  const handleDeptChange = (userId: string, deptId: number | null) =>
    patchMut.mutate(
      { id: userId, body: { deptId } },
      { onSuccess: (resp) => setDetailUser(resp.user) },
    )
  const openConfirm = (u: AdminUser, mode: 'status' | 'delete') => {
    setConfirmUser(u)
    setConfirmMode(mode)
  }

  return (
    <>
      <div className="grid grid-cols-[220px_1fr] gap-4">
        <aside className="sticky top-4 h-[calc(100vh-8rem)] self-start">
          <DeptTree
            selectedId={selectedDeptId}
            onSelect={(id) => {
              setSelectedDeptId(id)
              setPage(1)
            }}
          />
        </aside>
        <div className="min-w-0 space-y-4">
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
              {t('createUser')}
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
            onRoleAssign={setRoleUser}
            onResetPassword={setResetUser}
            onStatusToggle={(u) => openConfirm(u, 'status')}
            onDelete={(u) => openConfirm(u, 'delete')}
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
        onAvatarUploaded={handleAvatarUploaded}
        getDeptName={getDeptName}
        deptList={deptData?.list}
        onDeptChange={handleDeptChange}
      />

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        form={createForm}
        onChange={setCreateForm}
        submitting={createMut.isPending}
        onSubmit={handleCreateSubmit}
      />

      <ResetPasswordDialog
        user={resetUser}
        pending={resetPwdMut.isPending}
        onConfirm={(pwd) => {
          if (resetUser) {
            resetPwdMut.mutate(
              { userId: resetUser.id, password: pwd },
              { onSuccess: () => setResetUser(null) },
            )
          }
        }}
        onCancel={() => setResetUser(null)}
      />

      <RoleAssignDialog
        user={roleUser}
        pending={patchMut.isPending}
        onConfirm={handleRoleAssign}
        onCancel={() => setRoleUser(null)}
      />
    </>
  )
}
