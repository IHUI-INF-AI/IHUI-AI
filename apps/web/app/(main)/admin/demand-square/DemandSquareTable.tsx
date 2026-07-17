'use client'

import { Check, X, Loader2, LayoutGrid } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@ihui/ui'
import { HasPermi } from '@/components/auth/HasPermi'
import { cn } from '@/lib/utils'
import { STATUS_CLASS } from './helpers'
import type { Examine } from './types'

interface Props {
  list: Examine[]
  isLoading: boolean
  error: Error | null
  onApprove: (id: string) => void
  approvePending: boolean
  onReject: (item: Examine) => void
  rejectPending: boolean
}

export function DemandSquareTable({
  list,
  isLoading,
  error,
  onApprove,
  approvePending,
  onReject,
  rejectPending,
}: Props) {
  const t = useTranslations('admin.demandSquare')
  const locale = useLocale()
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colAgent')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colUser')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colReason')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colCreatedAt')}</TableHead>
            <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                {t('loading')}
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={6} className="px-4 py-10 text-center text-destructive">
                {error.message}
              </TableCell>
            </TableRow>
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                <LayoutGrid className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('empty')}
              </TableCell>
            </TableRow>
          ) : (
            list.map((r) => (
              <TableRow key={r.id} className="transition-colors hover:bg-muted/30">
                <TableCell className="px-4 py-2.5 font-mono text-xs">
                  {r.agentId ? r.agentId.slice(0, 8) : '-'}
                </TableCell>
                <TableCell className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                  {r.userId ? r.userId.slice(0, 8) : '-'}
                </TableCell>
                <TableCell className="px-4 py-2.5">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                      STATUS_CLASS[r.status] ?? STATUS_CLASS.pending,
                    )}
                  >
                    {t(`status${r.status.charAt(0).toUpperCase()}${r.status.slice(1)}`)}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-muted-foreground">
                  <span className="break-words">{r.reason || '-'}</span>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                  {dateFmt.format(new Date(r.createdAt))}
                </TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  {r.status === 'pending' ? (
                    <div className="flex justify-end gap-1">
                      <HasPermi code="demandsquare:approve">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onApprove(r.id)}
                          disabled={approvePending}
                          title={t('approve')}
                        >
                          <Check className="h-4 w-4 text-emerald-600" />
                        </Button>
                      </HasPermi>
                      <HasPermi code="demandsquare:reject">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onReject(r)}
                          disabled={rejectPending}
                          title={t('reject')}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </HasPermi>
                    </div>
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
