'use client'

import { Loader2, Tag, Pencil, Trash2 } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'

import { cn } from '@/lib/utils'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button,
  Switch,
} from '@ihui/ui'
import type { Category } from './types'

interface CategoryTableProps {
  list: Category[]
  isLoading: boolean
  error: Error | null
  togglePaidPending: boolean
  deletePending: boolean
  onEdit: (cat: Category) => void
  onDelete: (cat: Category) => void
  onTogglePaid: (cat: Category, enable: boolean) => void
}

export function CategoryTable({
  list,
  isLoading,
  error,
  togglePaidPending,
  deletePending,
  onEdit,
  onDelete,
  onTogglePaid,
}: CategoryTableProps) {
  const t = useTranslations('admin.agents.categories')
  const tc = useTranslations('common')
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
            <TableHead className="px-4 py-2.5">{t('colName')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colDescription')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colIcon')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colSort')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colPaid')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colCreatedAt')}</TableHead>
            <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                {t('loading')}
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={8} className="px-4 py-10 text-center text-destructive">
                {error.message}
              </TableCell>
            </TableRow>
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                <Tag className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('empty')}
              </TableCell>
            </TableRow>
          ) : (
            list.map((c) => {
              const enabled = c.status === '1'
              return (
                <TableRow key={c.categoryId} className="transition-colors hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">{c.name}</TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    <span className="break-words">{c.description || '-'}</span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    {c.icon || '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">{c.sort}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                        enabled
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          enabled ? 'bg-emerald-500' : 'bg-muted-foreground',
                        )}
                      />
                      {enabled ? t('enabled') : t('disabled')}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <Switch
                      checked={c.isPaid}
                      disabled={togglePaidPending}
                      onCheckedChange={(v) => onTogglePaid(c, v)}
                      aria-label={t('colPaid')}
                    />
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                    {dateFmt.format(new Date(c.createdAt))}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(c)}
                        title={tc('edit')}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm(t('deleteConfirm'))) onDelete(c)
                        }}
                        disabled={deletePending}
                        title={tc('delete')}
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
