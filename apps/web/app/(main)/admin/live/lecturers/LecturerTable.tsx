'use client'

import { Loader2, Edit, Trash2, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import type { Lecturer } from './types'

interface Props {
  list: Lecturer[]
  isLoading: boolean
  error: Error | null
  onEdit: (l: Lecturer) => void
  onDelete: (l: Lecturer) => void
  deletePending: boolean
}

export function LecturerTable({ list, isLoading, error, onEdit, onDelete, deletePending }: Props) {
  const t = useTranslations('admin.live')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colName')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colTitle')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colSort')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
            <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                {t('loading')}
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={5} className="px-4 py-10 text-center text-destructive">
                {error.message}
              </TableCell>
            </TableRow>
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noData')}
              </TableCell>
            </TableRow>
          ) : (
            list.map((l) => {
              const enabled = l.status === 1
              return (
                <TableRow key={l.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {l.avatar ? (
                        <img
                          src={l.avatar}
                          alt={l.name}
                          className="h-8 w-8 rounded-lg object-cover"
                        />
                      ) : null}
                      <span className="font-medium">{l.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    {l.title ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">{l.sort}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                        enabled
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          enabled ? 'bg-emerald-500' : 'bg-muted-foreground',
                        )}
                      />
                      {enabled ? t('enabled') : t('disabled')}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
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
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
