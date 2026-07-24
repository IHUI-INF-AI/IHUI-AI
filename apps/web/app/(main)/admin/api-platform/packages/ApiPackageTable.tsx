'use client'

import { Loader2, Pencil, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@ihui/ui-react'
import { PERIOD_LABEL_KEY } from './helpers'
import type { ApiPackage } from './types'
import { formatNumber } from '@/lib/date-utils'

interface Props {
  list: ApiPackage[]
  isLoading: boolean
  onEdit: (p: ApiPackage) => void
  onDelete: (id: string) => void
}

export function ApiPackageTable({ list, isLoading, onEdit, onDelete }: Props) {
  const t = useTranslations('adminApiPackages')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="text-xs uppercase">{t('colName')}</TableHead>
            <TableHead className="text-xs uppercase">{t('colPrice')}</TableHead>
            <TableHead className="text-xs uppercase">{t('colQuota')}</TableHead>
            <TableHead className="text-xs uppercase">{t('colPeriod')}</TableHead>
            <TableHead className="text-xs uppercase">{t('colStatus')}</TableHead>
            <TableHead className="text-right text-xs uppercase">{t('colActions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              </TableCell>
            </TableRow>
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                {t('noData')}
              </TableCell>
            </TableRow>
          ) : (
            list.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">
                  {p.name}
                  {p.description && (
                    <div className="text-xs text-muted-foreground">{p.description}</div>
                  )}
                </TableCell>
                <TableCell>¥{p.price}</TableCell>
                <TableCell>{formatNumber(p.quota)}</TableCell>
                <TableCell>{t(PERIOD_LABEL_KEY[p.period])}</TableCell>
                <TableCell>
                  {p.status === 1 ? (
                    <span className="inline-flex rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-600">
                      {t('statusOn')}
                    </span>
                  ) : (
                    <span className="inline-flex rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {t('statusOff')}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => onEdit(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                      {t('edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(t('confirmDelete'))) onDelete(p.id)
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
