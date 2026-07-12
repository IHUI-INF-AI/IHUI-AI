'use client'

import { useTranslations } from 'next-intl'
import { Loader2, Users, Edit, Trash2 } from 'lucide-react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { STATUS_CLASS } from './helpers'
import type { ClassGroup } from './types'

interface Props {
  list: ClassGroup[]
  isLoading: boolean
  noEndpoint: boolean
  deletePending: boolean
  onEdit: (c: ClassGroup) => void
  onDelete: (c: ClassGroup) => void
}

export function EduClassTable({
  list,
  isLoading,
  noEndpoint,
  deletePending,
  onEdit,
  onDelete,
}: Props) {
  const t = useTranslations('admin.edu.class')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colClass')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colCourse')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colTeacher')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colStudents')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colPeriod')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
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
          ) : noEndpoint ? (
            <TableRow>
              <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('endpointNotConfigured')}
              </TableCell>
            </TableRow>
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('empty')}
              </TableCell>
            </TableRow>
          ) : (
            list.map((c) => {
              const stCls = STATUS_CLASS[c.status] ?? 'bg-muted text-muted-foreground'
              const stLabel =
                c.status === 'active'
                  ? t('statusActive')
                  : c.status === 'pending'
                    ? t('statusPending')
                    : c.status === 'ended'
                      ? t('statusEnded')
                      : c.status
              return (
                <TableRow key={c.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">{c.name}</TableCell>
                  <TableCell className="px-4 py-2.5">{c.courseName ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{c.teacherName ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{c.studentCount}</TableCell>
                  <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                    {c.startDate} ~ {c.endDate}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        stCls,
                      )}
                    >
                      {stLabel}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => onEdit(c)} title={t('edit')}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(c)}
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
