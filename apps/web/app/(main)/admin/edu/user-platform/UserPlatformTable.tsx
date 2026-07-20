'use client'

import { useTranslations } from 'next-intl'
import { Loader2, Edit, Trash2, Users } from 'lucide-react'
import { Button, Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@ihui/ui'
import { HasPermi } from '@/components/auth/HasPermi'
import { Tooltip } from '@/components/feedback'
import { cn } from '@/lib/utils'
import { PERM, fmt } from './helpers'
import type { UserPlatform } from './types'

interface Props {
  list: UserPlatform[]
  isLoading: boolean
  error: Error | null
  onEdit: (r: UserPlatform) => void
  onDelete: (r: UserPlatform) => void
  deletePending: boolean
}

export function UserPlatformTable({
  list,
  isLoading,
  error,
  onEdit,
  onDelete,
  deletePending,
}: Props) {
  const t = useTranslations('admin.eduUserPlatform')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colId')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colUserUuid')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colPlatformId')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colIdentityId')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colCreatedAt')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colUpdator')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
            <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                {t('loading')}
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={8} className="px-4 py-10 text-center text-destructive">
                {error.message}
              </TableCell>
            </TableRow>
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noData')}
              </TableCell>
            </TableRow>
          ) : (
            list.map((r) => (
              <TableRow key={r.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5">{r.id}</TableCell>
                <TableCell className="px-4 py-2.5 font-medium">{r.userUuid}</TableCell>
                <TableCell className="px-4 py-2.5">{r.platformId}</TableCell>
                <TableCell className="px-4 py-2.5">{r.identityId}</TableCell>
                <TableCell className="px-4 py-2.5">{fmt(r.createdAt)}</TableCell>
                <TableCell className="px-4 py-2.5">{r.updator ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                      r.status === 0
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        r.status === 0 ? 'bg-emerald-500' : 'bg-muted-foreground',
                      )}
                    />
                    {r.status === 0 ? t('statusNormal') : t('statusDisabled')}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <HasPermi code={`${PERM}edit`}>
                      <Tooltip content={t('edit')}>
                        <Button variant="ghost" size="sm" onClick={() => onEdit(r)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Tooltip>
                    </HasPermi>
                    <HasPermi code={`${PERM}remove`}>
                      <Tooltip content={t('delete')}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(r)}
                          className="text-destructive hover:text-destructive"
                          disabled={deletePending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </Tooltip>
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
