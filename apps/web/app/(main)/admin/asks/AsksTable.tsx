'use client'

import { useTranslations, useLocale } from 'next-intl'
import { Edit, Trash2, CheckCircle2, Loader2, HelpCircle } from 'lucide-react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { STATUS_META } from './helpers'
import type { AskItem } from './types'

const COLSPAN = 7

interface Props {
  list: AskItem[]
  isLoading: boolean
  error: Error | null
  auditPending: boolean
  deletePending: boolean
  onEdit: (item: AskItem) => void
  onAudit: (item: AskItem) => void
  onDelete: (item: AskItem) => void
}

export function AsksTable({
  list,
  isLoading,
  error,
  auditPending,
  deletePending,
  onEdit,
  onAudit,
  onDelete,
}: Props) {
  const t = useTranslations('admin.asks')
  const locale = useLocale()
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colTitle')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colUser')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colAnswerCount')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colResolved')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colCreatedAt')}</TableHead>
            <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                {t('loading')}
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-destructive">
                {error.message}
              </TableCell>
            </TableRow>
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <HelpCircle className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noData')}
              </TableCell>
            </TableRow>
          ) : (
            list.map((item) => {
              const meta = STATUS_META[item.status] ??
                STATUS_META[0] ?? {
                  label: 'statusHidden',
                  cls: 'bg-muted text-muted-foreground',
                }
              const user = item.user?.nickname ?? item.userName ?? '-'
              return (
                <TableRow key={item.id} className="hover:bg-muted/30">
                  <TableCell className="max-w-xs px-4 py-2.5">
                    <div className="truncate font-medium" title={item.title}>
                      {item.title}
                    </div>
                    {item.categoryName && (
                      <div className="text-xs text-muted-foreground">{item.categoryName}</div>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">{user}</TableCell>
                  <TableCell className="px-4 py-2.5">{item.answerCount}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    {item.isResolved ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-500">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {t('resolved')}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t('unresolved')}</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                        meta.cls,
                      )}
                    >
                      {t(meta.label)}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    {dateFmt.format(new Date(item.createdAt))}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(item)}
                        title={t('edit')}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {item.status !== 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onAudit(item)}
                          title={t('audit')}
                          disabled={auditPending}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(item)}
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
