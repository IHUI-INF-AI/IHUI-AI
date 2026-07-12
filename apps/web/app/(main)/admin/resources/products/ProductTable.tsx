'use client'

import { Loader2, Edit, Trash2, Package } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@ihui/ui'
import { cn } from '@/lib/utils'
import type { Product } from './types'

interface Props {
  list: Product[]
  isLoading: boolean
  error: unknown
  deletePending: boolean
  onEdit: (p: Product) => void
  onDelete: (p: Product) => void
}

export function ProductTable({ list, isLoading, error, deletePending, onEdit, onDelete }: Props) {
  const t = useTranslations('admin.resources')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colName')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colResource')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colPrice')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colOriginalPrice')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
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
                {(error as Error).message}
              </TableCell>
            </TableRow>
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                <Package className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noData')}
              </TableCell>
            </TableRow>
          ) : (
            list.map((p) => {
              const published = p.isPublished
              return (
                <TableRow key={p.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5">
                    <div className="font-medium">{p.name}</div>
                    {p.description ? (
                      <div className="max-w-xs break-words text-xs text-muted-foreground">
                        {p.description}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    {p.resourceName ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">¥{Number(p.price)}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    {p.originalPrice ? `¥${Number(p.originalPrice)}` : '—'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        published
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          published ? 'bg-emerald-500' : 'bg-muted-foreground',
                        )}
                      />
                      {published ? t('published') : t('unpublished')}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => onEdit(p)} title={t('edit')}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(p)}
                        title={t('delete')}
                        className="text-destructive hover:text-destructive"
                        disabled={deletePending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
