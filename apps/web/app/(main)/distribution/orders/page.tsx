'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { TrendingUp, Loader2, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react'

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
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui-react'
import { cn } from '@/lib/utils'

interface Order {
  id: string
  orderNo: string
  userId: string
  amount: number
  currency: string
  status: string
  paymentMethod: string | null
  paidAt: string | null
  createdAt: string
}

interface ListData {
  items: Order[]
  total: number
}

const PAGE_SIZE = 20

const STATUS_KEY: Record<string, string> = {
  pending: 'orderStatusPending',
  paid: 'orderStatusPaid',
  cancelled: 'orderStatusCancelled',
  refunded: 'orderStatusRefunded',
}

const STATUS_CLS: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  paid: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  cancelled: 'bg-muted text-muted-foreground',
  refunded: 'bg-red-500/10 text-red-600 dark:text-red-500',
}

const STATUS_OPTIONS = ['pending', 'paid', 'cancelled', 'refunded']

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const fmtYuan = (cents: number) => `¥${(cents / 100).toFixed(2)}`

export default function CommissionOrdersPage() {
  const t = useTranslations('distribution')
  const tc = useTranslations('common')
  const locale = useLocale()
  const [page, setPage] = React.useState(1)
  const [status, setStatus] = React.useState<string>('all')

  const listQ = useQuery({
    queryKey: ['distribution', 'commission-orders', page, status],
    queryFn: () =>
      api<ListData>(
        `/api/finance/commission/orders?page=${page}&limit=${PAGE_SIZE}${status !== 'all' ? `&status=${status}` : ''}`,
      ),
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

  const onStatusChange = (v: string) => {
    setStatus(v)
    setPage(1)
  }

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
          <TrendingUp className="h-7 w-7 text-primary" />
          {t('commissionOrders')}
        </h1>
      </header>

      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <span className="text-sm text-muted-foreground">{t('colStatus')}</span>
          <Select value={status} onValueChange={onStatusChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('statusAll')}</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(STATUS_KEY[s] ?? s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="px-4 py-2.5">{t('colOrderNo')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colOrderType')}</TableHead>
              <TableHead className="px-4 py-2.5 text-right">{t('colAmount')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colTime')}</TableHead>
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
                  <TrendingUp className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('empty')}
                </TableCell>
              </TableRow>
            ) : (
              items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="px-4 py-2.5 font-medium">{it.orderNo}</TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    {it.paymentMethod ?? '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right font-medium">
                    {fmtYuan(it.amount)}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                        STATUS_CLS[it.status] ?? 'bg-muted text-muted-foreground',
                      )}
                    >
                      {t(STATUS_KEY[it.status] ?? 'orderStatusPending')}
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
  )
}
