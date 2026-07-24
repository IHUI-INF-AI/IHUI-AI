'use client'

import { useTranslations } from 'next-intl'
import { Loader2, Edit, Trash2, LayoutTemplate } from 'lucide-react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '@ihui/ui-react'
import { Tooltip } from '@/components/feedback'
import type { Template } from './types'

interface Props {
  list: Template[]
  isLoading: boolean
  error: unknown
  deletePending: boolean
  onEdit: (t: Template) => void
  onDelete: (t: Template) => void
}

export function PapersTemplateTable({
  list,
  isLoading,
  error,
  deletePending,
  onEdit,
  onDelete,
}: Props) {
  const tc = useTranslations('admin.edu.exam.papersTemplate')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{tc('colName')}</TableHead>
            <TableHead className="px-4 py-2.5">{tc('colDescription')}</TableHead>
            <TableHead className="px-4 py-2.5">{tc('colCreatedAt')}</TableHead>
            <TableHead className="px-4 py-2.5 text-right">{tc('colActions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                {tc('loading')}
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                <LayoutTemplate className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {tc('noTemplateNeedBackend')}
              </TableCell>
            </TableRow>
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                <LayoutTemplate className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {tc('noTemplate')}
              </TableCell>
            </TableRow>
          ) : (
            list.map((t) => (
              <TableRow key={t.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5 font-medium">{t.name}</TableCell>
                <TableCell className="max-w-xs break-words px-4 py-2.5 text-muted-foreground">
                  {t.description ?? '-'}
                </TableCell>
                <TableCell className="px-4 py-2.5 text-xs">{t.createdAt}</TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip content={tc('edit')}>
                      <Button variant="ghost" size="sm" onClick={() => onEdit(t)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                    <Tooltip content={tc('delete')}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(t)}
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
