'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Users, Loader2, ChevronLeft, ChevronRight, ArrowLeft, Crown } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Button,
  Card,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@ihui/ui'
import { cn } from '@/lib/utils'

interface TeamCenterData {
  totalInvitees: number
  vipInvitees: number
  monthNew: number
  commissionTotal: number
  withdrawalTotal: number
}

interface Subordinate {
  id: string
  nickname: string | null
  avatar: string | null
  isVip: number
  createdAt: string
}

interface ListData {
  items: Subordinate[]
  total: number
}

const PAGE_SIZE = 20

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const fmtYuan = (cents: number) => `¥${(cents / 100).toFixed(2)}`

export default function DistributionTeamPage() {
  const t = useTranslations('distribution')
  const tc = useTranslations('common')
  const locale = useLocale()
  const [page, setPage] = React.useState(1)

  const teamQ = useQuery({
    queryKey: ['distribution', 'team-center'],
    queryFn: () => api<TeamCenterData>('/api/finance/distribution/team/center'),
  })
  const listQ = useQuery({
    queryKey: ['distribution', 'subordinates', page],
    queryFn: () =>
      api<ListData>(`/api/finance/distribution/subordinates?page=${page}&limit=${PAGE_SIZE}`),
  })

  const total = listQ.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const items = listQ.data?.items ?? []

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const fmtDate = (v: string) => {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  const stats = [
    { label: t('teamScale'), value: String(teamQ.data?.totalInvitees ?? 0), icon: Users },
    { label: t('activeMembers'), value: String(teamQ.data?.monthNew ?? 0), icon: Users },
    { label: t('vipMembers'), value: String(teamQ.data?.vipInvitees ?? 0), icon: Crown },
    { label: t('teamCommission'), value: fmtYuan(teamQ.data?.commissionTotal ?? 0), icon: Users },
  ]

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <Link
        href="/distribution"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {tc('back')}
      </Link>

      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <Users className="h-7 w-7 text-primary" />
          {t('teamTitle')}
        </h1>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                {teamQ.isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <div className="text-xl font-bold tracking-tight md:text-2xl">{s.value}</div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{t('subordinates')}</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="px-4 py-2.5">{t('colNickname')}</TableHead>
                <TableHead className="px-4 py-2.5">{t('colLevel')}</TableHead>
                <TableHead className="px-4 py-2.5">{t('colJoinedAt')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQ.isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    {t('loading')}
                  </TableCell>
                </TableRow>
              ) : listQ.error ? (
                <TableRow>
                  <TableCell colSpan={3} className="px-4 py-10 text-center text-destructive">
                    {(listQ.error as Error).message}
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                    <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
                    {t('empty')}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {it.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={it.avatar} alt="" className="h-6 w-6 rounded-full" />
                        ) : (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                            {(it.nickname ?? 'U')[0]?.toUpperCase()}
                          </div>
                        )}
                        <span className="font-medium">{it.nickname ?? '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          it.isVip >= 1
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-500'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {it.isVip >= 1 ? t('levelVip') : t('levelNormal')}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-muted-foreground">
                      {fmtDate(it.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('totalOf', { total })}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
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
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
