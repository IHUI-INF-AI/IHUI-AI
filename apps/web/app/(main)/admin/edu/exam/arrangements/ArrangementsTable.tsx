'use client'

import { Loader2, Edit, Trash2, CalendarClock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@ihui/ui-react'
import { Tooltip } from '@/components/feedback'
import type { Arrangement, Paper } from './types'

const COLSPAN = 7

interface Props {
  rows: Arrangement[]
  isLoading: boolean
  error: Error | null
  papers: Paper[]
  onEdit: (a: Arrangement) => void
  onDelete: (id: string) => void
  deletePending: boolean
}

export function ArrangementsTable({
  rows,
  isLoading,
  error,
  papers,
  onEdit,
  onDelete,
  deletePending,
}: Props) {
  const t = useTranslations('admin.edu.exam.arrangements')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colPaper')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colStartTime')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colEndTime')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colRoom')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colInvigilator')}</TableHead>
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
          ) : error ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <CalendarClock className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noDataError')}
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <CalendarClock className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noData')}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((a) => (
              <TableRow key={a.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5">
                  {a.paperTitle ??
                    papers.find((p) => p.id === a.paperId)?.title ??
                    a.paperId.slice(0, 8)}
                </TableCell>
                <TableCell className="px-4 py-2.5 text-xs">{a.startTime}</TableCell>
                <TableCell className="px-4 py-2.5 text-xs">{a.endTime}</TableCell>
                <TableCell className="px-4 py-2.5">{a.room}</TableCell>
                <TableCell className="px-4 py-2.5">{a.invigilator}</TableCell>
                <TableCell className="px-4 py-2.5">
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs">{a.status}</span>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip content={t('edit')}>
                      <Button variant="ghost" size="sm" onClick={() => onEdit(a)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                    <Tooltip content={t('delete')}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(a.id)}
                        className="text-destructive hover:text-destructive"
                        disabled={deletePending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </Tooltip>
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
