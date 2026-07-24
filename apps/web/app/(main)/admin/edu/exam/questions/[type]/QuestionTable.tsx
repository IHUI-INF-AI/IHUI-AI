'use client'

import { Loader2, Edit, Trash2, ListChecks } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '@ihui/ui-react'
import type { Question } from './types'

interface Props {
  list: Question[]
  isLoading: boolean
  error: Error | null
  hasPaper: boolean
  label: string
  onEdit: (q: Question) => void
  onDelete: (q: Question) => void
  deletePending: boolean
}

export function QuestionTable({
  list,
  isLoading,
  error,
  hasPaper,
  label,
  onEdit,
  onDelete,
  deletePending,
}: Props) {
  const t = useTranslations('admin.edu.exam.questionsType')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('stem')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('score')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('sort')}</TableHead>
            <TableHead className="px-4 py-2.5 text-right">{t('actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {!hasPaper ? (
            <TableRow>
              <TableCell colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                <ListChecks className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('paperRequired')}
              </TableCell>
            </TableRow>
          ) : isLoading ? (
            <TableRow>
              <TableCell colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                {t('loading')}
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={4} className="px-4 py-10 text-center text-destructive">
                {error.message}
              </TableCell>
            </TableRow>
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                <ListChecks className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noDataWithType', { type: label })}
              </TableCell>
            </TableRow>
          ) : (
            list.map((q) => (
              <TableRow key={q.id} className="hover:bg-muted/30">
                <TableCell className="max-w-md break-words px-4 py-2.5">{q.title}</TableCell>
                <TableCell className="px-4 py-2.5">{Number(q.score)}</TableCell>
                <TableCell className="px-4 py-2.5">{q.sortOrder}</TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onEdit(q)} title={t('edit')}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(q)}
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
