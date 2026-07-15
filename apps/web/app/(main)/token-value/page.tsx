'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Coins, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Button,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@ihui/ui'
import { cn } from '@/lib/utils'
import { AnimatedNumber } from '@/components/common'
import { getTokenBalance, getTokenFlows, type TokenFlowItem } from '@/lib/token-api'

type Range = 'today' | '7d' | '30d' | 'custom'

const PAGE_SIZE = 10

const RANGES: { key: Range; labelKey: string }[] = [
  { key: 'today', labelKey: 'rangeToday' },
  { key: '7d', labelKey: 'range7d' },
  { key: '30d', labelKey: 'range30d' },
  { key: 'custom', labelKey: 'rangeCustom' },
]

export default function TokenValuePage() {
  const t = useTranslations('tokenValue')
  const tc = useTranslations('common')
  const locale = useLocale()
  const [range, setRange] = React.useState<Range>('7d')
  const [page, setPage] = React.useState(1)
  const [customFrom, setCustomFrom] = React.useState('')
  const [customTo, setCustomTo] = React.useState('')

  const balanceQ = useQuery({
    queryKey: ['token-value', 'balance'],
    queryFn: async () => {
      const r = await getTokenBalance()
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })
  const flowsQ = useQuery({
    queryKey: ['token-value', 'flows', range, page, customFrom, customTo],
    queryFn: async () => {
      const r = await getTokenFlows({
        range,
        page,
        pageSize: PAGE_SIZE,
        from: customFrom,
        to: customTo,
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  const total = flowsQ.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const items: TokenFlowItem[] = flowsQ.data?.list ?? []

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
  const onRange = (r: Range) => {
    setRange(r)
    setPage(1)
  }
  const onCustom = (setter: typeof setCustomFrom) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value)
    setPage(1)
  }

  const cards = [
    {
      label: t('currentBalance'),
      val: <AnimatedNumber value={balanceQ.data?.balance ?? 0} />,
      tone: '',
      big: true,
    },
    {
      label: t('totalEarned'),
      val: `+${balanceQ.data?.totalEarned ?? 0}`,
      tone: 'text-emerald-600 dark:text-emerald-400',
      big: false,
    },
    {
      label: t('totalUsed'),
      val: `-${balanceQ.data?.totalUsed ?? 0}`,
      tone: 'text-red-600 dark:text-red-400',
      big: false,
    },
  ]

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <Coins className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border bg-card p-4 text-card-foreground shadow">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{c.label}</span>
              {c.big && (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Coins className="h-4 w-4" />
                </div>
              )}
            </div>
            <div
              className={cn(
                'mt-2 font-bold tracking-tight',
                c.big ? 'text-3xl' : 'text-xl',
                c.tone,
              )}
            >
              {balanceQ.isLoading ? (
                <span className="inline-block h-7 w-24 animate-pulse rounded bg-muted" />
              ) : (
                c.val
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border p-0.5">
            {RANGES.map((opt) => (
              <button
                key={opt.key}
                onClick={() => onRange(opt.key)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  range === opt.key
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {t(opt.labelKey)}
              </button>
            ))}
          </div>
          {range === 'custom' && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={customFrom}
                onChange={onCustom(setCustomFrom)}
                className="h-8 w-[140px]"
              />
              <span className="text-xs text-muted-foreground">~</span>
              <Input
                type="date"
                value={customTo}
                onChange={onCustom(setCustomTo)}
                className="h-8 w-[140px]"
              />
            </div>
          )}
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="px-4 py-2.5">{t('colTime')}</TableHead>
                <TableHead className="px-4 py-2.5">{t('colAgent')}</TableHead>
                <TableHead className="px-4 py-2.5">{t('colModel')}</TableHead>
                <TableHead className="px-4 py-2.5 text-right">{t('colToken')}</TableHead>
                <TableHead className="px-4 py-2.5 text-right">{t('colAmount')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flowsQ.isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    {tc('loading')}
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
                    <Coins className="mx-auto mb-2 h-8 w-8 opacity-40" />
                    {tc('empty')}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="px-4 py-2.5 text-muted-foreground">
                      {fmtDate(it.createdAt)}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 font-medium">{it.agentName}</TableCell>
                    <TableCell className="px-4 py-2.5 text-muted-foreground">
                      {it.modelName}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right font-medium text-red-600 dark:text-red-400">
                      -{it.token}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right font-medium text-red-600 dark:text-red-400">
                      ¥{Math.abs(it.amount).toFixed(4)}
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
      </div>
    </div>
  )
}
