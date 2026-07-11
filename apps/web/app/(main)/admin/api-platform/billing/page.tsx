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
import { useLocale } from 'next-intl'

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
const TYPE_LABEL: Record<BillingRecord['type'], string> = {
  recharge: '充值',
  consume: '消费',
  refund: '退款',
}
const STATUS_LABEL: Record<BillingRecord['status'], string> = {
  pending: '处理中',
  success: '成功',
  failed: '失败',
}

export default function AdminApiPlatformBillingPage() {
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

  const cards = [
    {
      label: '累计充值',
      value: summary?.totalRecharge ?? 0,
      icon: TrendingUp,
      cls: 'text-emerald-600',
    },
    {
      label: '累计消费',
      value: summary?.totalConsume ?? 0,
      icon: TrendingDown,
      cls: 'text-amber-600',
    },
    { label: '累计退款', value: summary?.totalRefund ?? 0, icon: Receipt, cls: 'text-red-600' },
    { label: '当前余额', value: summary?.balance ?? 0, icon: Wallet, cls: 'text-primary' },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Receipt className="h-6 w-6 text-primary" />
          API 计费管理
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">API 平台账单与资金流水</p>
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
                  ¥{(c.value / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className={selectClass} aria-label="类型">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="recharge">充值</SelectItem>
            <SelectItem value="consume">消费</SelectItem>
            <SelectItem value="refund">退款</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className={selectClass} aria-label="状态">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="pending">处理中</SelectItem>
            <SelectItem value="success">成功</SelectItem>
            <SelectItem value="failed">失败</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs uppercase">应用</TableHead>
              <TableHead className="text-xs uppercase">类型</TableHead>
              <TableHead className="text-xs uppercase">金额</TableHead>
              <TableHead className="text-xs uppercase">状态</TableHead>
              <TableHead className="text-xs uppercase">时间</TableHead>
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
                  暂无记录
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
                      {TYPE_LABEL[r.type]}
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
                      {STATUS_LABEL[r.status]}
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
