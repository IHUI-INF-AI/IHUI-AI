'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  UserCog,
  Building2,
  UserCheck,
  UserX,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, Input } from '@ihui/ui'

interface UserStatistics {
  total: number
  active: number
  disabled: number
  deptTotal: number
}
interface UserItem {
  id: string
  phone: string | null
  nickname: string | null
  email: string | null
  status: number
  departmentName: string | null
  createdAt: string
}
interface UsersData {
  list: UserItem[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 20

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function UserCenterPage() {
  const t = useTranslations('userCenter')

  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data: stats } = useQuery({
    queryKey: ['userCenter', 'statistics'],
    queryFn: () =>
      api<{ statistics: UserStatistics }>(`/api/admin/usercenter/statistics`).then(
        (d) => d.statistics,
      ),
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['userCenter', 'users', debounced, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (debounced) qs.set('nickname', debounced)
      return api<UsersData>(`/api/admin/usercenter/users?${qs.toString()}`)
    },
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const users = data?.list ?? []

  const cards = [
    { label: t('totalUsers'), value: stats?.total ?? 0, icon: UserCog, color: 'text-primary' },
    {
      label: t('activeUsers'),
      value: stats?.active ?? 0,
      icon: UserCheck,
      color: 'text-emerald-600',
    },
    {
      label: t('disabledUsers'),
      value: stats?.disabled ?? 0,
      icon: UserX,
      color: 'text-destructive',
    },
    {
      label: t('totalDepts'),
      value: stats?.deptTotal ?? 0,
      icon: Building2,
      color: 'text-primary',
    },
  ]

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <UserCog className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {/* 统计卡片 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 用户列表 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('userList')}</h2>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchUser')}
              className="h-9 pl-8"
              aria-label={t('searchUser')}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('loading')}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {(error as Error).message}
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
            <UserCog className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">{t('nickname')}</th>
                  <th className="px-4 py-2 text-left font-medium">{t('phone')}</th>
                  <th className="px-4 py-2 text-left font-medium">{t('department')}</th>
                  <th className="px-4 py-2 text-left font-medium">{t('status')}</th>
                  <th className="px-4 py-2 text-left font-medium">{t('createdAt')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="px-4 py-2">{u.nickname ?? '-'}</td>
                    <td className="px-4 py-2">{u.phone ?? '-'}</td>
                    <td className="px-4 py-2">{u.departmentName ?? '-'}</td>
                    <td className="px-4 py-2">
                      {u.status === 1 ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                          {t('active')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                          {t('disabled')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
            <div className="flex items-center gap-2">
              <button
                className="inline-flex h-8 items-center justify-center rounded-md border px-2 text-sm disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <button
                className="inline-flex h-8 items-center justify-center rounded-md border px-2 text-sm disabled:opacity-50"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
