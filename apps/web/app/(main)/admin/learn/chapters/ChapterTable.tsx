'use client'

import { useTranslations } from 'next-intl'
import { Loader2, Edit, Trash2, ListOrdered } from 'lucide-react'
import { Button, Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@ihui/ui'
import type { Chapter } from './types'

interface Props {
  list: Chapter[]
  isLoading: boolean
  error: Error | null
  lessonId: string
  deletePending: boolean
  onEdit: (ch: Chapter) => void
  onDelete: (ch: Chapter) => void
}

export function ChapterTable({
  list,
  isLoading,
  error,
  lessonId,
  deletePending,
  onEdit,
  onDelete,
}: Props) {
  const t = useTranslations('admin.learn')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colTitle')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colSort')}</TableHead>
            <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {!lessonId ? (
            <TableRow>
              <TableCell colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                <ListOrdered className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noLessonSelected')}
              </TableCell>
            </TableRow>
          ) : isLoading ? (
            <TableRow>
              <TableCell colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                {t('loading')}
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={3} className="px-4 py-10 text-center text-destructive">
                {error.message}
              </TableCell>
            </TableRow>
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                <ListOrdered className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noData')}
              </TableCell>
            </TableRow>
          ) : (
            list.map((ch) => (
              <TableRow key={ch.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5 font-medium">{ch.title}</TableCell>
                <TableCell className="px-4 py-2.5">{ch.sortOrder}</TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onEdit(ch)} title={t('edit')}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(ch)}
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
