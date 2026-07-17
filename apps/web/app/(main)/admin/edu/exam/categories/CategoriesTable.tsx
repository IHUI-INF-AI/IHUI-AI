'use client'

import { useTranslations } from 'next-intl'
import { Edit, Trash2, Loader2, FolderTree } from 'lucide-react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '@ihui/ui'
import { cn } from '@/lib/utils'
import type { Category } from './types'

const COLSPAN = 4

interface Props {
  categories: Category[]
  isLoading: boolean
  error: unknown
  deletePending: boolean
  onEdit: (c: Category) => void
  onDelete: (id: string) => void
}

export function CategoriesTable({
  categories,
  isLoading,
  error,
  deletePending,
  onEdit,
  onDelete,
}: Props) {
  const t = useTranslations('admin.edu.exam.categories')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colName')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colSort')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
            <TableHead className="px-4 py-2.5 text-right">{t('colAction')}</TableHead>
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
                {(error as Error).message}
              </TableCell>
            </TableRow>
          ) : categories.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <FolderTree className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noCategories')}
              </TableCell>
            </TableRow>
          ) : (
            categories.map((c) => (
              <TableRow key={c.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5 font-medium">{c.name}</TableCell>
                <TableCell className="px-4 py-2.5">{c.sort}</TableCell>
                <TableCell className="px-4 py-2.5">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                      c.status === 1
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        c.status === 1 ? 'bg-emerald-500' : 'bg-muted-foreground',
                      )}
                    />
                    {c.status === 1 ? t('statusEnabled') : t('statusDisabled')}
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
                      onClick={() => {
                        if (window.confirm(t('confirmDelete'))) onDelete(c.id)
                      }}
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
