'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Users, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@ihui/ui'

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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Users className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
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
        onStatusToggle={setConfirmUser}
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
        onConfirmStatus={handleStatusConfirm}
        onCancelStatus={() => setConfirmUser(null)}
        patchPending={patchMut.isPending}
        dateFmt={dateFmt}
      />
    </div>
  )
}
