'use client'
import { Edit, Trash2, Loader2, CalendarDays } from 'lucide-react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '@ihui/ui'
import { useTranslations } from 'next-intl'
import { isNotFound } from '@/lib/api-error'
import type { Schedule } from './types'

interface Props {
  rows: Schedule[]
  isLoading: boolean
  error: unknown
  onEdit: (s: Schedule) => void
  onDelete: (s: Schedule) => void
  deletePending: boolean
}

const COLSPAN = 6

export function ScheduleTable({ rows, isLoading, error, onEdit, onDelete, deletePending }: Props) {
  const t = useTranslations('admin.eduClassSchedule')
  const noEndpoint = isNotFound(error)
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colCourse')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colClass')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colTeacher')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colTime')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colLocation')}</TableHead>
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
                <CalendarDays className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('endpointNotConfigured')}
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <CalendarDays className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('empty')}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((s) => (
              <TableRow key={s.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5 font-medium">{s.title}</TableCell>
                <TableCell className="px-4 py-2.5">
                  {s.className ?? s.classId.slice(0, 8)}
                </TableCell>
                <TableCell className="px-4 py-2.5">{s.teacherName ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                  {s.startTime} ~ {s.endTime}
                </TableCell>
                <TableCell className="px-4 py-2.5">{s.location ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onEdit(s)} title={t('edit')}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(s)}
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
