'use client'

import { Loader2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { TYPE_LABEL_KEY, STATUS_LABEL_KEY, type BillingRecord } from './types'

interface Props {
  list: BillingRecord[]
  isLoading: boolean
}

export function BillingRecordsTable({ list, isLoading }: Props) {
  const t = useTranslations('adminApiBilling')
  const locale = useLocale()
  return (
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
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                {t('noData')}
              </TableCell>
            </TableRow>
          ) : (
            list.map((r) => (
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
                      'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs',
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
  )
}
