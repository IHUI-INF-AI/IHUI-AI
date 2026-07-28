'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Users, Plus, ArrowUpDown } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { CenteredText } from '@/components/common'

import { UserFilter } from './UserFilter'
import { UserDialog } from './UserDialog'
import { CreateUserDialog, type CreateUserForm } from './CreateUserDialog'
import { ResetPasswordDialog } from './ResetPasswordDialog'
import { RoleAssignDialog } from './RoleAssignDialog'
import { DeptTree } from './DeptTree'
import { UserTable } from './UserTable'
import { PAGE_SIZE, fetchDeptList, api, selectClass } from './helpers'
import { useUserMutations } from './useUserMutations'
import type { AdminUser, UsersData } from './types'
import {
  useClientTable,
  useSortedData,
  type ColumnDef,
  type SortingState,
} from '@/hooks/use-react-table'

// 列定义:与 UserTable 列 ID 对齐,用于 react-table 排序/列状态管理
const userColumns: ColumnDef<AdminUser>[] = [
  { id: 'drag', enableSorting: false },
  { id: 'nickname', accessorKey: 'nickname' },
  { id: 'contact', accessorFn: (u: AdminUser) => `${u.phone ?? ''} ${u.email ?? ''}` },
  { id: 'role', accessorKey: 'roleId' },
  { id: 'status', accessorKey: 'status' },
  { id: 'createdAt', accessorKey: 'createdAt' },
  { id: 'actions', enableSorting: false },
]

// 默认排序选项 → SortingState 映射(空值回落到 storedOrder 手动拖拽排序)
const USER_SORT_OPTIONS: { value: string; label: string; state: SortingState }[] = [
  { value: '', label: '默认(手动排序)', state: [] },
  { value: 'createdAt-desc', label: '最新注册', state: [{ id: 'createdAt', desc: true }] },
  { value: 'createdAt-asc', label: '最早注册', state: [{ id: 'createdAt', desc: false }] },
  { value: 'nickname-asc', label: '昵称 A-Z', state: [{ id: 'nickname', desc: false }] },
  { value: 'nickname-desc', label: '昵称 Z-A', state: [{ id: 'nickname', desc: true }] },
]

const EMPTY_FORM: CreateUserForm = { nickname: '', phone: '', email: '', password: '' }

const ORDER_STORAGE_KEY = 'admin-users-order'

function loadStoredOrder(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(ORDER_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function saveStoredOrder(ids: string[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // ignore quota / serialization errors
  }
}

function applyStoredOrder(users: AdminUser[], stored: string[]): AdminUser[] {
  if (stored.length === 0) return users
  const orderMap = new Map(stored.map((id, idx) => [id, idx]))
  const known: AdminUser[] = []
  const newcomers: AdminUser[] = []
  for (const u of users) {
    if (orderMap.has(u.id)) known.push(u)
    else newcomers.push(u)
  }
  known.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0))
  return [...known, ...newcomers]
}

export default function AdminUsersPage() {
  const t = useTranslations('admin.users')
  const locale = useLocale()
  const { patchMut, createMut, deleteMut, resetPwdMut, invalidateUsers } = useUserMutations()
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [role, setRole] = React.useState('all')
  const [status, setStatus] = React.useState('all')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE)
  const [selectedDeptId, setSelectedDeptId] = React.useState<string | null>(null)
  const [quickUser, setQuickUser] = React.useState<AdminUser | null>(null)
  const [detailUser, setDetailUser] = React.useState<AdminUser | null>(null)
  const [confirmUser, setConfirmUser] = React.useState<AdminUser | null>(null)
  const [confirmMode, setConfirmMode] = React.useState<'status' | 'delete'>('status')
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createForm, setCreateForm] = React.useState<CreateUserForm>(EMPTY_FORM)
  const [resetUser, setResetUser] = React.useState<AdminUser | null>(null)
  const [roleUser, setRoleUser] = React.useState<AdminUser | null>(null)
  const [storedOrder, setStoredOrder] = React.useState<string[]>([])

  React.useEffect(() => {
    setStoredOrder(loadStoredOrder())
  }, [])

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'users', debounced, role, status, page, selectedDeptId, pageSize],
    queryFn: () => {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      })
      if (debounced) qs.set('search', debounced)
      if (role !== 'all') qs.set('role', role)
      if (status !== 'all') qs.set('status', status)
      if (selectedDeptId) qs.set('deptId', selectedDeptId)
      return api<UsersData>(`/api/admin/users?${qs.toString()}`)
    },
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
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const rawUsers = data?.list ?? []
  const orderedUsers = React.useMemo(
    () => applyStoredOrder(rawUsers, storedOrder),
    [rawUsers, storedOrder],
  )

  // react-table 客户端实例:排序持久化 + 列可见性/固定/宽状态管理
  // sorting 非空时覆盖 storedOrder 手动拖拽排序;sorting 为空时回落到 orderedUsers
  const { table, sorting, setSorting } = useClientTable<AdminUser>({
    data: orderedUsers,
    columns: userColumns,
    storageKey: 'admin-users-table',
    enableSorting: true,
    enableColumnVisibility: true,
    enableColumnPinning: true,
    enableColumnResize: true,
    getRowId: (u) => u.id,
  })
  const users = useSortedData(table, orderedUsers, sorting)

  // 排序选择器当前值
  const userSortValue = React.useMemo(() => {
    const s = sorting[0]
    return s ? `${s.id}-${s.desc ? 'desc' : 'asc'}` : ''
  }, [sorting])
  const onUserSortChange = React.useCallback(
    (v: string) => {
      const opt = USER_SORT_OPTIONS.find((o) => o.value === v)
      setSorting(opt ? opt.state : [])
    },
    [setSorting],
  )

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const handleReorder = React.useCallback((newOrder: string[]) => {
    setStoredOrder(newOrder)
    saveStoredOrder(newOrder)
  }, [])

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
      <div className="grid grid-cols-[200px_1fr] gap-3">
        <aside className="sticky top-4 h-[calc(100vh-7rem)] self-start">
          <DeptTree
            selectedId={selectedDeptId}
            onSelect={(id) => {
              setSelectedDeptId(id)
              setPage(1)
            }}
          />
        </aside>
        <div className="min-w-0 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
                <Users className="h-5 w-5 text-primary" />
                <CenteredText>{t('title')}</CenteredText>
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground">{t('subtitle')}</p>
            </div>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              <CenteredText>{t('createUser')}</CenteredText>
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

          <div className="flex items-center gap-2 text-xs">
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">默认排序</span>
            <select
              value={userSortValue}
              onChange={(e) => onUserSortChange(e.target.value)}
              className={selectClass}
              aria-label="默认排序"
            >
              {USER_SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <UserTable
            users={users}
            loading={isLoading}
            error={error as Error | null}
            patchPending={patchMut.isPending}
            dateFmt={dateFmt}
            page={page}
            pageSize={pageSize}
            total={total}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s)
              setPage(1)
            }}
            onReorder={handleReorder}
            onQuickView={setQuickUser}
            onDetail={setDetailUser}
            onRoleAssign={setRoleUser}
            onResetPassword={setResetUser}
            onStatusToggle={(usr) => openConfirm(usr, 'status')}
            onDelete={(usr) => openConfirm(usr, 'delete')}
          />
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
