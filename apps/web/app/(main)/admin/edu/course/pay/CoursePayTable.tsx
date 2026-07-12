'use client'

import { Loader2, Edit, Trash2, CreditCard } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { PERM } from './helpers'
import type { CoursePay } from './types'

interface Props {
  list: CoursePay[]
  isLoading: boolean
  error: unknown
  deletePending: boolean
  onEdit: (item: CoursePay) => void
  onDelete: (item: CoursePay) => void
}

export function CoursePayTable({ list, isLoading, error, deletePending, onEdit, onDelete }: Props) {
  const t = useTranslations('admin.edu.course.pay')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">ID</TableHead>
            <TableHead className="px-4 py-2.5">{t('courseTitle')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('payTypeLabel')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('payCrowdLabel')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('amount')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('creator')}</TableHead>
            <TableHead className="px-4 py-2.5 text-right">{t('actions')}</TableHead>
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
                {(error as Error).message}
              </TableCell>
            </TableRow>
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                <CreditCard className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('empty')}
              </TableCell>
            </TableRow>
          ) : (
            list.map((r) => (
              <TableRow key={r.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5">{r.id}</TableCell>
                <TableCell className="px-4 py-2.5 font-medium">{r.title ?? r.courseId}</TableCell>
                <TableCell className="px-4 py-2.5">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                      r.payType === 0
                        ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                        : r.payType === 2
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
                    )}
                  >
                    {t(`payType.${r.payType}`)}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-2.5">{t(`payCrowd.${r.payCrowd}`)}</TableCell>
                <TableCell className="px-4 py-2.5">{r.amount}</TableCell>
                <TableCell className="px-4 py-2.5">{r.nickname ?? r.creator ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <HasPermi code={`${PERM}edit`}>
                      <Button variant="ghost" size="sm" onClick={() => onEdit(r)} title={t('edit')}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </HasPermi>
                    <HasPermi code={`${PERM}remove`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(r)}
                        title={t('delete')}
                        className="text-destructive hover:text-destructive"
                        disabled={deletePending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </HasPermi>
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
