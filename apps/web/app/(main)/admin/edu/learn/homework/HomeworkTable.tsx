'use client'
import { Edit, Trash2, Loader2, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '@ihui/ui-react'
import { useTranslations } from 'next-intl'
import { isNotFound } from '@/lib/api-error'
import { Tooltip } from '@/components/feedback'
import { STATUS_MAP } from './helpers'
import type { Homework } from './types'

interface Props {
  rows: Homework[]
  isLoading: boolean
  error: unknown
  onEdit: (h: Homework) => void
  onDelete: (h: Homework) => void
  deletePending: boolean
}

const COLSPAN = 6

export function HomeworkTable({ rows, isLoading, error, onEdit, onDelete, deletePending }: Props) {
  const t = useTranslations('admin.edu.learn.homework')
  const noEndpoint = isNotFound(error)
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colTitle')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colLesson')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colDueDate')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colSubmitCount')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
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
          ) : noEndpoint ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noEndpoint')}
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noData')}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((h) => {
              const st = STATUS_MAP[h.status] ?? {
                labelKey: '',
                cls: 'bg-muted text-muted-foreground',
              }
              return (
                <TableRow key={h.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">{h.title}</TableCell>
                  <TableCell className="px-4 py-2.5">{h.lessonTitle ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5 text-xs">{h.dueDate ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{h.submitCount}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                        st.cls,
                      )}
                    >
                      {st.labelKey ? t(st.labelKey) : h.status}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip content={t('edit')}>
                        <Button variant="ghost" size="sm" onClick={() => onEdit(h)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Tooltip>
                      <Tooltip content={t('delete')}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(h)}
                          className="text-destructive hover:text-destructive"
                          disabled={deletePending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </Tooltip>
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
