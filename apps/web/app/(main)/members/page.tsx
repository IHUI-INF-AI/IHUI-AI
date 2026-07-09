'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Users, Search, Loader2, ChevronLeft, ChevronRight, ShieldCheck, ShieldAlert, Clock } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui'

interface MemberItem {
  id: string
  username: string | null
  mobile: string | null
  email: string | null
  nickname: string | null
  avatar: string | null
  gender: number
  status: number
  levelId: string | null
  growthValue: number
  createdAt: string | null
}
interface MembersData { list: MemberItem[]; total: number; page: number; pageSize: number }

interface LevelItem { id: string; name: string }

const PAGE_SIZE = 20
const selectClass =
  'h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function StatusBadge({ status, t }: { status: number; t: (k: string) => string }) {
  if (status === 1) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
        <ShieldCheck className="h-3 w-3" />
        {t('statusActive')}
      </span>
    )
  }
  if (status === 2) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600">
        <ShieldAlert className="h-3 w-3" />
        {t('statusSealed')}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600">
      <Clock className="h-3 w-3" />
      {t('statusPending')}
    </span>
  )
}

export default function MembersPage() {
  const t = useTranslations('members')

  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('all')
  const [levelFilter, setLevelFilter] = React.useState('all')
  const [page, setPage] = React.useState(1)

  React.useEffect(() => {
    const tm = setTimeout(() => { setDebounced(search); setPage(1) }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data: levels } = useQuery({
    queryKey: ['members', 'levels'],
    queryFn: () => api<{ list: LevelItem[] }>(`/api/admin/members/levels`).then((d) => d.list ?? []),
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['members', 'list', debounced, statusFilter, levelFilter, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (debounced) qs.set('username', debounced)
      if (statusFilter !== 'all') qs.set('status', statusFilter)
      if (levelFilter !== 'all') qs.set('levelId', levelFilter)
      return api<MembersData>(`/api/admin/members?${qs.toString()}`)
    },
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const members = data?.list ?? []
  const levelMap = React.useMemo(() => {
    const m = new Map<string, string>()
    for (const l of levels ?? []) m.set(l.id, l.name)
    return m
  }, [levels])

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <Users className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search')}
            className="h-9 pl-8"
            aria-label={t('search')}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className={selectClass} aria-label={t('status')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allStatus')}</SelectItem>
            <SelectItem value="1">{t('statusActive')}</SelectItem>
            <SelectItem value="0">{t('statusPending')}</SelectItem>
            <SelectItem value="2">{t('statusSealed')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={levelFilter} onValueChange={(v) => { setLevelFilter(v); setPage(1) }}>
          <SelectTrigger className={selectClass} aria-label={t('level')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allLevels')}</SelectItem>
            {(levels ?? []).map((l) => (
              <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
          <Users className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {members.map((member) => (
            <Card key={member.id} className="transition-colors hover:border-primary/40">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                <CardTitle className="text-base">
                  {member.nickname ?? member.username ?? t('unnamed')}
                </CardTitle>
                <StatusBadge status={member.status} t={t} />
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 p-4 pt-0 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">{t('username')}</p>
                  <p className="truncate">{member.username ?? '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('mobile')}</p>
                  <p className="truncate">{member.mobile ?? '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('level')}</p>
                  <p className="truncate">{member.levelId ? (levelMap.get(member.levelId) ?? '-') : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('growthValue')}</p>
                  <p className="truncate">{member.growthValue}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
