'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { ArrowDownToLine, Loader2, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react'

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
import { cn } from '@/lib/utils'

interface WithdrawalItem {
  id: string
  amount: number
  fee: number
  originalAmount: number
  status: number
  method: string
  createdAt: string
  processedAt: string | null
}

interface ListData {
  items: WithdrawalItem[]
  total: number
}

const PAGE_SIZE = 20

const STATUS_KEY: Record<number, string> = {
  0: 'withdrawStatusPending',
  1: 'withdrawStatusProcessing',
  2: 'withdrawStatusCompleted',
  3: 'withdrawStatusFailed',
}

const STATUS_CLS: Record<number, string> = {
  0: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  1: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  2: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  3: 'bg-red-500/10 text-red-600 dark:text-red-500',
}

const METHOD_KEY: Record<string, string> = {
  wechat: 'methodWechat',
  alipay: 'methodAlipay',
  bank: 'methodBank',
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const fmtYuan = (cents: number) => `¥${(cents / 100).toFixed(2)}`

export default function WithdrawRecordsPage() {
  const t = useTranslations('distribution')
  const tc = useTranslations('common')
  const locale = useLocale()
  const [page, setPage] = React.useState(1)

  const listQ = useQuery({
    queryKey: ['distribution', 'withdrawal-list', page],
    queryFn: () => api<ListData>(`/api/finance/withdrawal/list?page=${page}&limit=${PAGE_SIZE}`),
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
  const fmtDate = (v: string | null) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/distribution/withdraw"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {tc('back')}
        </Link>
      </div>

      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <ArrowDownToLine className="h-7 w-7 text-primary" />
          {t('withdrawRecordsTitle')}
        </h1>
      </header>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="px-4 py-2.5 text-right">{t('colOriginalAmount')}</TableHead>
              <TableHead className="px-4 py-2.5 text-right">{t('colActualAmount')}</TableHead>
              <TableHead className="px-4 py-2.5 text-right">{t('colFee')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colMethod')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colTime')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colProcessedAt')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQ.isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </TableCell>
              </TableRow>
            ) : listQ.error ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-destructive">
                  {(listQ.error as Error).message}
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <ArrowDownToLine className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('empty')}
                </TableCell>
              </TableRow>
            ) : (
              items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="px-4 py-2.5 text-right font-medium">
                    {fmtYuan(it.originalAmount)}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right text-emerald-600 dark:text-emerald-400">
                    {fmtYuan(it.amount)}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right text-muted-foreground">
                    {fmtYuan(it.fee)}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    {t(METHOD_KEY[it.method] ?? 'methodWechat')}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                        STATUS_CLS[it.status] ?? 'bg-muted text-muted-foreground',
                      )}
                    >
                      {t(STATUS_KEY[it.status] ?? 'withdrawStatusPending')}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    {fmtDate(it.createdAt)}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    {fmtDate(it.processedAt)}
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

      <Card>
        <CardContent className="flex justify-center p-4">
          <Link href="/distribution/withdraw">
            <Button variant="outline">{t('withdrawTitle')}</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
