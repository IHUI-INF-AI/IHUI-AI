'use client'

import { useTranslations, useLocale } from 'next-intl'
import { Loader2, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '@ihui/ui'
import { STATUS_CLASS, createMoneyFmt } from './helpers'
import type { Settlement } from './types'

interface Props {
  list: Settlement[]
  isLoading: boolean
  error: Error | null
  settlePending: boolean
  onSettle: (id: string) => void
}

export function SettlementTable({ list, isLoading, error, settlePending, onSettle }: Props) {
  const t = useTranslations('admin.agents.settlement')
  const locale = useLocale()
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const fmtAmount = createMoneyFmt(locale)

  return (
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
                {error.message}
              </TableCell>
            </TableRow>
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                <Wallet className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('empty')}
              </TableCell>
            </TableRow>
          ) : (
            list.map((r) => (
              <TableRow key={r.id} className="transition-colors hover:bg-muted/30">
                <TableCell className="px-4 py-2.5 font-mono text-xs">{r.orderNo || '-'}</TableCell>
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
                      onClick={() => onSettle(r.id)}
                      disabled={settlePending}
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
  )
}
