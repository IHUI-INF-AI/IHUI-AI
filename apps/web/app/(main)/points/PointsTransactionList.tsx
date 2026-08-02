'use client'

import { useTranslations, useLocale } from 'next-intl'
import { Star, Coins } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PointsState } from './PointsState'
import { TX_ICON } from './types'
import { createDateFmt } from './helpers'
import type { Transaction } from './types'

interface Props {
  isLoading: boolean
  error: unknown
  data: Transaction[] | undefined
}

export function PointsTransactionList({ isLoading, error, data }: Props) {
  const t = useTranslations('points')
  const locale = useLocale()
  const fmt = createDateFmt(locale)

  if (isLoading) return <PointsState kind="loading" text={t('loading')} />
  if (error) return <PointsState kind="error" text={(error as Error).message} />
  if (!data || data.length === 0) return <PointsState kind="empty" icon={Coins} text={t('empty')} />

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">{t('source')}</th>
              <th className="px-4 py-2 text-right font-medium">{t('amount')}</th>
              <th className="hidden px-4 py-2 text-right font-medium min-[640px]:table-cell">
                {t('balance')}
              </th>
              <th className="hidden px-4 py-2 text-left font-medium min-[768px]:table-cell">
                {t('description')}
              </th>
              <th className="px-4 py-2 text-right font-medium">{t('time')}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((tx) => {
              const Icon = TX_ICON[tx.type] ?? Star
              const positive = tx.amount >= 0
              return (
                <tr key={tx.id} className="transition-colors hover:bg-accent/50">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="max-w-[180px] truncate font-medium" title={tx.source}>
                        {tx.source}
                      </span>
                    </div>
                  </td>
                  <td
                    className={cn(
                      'px-4 py-2 text-right font-medium tabular-nums',
                      positive
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400',
                    )}
                  >
                    {positive ? '+' : ''}
                    {tx.amount}
                  </td>
                  <td className="hidden px-4 py-2 text-right tabular-nums text-muted-foreground min-[640px]:table-cell">
                    {tx.balanceAfter}
                  </td>
                  <td className="hidden px-4 py-2 text-muted-foreground min-[768px]:table-cell">
                    {tx.description ?? '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right text-xs tabular-nums text-muted-foreground">
                    {fmt(tx.createdAt)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
