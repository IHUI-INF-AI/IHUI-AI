'use client'
import { Edit, Trash2, Loader2, UserCog, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '@ihui/ui'
import { useTranslations } from 'next-intl'
import { Tooltip } from '@/components/feedback'
import type { Teacher } from './types'

interface Props {
  rows: Teacher[]
  isLoading: boolean
  error: Error | null
  onEdit: (tc: Teacher) => void
  onDelete: (tc: Teacher) => void
  deletePending: boolean
}

const COLSPAN = 7

export function TeacherTable({ rows, isLoading, error, onEdit, onDelete, deletePending }: Props) {
  const t = useTranslations('admin.edu.teacher')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colNickname')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colTitle')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colCourses')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colStudents')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colRating')}</TableHead>
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
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-destructive">
                {error.message}
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <UserCog className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('empty')}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((tc) => (
              <TableRow key={tc.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5">
                  <div className="font-medium">{tc.nickname}</div>
                  {tc.phone && <div className="text-xs text-muted-foreground">{tc.phone}</div>}
                </TableCell>
                <TableCell className="px-4 py-2.5">{tc.title}</TableCell>
                <TableCell className="px-4 py-2.5">{tc.courseCount}</TableCell>
                <TableCell className="px-4 py-2.5">{tc.studentCount}</TableCell>
                <TableCell className="px-4 py-2.5">
                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    {tc.rating.toFixed(1)}
                    <Star className="h-3 w-3 fill-current" />
                  </span>
                </TableCell>
                <TableCell className="px-4 py-2.5">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                      tc.status === 1
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {tc.status === 1 ? t('statusActive') : t('statusInactive')}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip content={t('edit')}>
                      <Button variant="ghost" size="sm" onClick={() => onEdit(tc)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                    <Tooltip content={t('delete')}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(tc)}
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
