'use client'

import { Loader2, Pencil, Trash2, Bot } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'

import { cn } from '@/lib/utils'
import { Avatar } from '@/components/data/Avatar'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '@ihui/ui'
import { STATUS_CLASS } from './helpers'
import type { Agent, Category } from './types'

interface AgentsTableProps {
  list: Agent[]
  isLoading: boolean
  error: Error | null
  categories: Category[]
  deletePending: boolean
  onEdit: (a: Agent) => void
  onDelete: (a: Agent) => void
}

export function AgentsTable({
  list,
  isLoading,
  error,
  categories,
  deletePending,
  onEdit,
  onDelete,
}: AgentsTableProps) {
  const t = useTranslations('admin.agents')
  const tc = useTranslations('common')
  const locale = useLocale()
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const priceFmt = new Intl.NumberFormat(locale, { style: 'currency', currency: 'CNY' })
  const catName = (id: string | null) =>
    id ? (categories.find((c) => c.categoryId === id)?.name ?? '-') : '-'

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colName')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colCategory')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colPrice')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colSort')}</TableHead>
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
                <Bot className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('empty')}
              </TableCell>
            </TableRow>
          ) : (
            list.map((a) => (
              <TableRow key={a.agentId} className="transition-colors hover:bg-muted/30">
                <TableCell className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Avatar src={a.avatar ?? undefined} name={a.name ?? 'A'} size="sm" />
                    <span className="font-medium">{a.name}</span>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-muted-foreground">
                  {catName(a.categoryId)}
                </TableCell>
                <TableCell className="px-4 py-2.5">
                  {a.isFree ? (
                    <span className="text-emerald-600 dark:text-emerald-500">{t('free')}</span>
                  ) : (
                    priceFmt.format(a.price)
                  )}
                </TableCell>
                <TableCell className="px-4 py-2.5">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                      STATUS_CLASS[a.status] ?? STATUS_CLASS.pending,
                    )}
                  >
                    {t(`status${a.status.charAt(0).toUpperCase()}${a.status.slice(1)}`)}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-muted-foreground">{a.sort}</TableCell>
                <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                  {dateFmt.format(new Date(a.createdAt))}
                </TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => onEdit(a)} title={tc('edit')}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDelete(a)}
                      disabled={deletePending}
                      title={tc('delete')}
                    >
                      <Trash2 className="h-4 w-4" />
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
