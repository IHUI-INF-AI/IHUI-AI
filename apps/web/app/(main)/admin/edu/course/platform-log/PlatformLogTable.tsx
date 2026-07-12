'use client'

import { Loader2, Edit, Trash2, FileText } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@ihui/ui'
import { HasPermi } from '@/components/auth/HasPermi'
import type { PlatformLog } from './types'
import { fmt, PERM } from './helpers'

interface Props {
  list: PlatformLog[]
  isLoading: boolean
  error: Error | null
  onEdit: (r: PlatformLog) => void
  onDelete: (r: PlatformLog) => void
  deletePending: boolean
}

export function PlatformLogTable({
  list,
  isLoading,
  error,
  onEdit,
  onDelete,
  deletePending,
}: Props) {
  const t = useTranslations('admin.edu.course.platformLog')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">ID</TableHead>
            <TableHead className="px-4 py-2.5">{t('platformId')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('courseId')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('videoId')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('typeLabel')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('creator')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('sysCreator')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('createdAt')}</TableHead>
            <TableHead className="px-4 py-2.5 text-right">{t('actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                {t('loading')}
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={9} className="px-4 py-10 text-center text-destructive">
                {error.message}
              </TableCell>
            </TableRow>
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('empty')}
              </TableCell>
            </TableRow>
          ) : (
            list.map((r) => (
              <TableRow key={r.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5">{r.id}</TableCell>
                <TableCell className="px-4 py-2.5">{r.platformId}</TableCell>
                <TableCell className="px-4 py-2.5">{r.courseId}</TableCell>
                <TableCell className="px-4 py-2.5">{r.videoId}</TableCell>
                <TableCell className="px-4 py-2.5">{r.type}</TableCell>
                <TableCell className="px-4 py-2.5">{r.creator}</TableCell>
                <TableCell className="px-4 py-2.5">{r.sysCreator}</TableCell>
                <TableCell className="px-4 py-2.5">{fmt(r.createdAt)}</TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <HasPermi code={`${PERM}edit`}>
                      <Button variant="ghost" size="sm" onClick={() => onEdit(r)} title={t('edit')}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </HasPermi>
                    <HasPermi code={`${PERM}remove`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(r)}
                        title={t('delete')}
                        className="text-destructive hover:text-destructive"
                        disabled={deletePending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </HasPermi>
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
