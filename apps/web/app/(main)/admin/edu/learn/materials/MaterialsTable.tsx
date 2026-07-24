'use client'

import { Loader2, Edit, Trash2, FolderTree, Download } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { TYPE_MAP } from './helpers'
import type { Material } from './types'

const COLSPAN = 5

interface Props {
  rows: Material[]
  isLoading: boolean
  noEndpoint: boolean
  onEdit: (m: Material) => void
  onDelete: (id: string) => void
  deletePending: boolean
}

export function MaterialsTable({
  rows,
  isLoading,
  noEndpoint,
  onEdit,
  onDelete,
  deletePending,
}: Props) {
  const t = useTranslations('admin.edu.learn.materials')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colTitle')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colType')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colSize')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colDownloads')}</TableHead>
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
                <FolderTree className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('endpointNotConfigured')}
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <FolderTree className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('empty')}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((m) => (
              <TableRow key={m.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5 font-medium">{m.title}</TableCell>
                <TableCell className="px-4 py-2.5">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-sky-500/10 text-sky-600 dark:text-sky-400',
                    )}
                  >
                    {TYPE_MAP[m.type] ? t(TYPE_MAP[m.type] as string) : m.type}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-2.5">
                  {m.fileSize > 0 ? `${(m.fileSize / 1024).toFixed(1)} KB` : '-'}
                </TableCell>
                <TableCell className="px-4 py-2.5">
                  <span className="inline-flex items-center gap-1">
                    <Download className="h-3.5 w-3.5 text-muted-foreground" />
                    {m.downloadCount}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip content={t('edit')}>
                      <Button variant="ghost" size="sm" onClick={() => onEdit(m)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                    <Tooltip content={t('delete')}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(m.id)}
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
