'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
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
import { Button, DataTable, type DataTableColumn } from '@ihui/ui-react'
import { Avatar } from '@/components/data/Avatar'
import { cn } from '@/lib/utils'

import type { AdminUser } from './types'

interface UserTableProps {
  users: AdminUser[]
  loading: boolean
  error: Error | null
  patchPending: boolean
  dateFmt: Intl.DateTimeFormat
  page: number
  pageSize: number
  total: number
  totalPages: number
  onPageChange: (p: number) => void
  onPageSizeChange: (s: number) => void
  onReorder: (newOrder: string[]) => void
  onQuickView: (u: AdminUser) => void
  onDetail: (u: AdminUser) => void
  onRoleAssign: (u: AdminUser) => void
  onResetPassword: (u: AdminUser) => void
  onStatusToggle: (u: AdminUser) => void
  onDelete: (u: AdminUser) => void
}

interface SortableUserRowProps {
  user: AdminUser
  t: ReturnType<typeof useTranslations<'admin.users'>>
  patchPending: boolean
  dateFmt: Intl.DateTimeFormat
  onQuickView: (u: AdminUser) => void
  onDetail: (u: AdminUser) => void
  onRoleAssign: (u: AdminUser) => void
  onResetPassword: (u: AdminUser) => void
  onStatusToggle: (u: AdminUser) => void
  onDelete: (u: AdminUser) => void
}

function SortableUserRow({
  user,
  t,
  patchPending,
  dateFmt,
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
      className={cn('transition-colors hover:bg-muted/30', isDragging && 'bg-accent/50')}
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
        <button className="flex items-center gap-2" onClick={() => onQuickView(user)}>
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
          {isBanned ? t('statusCancelled') : isActive ? t('statusActive') : t('statusDisabled')}
        </span>
      </td>
      <td className="px-4 py-2.5 text-xs text-muted-foreground">
        {user.createdAt ? dateFmt.format(new Date(user.createdAt)) : '-'}
      </td>
      <td className="px-4 py-2.5 text-right">
        <div className="flex justify-end gap-0.5">
          <Button size="sm" variant="ghost" onClick={() => onDetail(user)} aria-label={t('view')}>
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
            {isActive ? <Ban className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
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

export function UserTable({
  users,
  loading,
  error,
  patchPending,
  dateFmt,
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  onReorder,
  onQuickView,
  onDetail,
  onRoleAssign,
  onResetPassword,
  onStatusToggle,
  onDelete,
}: UserTableProps) {
  const t = useTranslations('admin.users')

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
    onReorder(reordered.map((u) => u.id))
  }

  const columns = React.useMemo<DataTableColumn<AdminUser>[]>(
    () => [
      {
        id: 'drag',
        header: '',
        size: 40,
        enableSorting: false,
        enableColumnFilter: false,
        cell: () => null,
      },
      {
        id: 'nickname',
        accessorKey: 'nickname',
        header: t('nickname'),
        size: 180,
        cell: () => null,
      },
      {
        id: 'contact',
        accessorFn: (u) => `${u.phone ?? ''} ${u.email ?? ''}`,
        header: `${t('phone')} / ${t('email')}`,
        size: 200,
        cell: () => null,
      },
      {
        id: 'role',
        accessorKey: 'roleId',
        header: t('role'),
        size: 110,
        filterFn: (row, _id, value) => {
          const v = String(value).trim()
          if (!v) return true
          const isAdmin = (row.original.roleId ?? 0) >= 1
          if (v === '1' || v.toLowerCase() === 'admin') return isAdmin
          if (v === '0' || v.toLowerCase() === 'user') return !isAdmin
          return true
        },
        cell: () => null,
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: t('status'),
        size: 110,
        filterFn: (row, _id, value) => String(row.original.status ?? 0) === String(value),
        cell: () => null,
      },
      {
        id: 'createdAt',
        accessorKey: 'createdAt',
        header: t('createdAt'),
        size: 150,
        cell: () => null,
      },
      {
        id: 'actions',
        header: t('actions'),
        size: 200,
        enableSorting: false,
        enableColumnFilter: false,
        cell: () => null,
      },
    ],
    [t],
  )

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={users.map((u) => u.id)} strategy={verticalListSortingStrategy}>
        <DataTable
          columns={columns}
          data={users}
          getRowId={(u) => u.id}
          manualPagination
          pageCount={totalPages}
          controlledPageIndex={page - 1}
          controlledPageSize={pageSize}
          controlledTotal={total}
          onPageIndexChange={(i) => onPageChange(i + 1)}
          onPageSizeChange={onPageSizeChange}
          loading={loading}
          error={error}
          emptyText={t('noData')}
          enableColumnResize
          enableColumnFilters
          renderRow={(row, _defaultRow) => (
            <SortableUserRow
              user={row.original}
              t={t}
              patchPending={patchPending}
              dateFmt={dateFmt}
              onQuickView={onQuickView}
              onDetail={onDetail}
              onRoleAssign={onRoleAssign}
              onResetPassword={onResetPassword}
              onStatusToggle={onStatusToggle}
              onDelete={onDelete}
            />
          )}
        />
      </SortableContext>
    </DndContext>
  )
}
