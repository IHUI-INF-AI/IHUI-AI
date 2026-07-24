'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { DollarSign, Loader2, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react'

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
} from '@ihui/ui-react'

interface CommissionSummaryData {
  totalAmount: number
  totalToken: number
  commissionDay: number
}

interface AvailableData {
  available: number
}

interface WithdrawalSummaryData {
  totalWithdrawn: number
  pendingAmount: number
}

interface CommissionFlow {
  id: string
  beneficiaryId: string
  invitedUserId: string | null
  orderId: string | null
  amount: number
  token: number
  type: number
  status: number
  remark: string | null
  createdAt: string
}

interface ListData {
  items: CommissionFlow[]
  total: number
}

const PAGE_SIZE = 20

const TYPE_KEY: Record<number, string> = {
  0: 'commissionType0',
  1: 'commissionType1',
  2: 'commissionType2',
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const fmtYuan = (cents: number) => `¥${(cents / 100).toFixed(2)}`

export default function MyCommissionPage() {
  const t = useTranslations('distribution')
  const tc = useTranslations('common')
  const locale = useLocale()
  const [page, setPage] = React.useState(1)

  const summaryQ = useQuery({
    queryKey: ['distribution', 'commission-summary'],
    queryFn: () => api<CommissionSummaryData>('/api/finance/commission/summary'),
  })
  const availableQ = useQuery({
    queryKey: ['distribution', 'withdrawal-available'],
    queryFn: () => api<AvailableData>('/api/finance/withdrawal/available'),
  })
  const withdrawnQ = useQuery({
    queryKey: ['distribution', 'withdrawal-summary'],
    queryFn: () => api<WithdrawalSummaryData>('/api/finance/withdrawal/summary'),
  })
  const listQ = useQuery({
    queryKey: ['distribution', 'commission-list', page],
    queryFn: () => api<ListData>(`/api/finance/commission/list?page=${page}&limit=${PAGE_SIZE}`),
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
    { label: t('totalAmount'), value: fmtYuan(summaryQ.data?.totalAmount ?? 0) },
    { label: t('availableAmount'), value: fmtYuan(availableQ.data?.available ?? 0) },
    { label: t('withdrawnAmount'), value: fmtYuan(withdrawnQ.data?.totalWithdrawn ?? 0) },
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
          <DollarSign className="h-7 w-7 text-primary" />
          {t('commissionTitle')}
        </h1>
      </header>

      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="space-y-1 p-4">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              {summaryQ.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <div className="text-xl font-bold tracking-tight md:text-2xl">{s.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{t('commissionFlows')}</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="px-4 py-2.5">{t('colType')}</TableHead>
                <TableHead className="px-4 py-2.5 text-right">{t('colAmount')}</TableHead>
                <TableHead className="px-4 py-2.5 text-right">{t('colToken')}</TableHead>
                <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
                <TableHead className="px-4 py-2.5">{t('colTime')}</TableHead>
                <TableHead className="px-4 py-2.5">{t('colRemark')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQ.isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    {t('loading')}
                  </TableCell>
                </TableRow>
              ) : listQ.error ? (
                <TableRow>
                  <TableCell colSpan={6} className="px-4 py-10 text-center text-destructive">
                    {(listQ.error as Error).message}
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    <DollarSign className="mx-auto mb-2 h-8 w-8 opacity-40" />
                    {t('empty')}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="px-4 py-2.5 font-medium">
                      {t(TYPE_KEY[it.type] ?? 'commissionType0')}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right font-medium text-emerald-600 dark:text-emerald-400">
                      {fmtYuan(it.amount)}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right text-muted-foreground">
                      {it.token}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        {it.status === 1 ? t('commissionActive') : t('commissionInvalid')}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-muted-foreground">
                      {fmtDate(it.createdAt)}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-muted-foreground">
                      {it.remark ?? '-'}
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
