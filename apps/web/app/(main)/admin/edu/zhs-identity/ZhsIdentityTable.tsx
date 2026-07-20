'use client'

import { useTranslations } from 'next-intl'
import { Loader2, Edit, Trash2, BadgeCheck } from 'lucide-react'
import { Button, Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@ihui/ui'
import { HasPermi } from '@/components/auth/HasPermi'
import { Tooltip } from '@/components/feedback'
import type { ZhsIdentity } from './types'
import { fmt, PERM } from './helpers'

interface Props {
  list: ZhsIdentity[]
  isLoading: boolean
  error: Error | null
  onEdit: (r: ZhsIdentity) => void
  onDelete: (r: ZhsIdentity) => void
  deletePending: boolean
}

export function ZhsIdentityTable({
  list,
  isLoading,
  error,
  onEdit,
  onDelete,
  deletePending,
}: Props) {
  const t = useTranslations('admin.eduZhsIdentity')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">ID</TableHead>
            <TableHead className="px-4 py-2.5">UUID</TableHead>
            <TableHead className="px-4 py-2.5">{t('colName')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colPlatformId')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colOrganizationId')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colImage')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colCross')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colCreator')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colCreatedAt')}</TableHead>
            <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                {t('loading')}
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={10} className="px-4 py-10 text-center text-destructive">
                {error.message}
              </TableCell>
            </TableRow>
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                <BadgeCheck className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('empty')}
              </TableCell>
            </TableRow>
          ) : (
            list.map((r) => (
              <TableRow key={r.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5">{r.id}</TableCell>
                <TableCell className="px-4 py-2.5 font-medium">{r.uuid}</TableCell>
                <TableCell className="px-4 py-2.5">{r.name}</TableCell>
                <TableCell className="px-4 py-2.5">{r.platformId}</TableCell>
                <TableCell className="px-4 py-2.5">{r.organizationId}</TableCell>
                <TableCell className="px-4 py-2.5">
                  {r.binding ? (
                    <img
                      src={r.binding}
                      alt={r.name || '身份图'}
                      className="h-10 w-10 rounded object-cover"
                    />
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell className="px-4 py-2.5">
                  {r.isCross === 1 ? t('yes') : t('no')}
                </TableCell>
                <TableCell className="px-4 py-2.5">{r.creator ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5">{fmt(r.createdAt)}</TableCell>
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
