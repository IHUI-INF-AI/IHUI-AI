'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Coins } from 'lucide-react'

import { AnimatedNumber } from '@/components/common'
import { getTokenBalance, getTokenFlows, type TokenFlowItem } from '@/lib/token-api'

import { TokenValueCards } from './TokenValueCards'
import { TokenValueFilters } from './TokenValueFilters'
import { TokenValueTable } from './TokenValueTable'
import { PAGE_SIZE, type Range } from './helpers'

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
  const onCustomFrom = (v: string) => {
    setCustomFrom(v)
    setPage(1)
  }
  const onCustomTo = (v: string) => {
    setCustomTo(v)
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

      <TokenValueCards cards={cards} isLoading={balanceQ.isLoading} />

      <div className="space-y-3">
        <TokenValueFilters
          range={range}
          customFrom={customFrom}
          customTo={customTo}
          t={t}
          onRange={onRange}
          onCustomFrom={onCustomFrom}
          onCustomTo={onCustomTo}
        />

        <TokenValueTable
          items={items}
          isLoading={flowsQ.isLoading}
          error={flowsQ.error as Error | null}
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={PAGE_SIZE}
          t={t}
          tc={tc}
          fmtDate={fmtDate}
          onPageChange={setPage}
        />
      </div>
    </div>
  )
}
