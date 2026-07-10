'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Wallet, Plus, ArrowDownToLine, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface BalanceData {
  balance: number
}

interface FlowItem {
  id: string
  opType: number
  quantity: number
  balanceAfter: number
  remark: string | null
  createdAt: string
}

interface FlowsData {
  items: FlowItem[]
  total: number
}

const PAGE_SIZE = 20

const OP_TYPE_KEY: Record<number, string> = {
  1: 'flowRecharge',
  2: 'flowDeduct',
  3: 'flowExpire',
  4: 'flowRefund',
  5: 'flowCommission',
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function WalletPage() {
  const t = useTranslations('wallet')
  const locale = useLocale()
  const [page, setPage] = React.useState(1)

  const balanceQ = useQuery({
    queryKey: ['wallet', 'balance'],
    queryFn: () => api<BalanceData>('/api/finance/margin/balance'),
  })
  const flowsQ = useQuery({
    queryKey: ['wallet', 'flows', page],
    queryFn: () => api<FlowsData>(`/api/finance/margin/flows?page=${page}&limit=${PAGE_SIZE}`),
  })

  const total = flowsQ.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const items = flowsQ.data?.items ?? []

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

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <Wallet className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
      </header>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">{t('balance')}</div>
            {balanceQ.isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : balanceQ.error ? (
              <div className="text-sm text-destructive">{(balanceQ.error as Error).message}</div>
            ) : (
              <div className="text-3xl font-bold tracking-tight">{balanceQ.data?.balance ?? 0}</div>
            )}
          </div>
          <div className="flex gap-2">
            <Link href="/wallet/recharge">
              <Button>
                <Plus className="h-4 w-4" />
                {t('recharge')}
              </Button>
            </Link>
            <Link href="/wallet/withdraw">
              <Button variant="outline">
                <ArrowDownToLine className="h-4 w-4" />
                {t('withdraw')}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{t('flows')}</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="px-4 py-2.5">{t('flowType')}</TableHead>
                <TableHead className="px-4 py-2.5 text-right">{t('flowAmount')}</TableHead>
                <TableHead className="px-4 py-2.5 text-right">{t('flowBalance')}</TableHead>
                <TableHead className="px-4 py-2.5">{t('flowTime')}</TableHead>
                <TableHead className="px-4 py-2.5">{t('flowRemark')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flowsQ.isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    {t('loading')}
                  </TableCell>
                </TableRow>
              ) : flowsQ.error ? (
                <TableRow>
                  <TableCell colSpan={5} className="px-4 py-10 text-center text-destructive">
                    {(flowsQ.error as Error).message}
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    <Wallet className="mx-auto mb-2 h-8 w-8 opacity-40" />
                    {t('empty')}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((it) => {
                  const positive = it.opType === 1 || it.opType === 4 || it.opType === 5
                  return (
                    <TableRow key={it.id}>
                      <TableCell className="px-4 py-2.5 font-medium">
                        {t(OP_TYPE_KEY[it.opType] ?? 'flowRecharge')}
                      </TableCell>
                      <TableCell className={cn('px-4 py-2.5 text-right font-medium', positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                        {positive ? '+' : ''}{it.quantity}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-right text-muted-foreground">{it.balanceAfter}</TableCell>
                      <TableCell className="px-4 py-2.5 text-muted-foreground">{fmtDate(it.createdAt)}</TableCell>
                      <TableCell className="px-4 py-2.5 text-muted-foreground">{it.remark ?? '-'}</TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{total} / {totalPages}</span>
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
    </div>
  )
}
