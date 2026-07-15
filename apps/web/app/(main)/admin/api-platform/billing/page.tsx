'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Receipt, TrendingUp, TrendingDown, Wallet } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@ihui/ui'
import { cn } from '@/lib/utils'
import { useLocale, useTranslations } from 'next-intl'
import { formatCurrency } from '@/lib/date-utils'

interface BillingRecord {
  id: string
  appName: string
  amount: number
  type: 'recharge' | 'consume' | 'refund'
  status: 'pending' | 'success' | 'failed'
  createdAt: string
}

interface BillingSummary {
  totalRecharge: number
  totalConsume: number
  totalRefund: number
  balance: number
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const selectClass =
  'h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function AdminApiPlatformBillingPage() {
  const t = useTranslations('adminApiBilling')
  const locale = useLocale()
  const [type, setType] = React.useState('all')
  const [status, setStatus] = React.useState('all')

  const { data: summary } = useQuery({
    queryKey: ['admin', 'api-platform', 'billing', 'summary'],
    queryFn: () => api<BillingSummary>('/api/admin/api-platform/billing/summary'),
  })

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['admin', 'api-platform', 'billing', type, status],
    queryFn: () => {
      const qs = new URLSearchParams()
      if (type !== 'all') qs.set('type', type)
      if (status !== 'all') qs.set('status', status)
      return api<{ list: BillingRecord[] }>(
        `/api/admin/api-platform/billing?${qs.toString()}`,
      ).then((d) => d.list ?? [])
    },
  })

  const TYPE_LABEL_KEY: Record<BillingRecord['type'], string> = {
    recharge: 'typeRecharge',
    consume: 'typeConsume',
    refund: 'typeRefund',
  }
  const STATUS_LABEL_KEY: Record<BillingRecord['status'], string> = {
    pending: 'statusPending',
    success: 'statusSuccess',
    failed: 'statusFailed',
  }

  const cards = [
    {
      label: t('totalRecharge'),
      value: summary?.totalRecharge ?? 0,
      icon: TrendingUp,
      cls: 'text-emerald-600',
    },
    {
      label: t('totalConsume'),
      value: summary?.totalConsume ?? 0,
      icon: TrendingDown,
      cls: 'text-amber-600',
    },
    {
      label: t('totalRefund'),
      value: summary?.totalRefund ?? 0,
      icon: Receipt,
      cls: 'text-red-600',
    },
    { label: t('balance'), value: summary?.balance ?? 0, icon: Wallet, cls: 'text-primary' },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Receipt className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <Card key={c.label}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  {c.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={cn('text-2xl font-bold', c.cls)}>
                  ¥{formatCurrency(c.value / 100)}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className={selectClass} aria-label={t('ariaType')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('typeAll')}</SelectItem>
            <SelectItem value="recharge">{t('typeRecharge')}</SelectItem>
            <SelectItem value="consume">{t('typeConsume')}</SelectItem>
            <SelectItem value="refund">{t('typeRefund')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className={selectClass} aria-label={t('ariaStatus')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('statusAll')}</SelectItem>
            <SelectItem value="pending">{t('statusPending')}</SelectItem>
            <SelectItem value="success">{t('statusSuccess')}</SelectItem>
            <SelectItem value="failed">{t('statusFailed')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs uppercase">{t('colApp')}</TableHead>
              <TableHead className="text-xs uppercase">{t('colType')}</TableHead>
              <TableHead className="text-xs uppercase">{t('colAmount')}</TableHead>
              <TableHead className="text-xs uppercase">{t('colStatus')}</TableHead>
              <TableHead className="text-xs uppercase">{t('colTime')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                </TableCell>
              </TableRow>
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  {t('noData')}
                </TableCell>
              </TableRow>
            ) : (
              records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.appName}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex rounded px-1.5 py-0.5 text-xs',
                        r.type === 'recharge' && 'bg-emerald-500/10 text-emerald-600',
                        r.type === 'consume' && 'bg-amber-500/10 text-amber-600',
                        r.type === 'refund' && 'bg-red-500/10 text-red-600',
                      )}
                    >
                      {t(TYPE_LABEL_KEY[r.type])}
                    </span>
                  </TableCell>
                  <TableCell
                    className={cn(
                      'font-medium',
                      r.type === 'consume'
                        ? 'text-amber-600'
                        : r.type === 'refund'
                          ? 'text-red-600'
                          : 'text-emerald-600',
                    )}
                  >
                    {r.type === 'consume' ? '-' : '+'}¥{(r.amount / 100).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
                        r.status === 'success' && 'bg-emerald-500/10 text-emerald-600',
                        r.status === 'pending' && 'bg-amber-500/10 text-amber-600',
                        r.status === 'failed' && 'bg-red-500/10 text-red-600',
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          r.status === 'success'
                            ? 'bg-emerald-500'
                            : r.status === 'pending'
                              ? 'bg-amber-500'
                              : 'bg-red-500',
                        )}
                      />
                      {t(STATUS_LABEL_KEY[r.status])}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat(locale).format(new Date(r.createdAt))}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
