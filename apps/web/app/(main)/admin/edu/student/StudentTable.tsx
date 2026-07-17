'use client'
import { Edit, Trash2, Loader2, GraduationCap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '@ihui/ui'
import { useTranslations } from 'next-intl'
import { LEVEL_MAP } from './helpers'
import type { Student } from './types'

interface Props {
  rows: Student[]
  isLoading: boolean
  error: Error | null
  onEdit: (s: Student) => void
  onDelete: (s: Student) => void
  deletePending: boolean
}

const COLSPAN = 7

export function StudentTable({ rows, isLoading, error, onEdit, onDelete, deletePending }: Props) {
  const t = useTranslations('admin.edu.student')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colNickname')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colContact')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colLevel')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colSignup')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colLearnHours')}</TableHead>
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
                <GraduationCap className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('empty')}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((s) => (
              <TableRow key={s.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5 font-medium">
                  {s.nickname ?? s.id.slice(0, 8)}
                </TableCell>
                <TableCell className="px-4 py-2.5 text-xs">{s.phone ?? s.email ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5">
                  <span className="inline-flex items-center rounded-md bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-600 dark:text-sky-400">
                    {LEVEL_MAP[s.level] ? t(`level.${LEVEL_MAP[s.level]}`) : `L${s.level}`}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-2.5">{s.signupCount}</TableCell>
                <TableCell className="px-4 py-2.5">{s.learnHours}h</TableCell>
                <TableCell className="px-4 py-2.5">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                      s.status === 1
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {s.status === 1 ? t('statusActive') : t('statusDisabled')}
                  </span>
                </TableCell>
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
