'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import {
  Loader2,
  Wallet,
  CircleDollarSign,
  CheckCircle2,
  Hourglass,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'

interface Settlement {
  id: string
  agentId: string
  buyRecordId: string | null
  orderNo: string | null
  amount: number
  commissionRate: number
  commissionAmount: number
  status: string
  settledAt: string | null
  createdAt: string
  updatedAt: string
}

interface SettlementData {
  list: Settlement[]
  total: number
  page: number
  pageSize: number
}

interface SettlementSummary {
  totalAmount: number
  settledAmount: number
  pendingAmount: number
}

const PAGE_SIZE = 20
const STATUS_OPTIONS = ['unsettled', 'settled']

const STATUS_CLASS: Record<string, string> = {
  unsettled: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  settled: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function fetchSettlements(params: {
  page: number
  status: string
  agentId: string
  orderNo: string
}): Promise<SettlementData> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) })
  if (params.status !== 'all') qs.set('status', params.status)
  if (params.agentId) qs.set('agentId', params.agentId)
  if (params.orderNo) qs.set('orderNo', params.orderNo)
  return api<SettlementData>(`/api/settlement/list?${qs.toString()}`)
}

const selectClass =
  'h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function AdminSettlementPage() {
  const t = useTranslations('admin.agents.settlement')
  const locale = useLocale()
  const qc = useQueryClient()

  const [status, setStatus] = React.useState('all')
  const [agentId, setAgentId] = React.useState('')
  const [orderNo, setOrderNo] = React.useState('')
  const [page, setPage] = React.useState(1)

  const { data: summary } = useQuery({
    queryKey: ['admin', 'agents', 'settlement', 'summary'],
    queryFn: () => api<SettlementSummary>('/api/settlement/summary'),
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'agents', 'settlement', status, agentId, orderNo, page],
    queryFn: () => fetchSettlements({ page, status, agentId, orderNo }),
  })

  const settleMut = useMutation({
    mutationFn: (id: string) =>
      api<Settlement>('/api/settlement/settle', {
        method: 'POST',
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => {
      toast.success(t('settleSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'agents', 'settlement'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const records = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const moneyFmt = new Intl.NumberFormat(locale, { style: 'currency', currency: 'CNY' })
  const fmtAmount = (n: number) => moneyFmt.format(n / 100)

  const summaryCards = [
    { key: 'totalAmount', value: summary?.totalAmount ?? 0, icon: CircleDollarSign, cls: 'text-primary' },
    { key: 'settledAmount', value: summary?.settledAmount ?? 0, icon: CheckCircle2, cls: 'text-emerald-500' },
    { key: 'pendingAmount', value: summary?.pendingAmount ?? 0, icon: Hourglass, cls: 'text-amber-500' },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Wallet className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {summaryCards.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.key} className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t(`summary_${s.key}`)}</span>
                <Icon className={cn('h-4 w-4', s.cls)} />
              </div>
              <p className="mt-2 text-2xl font-bold">{fmtAmount(s.value)}</p>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={orderNo}
          onChange={(e) => {
            setOrderNo(e.target.value)
            setPage(1)
          }}
          placeholder={t('orderNoPlaceholder')}
          className="h-9 w-full max-w-[200px]"
          aria-label={t('colOrderNo')}
        />
        <Input
          value={agentId}
          onChange={(e) => {
            setAgentId(e.target.value)
            setPage(1)
          }}
          placeholder={t('agentIdPlaceholder')}
          className="h-9 w-full max-w-[200px]"
          aria-label={t('colAgent')}
        />
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
          <SelectTrigger className={selectClass} aria-label={t('colStatus')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allStatus')}</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`status${s.charAt(0).toUpperCase()}${s.slice(1)}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">{t('colOrderNo')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colAgent')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colAmount')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colSettledAt')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colCreatedAt')}</TableHead>
              <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <Wallet className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('empty')}
                </TableCell>
              </TableRow>
            ) : (
              records.map((r) => (
                <TableRow key={r.id} className="transition-colors hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-mono text-xs">
                    {r.orderNo || '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {r.agentId ? r.agentId.slice(0, 8) : '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 font-medium">{fmtAmount(r.amount)}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        STATUS_CLASS[r.status] ?? STATUS_CLASS.unsettled,
                      )}
                    >
                      {t(`status${r.status.charAt(0).toUpperCase()}${r.status.slice(1)}`)}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                    {r.settledAt ? dateFmt.format(new Date(r.settledAt)) : '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                    {dateFmt.format(new Date(r.createdAt))}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    {r.status === 'unsettled' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => settleMut.mutate(r.id)}
                        disabled={settleMut.isPending}
                      >
                        {t('settle')}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t('prev')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('page', { page, total: totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('next')}
          </Button>
        </div>
      </div>
    </div>
  )
}
