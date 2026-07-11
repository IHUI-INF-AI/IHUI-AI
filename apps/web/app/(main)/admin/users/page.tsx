'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Search, Loader2, ChevronLeft, ChevronRight, Users } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Input,
  Button,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import { cn } from '@/lib/utils'

interface AdminUser {
  id: string
  phone: string | null
  email: string | null
  nickname: string | null
  avatar: string | null
  roleId: number | null
  status: number | null
  createdAt: string | null
}
interface UsersData {
  list: AdminUser[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 10
const selectClass =
  'h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function fetchUsers(params: {
  page: number
  search: string
  role: string
  status: string
}): Promise<UsersData> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) })
  if (params.search) qs.set('search', params.search)
  if (params.role !== 'all') qs.set('role', params.role)
  if (params.status !== 'all') qs.set('status', params.status)
  return api<UsersData>(`/api/admin/users?${qs.toString()}`)
}

export default function AdminUsersPage() {
  const t = useTranslations('admin.users')
  const locale = useLocale()
  const qc = useQueryClient()

  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [role, setRole] = React.useState('all')
  const [status, setStatus] = React.useState('all')
  const [page, setPage] = React.useState(1)

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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Users className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="h-9 pl-8"
            aria-label={t('search')}
          />
        </div>
        <Select
          value={role}
          onValueChange={(v) => {
            setRole(v)
            setPage(1)
          }}
        >
          <SelectTrigger className={selectClass} aria-label={t('role')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allRoles')}</SelectItem>
            <SelectItem value="1">{t('roleAdmin')}</SelectItem>
            <SelectItem value="0">{t('roleUser')}</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v)
            setPage(1)
          }}
        >
          <SelectTrigger className={selectClass} aria-label={t('status')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allStatus')}</SelectItem>
            <SelectItem value="1">{t('statusActive')}</SelectItem>
            <SelectItem value="0">{t('statusDisabled')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
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
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noData')}
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const isAdmin = (u.roleId ?? 0) >= 1
                const isActive = (u.status ?? 0) >= 1
                const name = u.nickname || u.phone || u.email || 'U'
                return (
                  <tr key={u.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-medium">
                          {u.avatar ? (
                            <img src={u.avatar} alt={name} className="h-8 w-8 rounded-full" />
                          ) : (
                            (name?.[0] ?? 'U').toUpperCase()
                          )}
                        </div>
                        <span className="font-medium">{name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      <div className="text-xs">{u.phone || '-'}</div>
                      <div className="text-xs text-muted-foreground/80">{u.email || '-'}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Select
                        value={isAdmin ? '1' : '0'}
                        onValueChange={(v) =>
                          patchMut.mutate({ id: u.id, body: { role: Number(v) } })
                        }
                      >
                        <SelectTrigger
                          className={cn(
                            selectClass,
                            isAdmin ? 'border-primary/30 text-primary' : 'text-muted-foreground',
                          )}
                          aria-label={t('setRole')}
                          disabled={patchMut.isPending}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">{t('roleUser')}</SelectItem>
                          <SelectItem value="1">{t('roleAdmin')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                          isActive
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            isActive ? 'bg-emerald-500' : 'bg-muted-foreground',
                          )}
                        />
                        {isActive ? t('statusActive') : t('statusDisabled')}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {u.createdAt ? dateFmt.format(new Date(u.createdAt)) : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={patchMut.isPending}
                        onClick={() =>
                          patchMut.mutate({ id: u.id, body: { status: isActive ? 0 : 1 } })
                        }
                      >
                        {isActive ? t('disable') : t('enable')}
                      </Button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

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
  )
}
