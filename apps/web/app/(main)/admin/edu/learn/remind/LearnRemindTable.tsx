'use client'

import { Loader2, Edit, Trash2, Bell } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@ihui/ui'
import type { Remind } from './types'

interface Props {
  list: Remind[]
  isLoading: boolean
  noEndpoint: boolean
  onEdit: (r: Remind) => void
  onDelete: (id: string) => void
  deletePending: boolean
}

export function LearnRemindTable({
  list,
  isLoading,
  noEndpoint,
  onEdit,
  onDelete,
  deletePending,
}: Props) {
  const t = useTranslations('admin.edu.learn.remind')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colTitle')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colType')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colRemindAt')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colRead')}</TableHead>
            <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                {t('loading')}
              </TableCell>
            </TableRow>
          ) : noEndpoint ? (
            <TableRow>
              <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                <Bell className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noEndpoint')}
              </TableCell>
            </TableRow>
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                <Bell className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noData')}
              </TableCell>
            </TableRow>
          ) : (
            list.map((r) => (
              <TableRow key={r.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5">
                  <div className="font-medium">{r.title}</div>
                  {r.content && (
                    <div className="max-w-xs break-words text-xs text-muted-foreground">
                      {r.content}
                    </div>
                  )}
                </TableCell>
                <TableCell className="px-4 py-2.5">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-sky-500/10 text-sky-600 dark:text-sky-400',
                    )}
                  >
                    {t(`type.${r.type}`)}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                  {r.remindAt}
                </TableCell>
                <TableCell className="px-4 py-2.5">
                  {r.isRead ? (
                    <span className="text-xs text-muted-foreground">{t('read')}</span>
                  ) : (
                    <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
                      {t('unread')}
                    </span>
                  )}
                </TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onEdit(r)} title={t('edit')}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(r.id)}
                      title={t('delete')}
                      className="text-destructive hover:text-destructive"
                      disabled={deletePending}
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
