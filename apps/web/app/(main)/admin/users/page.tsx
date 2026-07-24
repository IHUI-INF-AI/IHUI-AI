'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import {
  Users,
  ChevronLeft,
  ChevronRight,
  Plus,
  Eye,
  Trash2,
  KeyRound,
  Shield,
  Ban,
  RotateCcw,
  ShieldCheck,
  GripVertical,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@ihui/ui-react'

import { Avatar } from '@/components/data/Avatar'
import { Skeleton, CenteredText } from '@/components/common'
import { cn } from '@/lib/utils'

import { UserFilter } from './UserFilter'
import { UserDialog } from './UserDialog'
import { CreateUserDialog, type CreateUserForm } from './CreateUserDialog'
import { ResetPasswordDialog } from './ResetPasswordDialog'
import { RoleAssignDialog } from './RoleAssignDialog'
import { DeptTree } from './DeptTree'
import { PAGE_SIZE, fetchUsers, fetchDeptList } from './helpers'
import { useUserMutations } from './useUserMutations'
import type { AdminUser } from './types'

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

interface SortableUserRowProps {
  user: AdminUser
  dateFmt: Intl.DateTimeFormat
  t: ReturnType<typeof useTranslations<'admin.users'>>
  patchPending: boolean
  onQuickView: (u: AdminUser) => void
  onDetail: (u: AdminUser) => void
  onRoleAssign: (u: AdminUser) => void
  onResetPassword: (u: AdminUser) => void
  onStatusToggle: (u: AdminUser) => void
  onDelete: (u: AdminUser) => void
}

function SortableUserRow({
  user,
  dateFmt,
  t,
  patchPending,
  onQuickView,
  onDetail,
  onRoleAssign,
  onResetPassword,
  onStatusToggle,
  onDelete,
}: SortableUserRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: user.id,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const isAdmin = (user.roleId ?? 0) >= 1
  const statusVal = user.status ?? 0
  const isActive = statusVal === 1
  const isBanned = statusVal === 3
  const name = user.nickname || user.phone || user.email || 'U'

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        'transition-colors hover:bg-muted/30',
        isDragging && 'bg-accent/50',
      )}
      {...attributes}
    >
      <td className="w-8 px-1 py-2.5">
        <button
          type="button"
          {...listeners}
          aria-label="拖动以排序"
          className={cn(
            'flex h-6 w-4 cursor-grab items-center justify-center rounded-md text-muted-foreground/60 transition-colors',
            'hover:bg-accent hover:text-foreground active:cursor-grabbing',
            isDragging && 'text-foreground',
          )}
        >
          <GripVertical className="h-4 w-3.5" strokeWidth={1.5} />
        </button>
      </td>
      <td className="px-4 py-2.5">
        <button
          className="flex items-center gap-2"
          onClick={() => onQuickView(user)}
        >
          <Avatar src={user.avatar ?? undefined} name={name} size="sm" />
          <span className="font-medium hover:text-primary">{name}</span>
        </button>
      </td>
      <td className="px-4 py-2.5 text-muted-foreground">
        <div className="text-xs">{user.phone || '-'}</div>
        <div className="text-xs text-muted-foreground/80">{user.email || '-'}</div>
      </td>
      <td className="px-4 py-2.5">
        <span
          className={cn(
            'inline-flex items-center gap-1 text-xs font-medium',
            isAdmin ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          <Shield className="h-3 w-3" />
          {isAdmin ? t('roleAdmin') : t('roleUser')}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
            isBanned
              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-500'
              : isActive
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                : 'bg-muted text-muted-foreground',
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              isBanned
                ? 'bg-rose-500'
                : isActive
                  ? 'bg-emerald-500'
                  : 'bg-muted-foreground',
            )}
          />
          {isBanned
            ? t('statusCancelled')
            : isActive
              ? t('statusActive')
              : t('statusDisabled')}
        </span>
      </td>
      <td className="px-4 py-2.5 text-xs text-muted-foreground">
        {user.createdAt ? dateFmt.format(new Date(user.createdAt)) : '-'}
      </td>
      <td className="px-4 py-2.5 text-right">
        <div className="flex justify-end gap-0.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDetail(user)}
            aria-label={t('view')}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onRoleAssign(user)}
            aria-label={t('setRole')}
            disabled={patchPending}
          >
            <KeyRound className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onResetPassword(user)}
            aria-label={t('resetPassword')}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={patchPending}
            onClick={() => onStatusToggle(user)}
            className={cn(
              isActive
                ? 'text-rose-600 hover:text-rose-600 dark:text-rose-500'
                : 'text-emerald-600 hover:text-emerald-600 dark:text-emerald-500',
            )}
            aria-label={isActive ? t('ban') : t('unban')}
          >
            {isActive ? (
              <Ban className="h-4 w-4" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(user)}
            aria-label={t('delete')}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  )
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
  const rawUsers = data?.list ?? []
  const users = React.useMemo(() => applyStoredOrder(rawUsers, storedOrder), [rawUsers, storedOrder])

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = users.findIndex((u) => u.id === active.id)
    const newIndex = users.findIndex((u) => u.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const reordered = arrayMove(users, oldIndex, newIndex)
    const newOrder = reordered.map((u) => u.id)
    setStoredOrder(newOrder)
    saveStoredOrder(newOrder)
  }

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
                <CenteredText>{t('title')}</CenteredText>
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
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

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={users.map((u) => u.id)} strategy={verticalListSortingStrategy}>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="w-8 px-1 py-2.5" aria-label="拖动以排序" />
                      <th className="px-4 py-2.5 font-medium">{t('nickname')}</th>
                      <th className="px-4 py-2.5 font-medium">
                        {t('phone')} / {t('email')}
                      </th>
                      <th className="px-4 py-2.5 font-medium">{t('role')}</th>
                      <th className="px-4 py-2.5 font-medium">{t('status')}</th>
                      <th className="px-4 py-2.5 font-medium">{t('createdAt')}</th>
                      <th className="px-4 py-2.5 text-right font-medium">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-4">
                          <Skeleton variant="list" count={5} />
                        </td>
                      </tr>
                    ) : error ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-destructive">
                          {error.message}
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                          <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
                          {t('noData')}
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => (
                        <SortableUserRow
                          key={u.id}
                          user={u}
                          dateFmt={dateFmt}
                          t={t}
                          patchPending={patchMut.isPending}
                          onQuickView={setQuickUser}
                          onDetail={setDetailUser}
                          onRoleAssign={setRoleUser}
                          onResetPassword={setResetUser}
                          onStatusToggle={(usr) => openConfirm(usr, 'status')}
                          onDelete={(usr) => openConfirm(usr, 'delete')}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </SortableContext>
          </DndContext>

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
                <CenteredText>{t('prev')}</CenteredText>
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
                <CenteredText>{t('next')}</CenteredText>
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
