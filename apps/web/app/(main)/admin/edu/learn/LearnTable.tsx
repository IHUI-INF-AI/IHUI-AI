'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Edit, Trash2, Loader2, BookOpen, ListOrdered } from 'lucide-react'
import { Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import type { Lesson } from './types'

const COLSPAN = 6

interface Props {
  rows: Lesson[]
  isLoading: boolean
  error: Error | null
  onEdit: (l: Lesson) => void
  onDelete: (l: Lesson) => void
  deletePending: boolean
}

export function LearnTable({ rows, isLoading, error, onEdit, onDelete, deletePending }: Props) {
  const t = useTranslations('admin.edu.learn.index')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colTitle')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colCategory')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colLecturer')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colSignup')}</TableHead>
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
                <BookOpen className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('empty')}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((l) => (
              <TableRow key={l.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5">
                  <div className="font-medium">{l.title}</div>
                  {l.intro ? (
                    <div className="max-w-xs break-words text-xs text-muted-foreground">
                      {l.intro}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="px-4 py-2.5">
                  {l.categoryName ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="px-4 py-2.5">{l.lecturerName ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5">{l.signupCount}</TableCell>
                <TableCell className="px-4 py-2.5">
                  <div className="flex flex-col gap-1">
                    <span
                      className={cn(
                        'inline-flex w-fit items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                        l.isPublished
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          l.isPublished ? 'bg-emerald-500' : 'bg-muted-foreground',
                        )}
                      />
                      {l.isPublished ? t('published') : t('unpublished')}
                    </span>
                    <span
                      className={cn(
                        'inline-flex w-fit items-center rounded-md px-2 py-0.5 text-xs font-medium',
                        l.isFree
                          ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                      )}
                    >
                      {l.isFree ? t('free') : t('paid')}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button asChild variant="ghost" size="sm" title={t('chapters')}>
                      <Link href={`/admin/learn/chapters?lessonId=${l.id}`}>
                        <ListOrdered className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Tooltip content={t('edit')}>
                      <Button variant="ghost" size="sm" onClick={() => onEdit(l)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                    <Tooltip content={t('delete')}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(l)}
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
