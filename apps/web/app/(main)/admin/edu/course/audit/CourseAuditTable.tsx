'use client'

import { Loader2, ClipboardCheck, Eye } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { Tooltip } from '@/components/feedback'
import { PERM, fmt, statusClass } from './helpers'
import type { Audit } from './types'

interface Props {
  list: Audit[]
  isLoading: boolean
  error: unknown
  onAudit: (item: Audit) => void
}

export function CourseAuditTable({ list, isLoading, error, onAudit }: Props) {
  const t = useTranslations('admin.edu.course.audit')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">ID</TableHead>
            <TableHead className="px-4 py-2.5">{t('column.type')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('column.operate')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('column.sourceId')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('column.targetId')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('column.status')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('column.creator')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('column.createdAt')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('column.updator')}</TableHead>
            <TableHead className="px-4 py-2.5 text-right">{t('column.actions')}</TableHead>
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
                {(error as Error).message}
              </TableCell>
            </TableRow>
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                <ClipboardCheck className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('empty')}
              </TableCell>
            </TableRow>
          ) : (
            list.map((r) => (
              <TableRow key={r.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5">{r.id}</TableCell>
                <TableCell className="px-4 py-2.5">{t(`type.${r.type}`)}</TableCell>
                <TableCell className="px-4 py-2.5">{r.operate}</TableCell>
                <TableCell className="px-4 py-2.5">{r.sourceId}</TableCell>
                <TableCell className="px-4 py-2.5">{r.targetId}</TableCell>
                <TableCell className="px-4 py-2.5">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                      statusClass(r.status),
                    )}
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        r.status === 3
                          ? 'bg-emerald-500'
                          : r.status === 1
                            ? 'bg-amber-500'
                            : 'bg-muted-foreground',
                      )}
                    />
                    {t(`status.${r.status}`)}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-2.5">{r.creator ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5">{fmt(r.createdAt)}</TableCell>
                <TableCell className="px-4 py-2.5">{r.updator ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <HasPermi code={`${PERM}edit`}>
                    <Tooltip content={t('auditCompare')}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onAudit(r)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                  </HasPermi>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
