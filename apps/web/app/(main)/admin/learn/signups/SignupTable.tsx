'use client'

import { Loader2, ClipboardList } from 'lucide-react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { statusBadgeClass, statusDotClass } from './helpers'
import { STATUS_OPTIONS } from './types'
import type { SignupRow } from './types'
import { SignupRowStatus } from './SignupDialog'
import { formatDate } from '@/lib/date-utils'

interface Props {
  rows: SignupRow[]
  isLoading: boolean
  error: Error | null
  pending: boolean
  onStatusChange: (id: string, status: number) => void
  t: (k: string) => string
}

export function SignupTable({ rows, isLoading, error, pending, onStatusChange, t }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colLesson')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colUser')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colPhone')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colSignupStatus')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colCreatedAt')}</TableHead>
            <TableHead className="px-4 py-2.5 text-right">{t('updateStatus')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                {t('loading')}
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={6} className="px-4 py-10 text-center text-destructive">
                {error.message}
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                <ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('signupsNoData')}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const status = row.status
              return (
                <TableRow key={row.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">
                    {row.lessonTitle ?? row.lessonId}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">{row.nickname ?? row.userId}</TableCell>
                  <TableCell className="px-4 py-2.5">{row.phone ?? '—'}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        statusBadgeClass(status),
                      )}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full', statusDotClass(status))} />
                      {t(
                        STATUS_OPTIONS.find((o) => Number(o.value) === status)?.key ??
                          'statusPending',
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    {formatDate(row.createdAt)}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <SignupRowStatus
                      status={status}
                      pending={pending}
                      onChange={(v) => onStatusChange(row.id, v)}
                      t={t}
                    />
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
