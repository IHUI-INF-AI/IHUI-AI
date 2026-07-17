'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { ArrowDownToLine, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'

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

interface SummaryData {
  total: number
  processing: number
  completed: number
}

type WithdrawalStatus = 'pending' | 'processing' | 'completed' | 'failed'

interface WithdrawalItem {
  id: string
  amount: number
  fee: number
  actualAmount: number
  status: WithdrawalStatus
  method: string
  createdAt: string
  processedAt: string | null
}

interface ListData {
  items: WithdrawalItem[]
  total: number
}

const PAGE_SIZE = 20

const STATUS_KEY: Record<WithdrawalStatus, string> = {
  pending: 'statusPending',
  processing: 'statusProcessing',
  completed: 'statusCompleted',
  failed: 'statusFailed',
}

const STATUS_CLS: Record<WithdrawalStatus, string> = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  processing: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-500',
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

export default function WithdrawRecordsPage() {
  const t = useTranslations('wallet')
  const locale = useLocale()
  const [page, setPage] = React.useState(1)

  const summaryQ = useQuery({
    queryKey: ['wallet', 'withdrawal', 'summary'],
    queryFn: () => api<SummaryData>('/api/finance/withdrawal/summary'),
  })
  const listQ = useQuery({
    queryKey: ['wallet', 'withdrawal', 'list', page],
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

  const stats = [
    { label: t('availableAmount'), value: summaryQ.data?.total ?? 0 },
    { label: t('processingAmount'), value: summaryQ.data?.processing ?? 0 },
    { label: t('completedAmount'), value: summaryQ.data?.completed ?? 0 },
  ]

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <ArrowDownToLine className="h-7 w-7 text-primary" />
          {t('withdrawRecords')}
        </h1>
      </header>

      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="space-y-1 p-4">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              {summaryQ.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : summaryQ.error ? (
                <div className="text-sm text-destructive">{(summaryQ.error as Error).message}</div>
              ) : (
                <div className="text-2xl font-bold tracking-tight">{s.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="px-4 py-2.5">{t('withdrawAmount')}</TableHead>
              <TableHead className="px-4 py-2.5 text-right">{t('flowAmount')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('withdrawMethod')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('flowType')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('flowTime')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQ.isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </TableCell>
              </TableRow>
            ) : listQ.error ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-destructive">
                  {(listQ.error as Error).message}
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <ArrowDownToLine className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('empty')}
                </TableCell>
              </TableRow>
            ) : (
              items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="px-4 py-2.5 font-medium">{it.amount}</TableCell>
                  <TableCell className="px-4 py-2.5 text-right text-muted-foreground">
                    <div className="font-medium text-foreground">{it.actualAmount}</div>
                    <div className="text-xs">-{it.fee}</div>
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    {t(METHOD_KEY[it.method] ?? 'methodWechat')}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                        STATUS_CLS[it.status],
                      )}
                    >
                      {t(STATUS_KEY[it.status])}
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
          <span className="text-sm text-muted-foreground">
            {total} / {totalPages}
          </span>
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

      <div className="flex justify-center">
        <Link href="/wallet">
          <Button variant="outline">{t('backToWallet')}</Button>
        </Link>
      </div>
    </div>
  )
}
