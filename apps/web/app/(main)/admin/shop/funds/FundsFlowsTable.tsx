'use client'

import { Loader2, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { TYPE_LABEL } from './helpers'
import type { FundFlow } from './types'
import { formatDate } from '@/lib/date-utils'

interface Props {
  flows: FundFlow[]
  isLoading: boolean
}

export function FundsFlowsTable({ flows, isLoading }: Props) {
  const t = useTranslations('admin.shop')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="text-xs uppercase">{t('funds.table.user')}</TableHead>
            <TableHead className="text-xs uppercase">{t('funds.table.type')}</TableHead>
            <TableHead className="text-xs uppercase">{t('funds.table.amount')}</TableHead>
            <TableHead className="text-xs uppercase">{t('funds.table.balance')}</TableHead>
            <TableHead className="text-xs uppercase">{t('funds.table.remark')}</TableHead>
            <TableHead className="text-xs uppercase">{t('funds.table.time')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              </TableCell>
            </TableRow>
          ) : flows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                {t('funds.noFlows')}
              </TableCell>
            </TableRow>
          ) : (
            flows.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.user}</TableCell>
                <TableCell>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {t(TYPE_LABEL[f.type])}
                  </span>
                </TableCell>
                <TableCell
                  className={cn(
                    'font-medium',
                    f.direction === 'in' ? 'text-emerald-600' : 'text-red-600',
                  )}
                >
                  <span className="inline-flex items-center gap-0.5">
                    {f.direction === 'in' ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {f.direction === 'in' ? '+' : '-'}¥{(f.amount / 100).toFixed(2)}
                  </span>
                </TableCell>
                <TableCell>¥{(f.balance / 100).toFixed(2)}</TableCell>
                <TableCell className="max-w-[200px] break-words text-xs text-muted-foreground">
                  {f.remark || '-'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(f.createdAt)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
