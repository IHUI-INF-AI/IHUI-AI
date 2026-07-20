'use client'
import { Edit, Trash2, Loader2, Wallet } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { HasPermi } from '@/components/auth/HasPermi'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button,
  Checkbox,
} from '@ihui/ui'
import { Tooltip } from '@/components/feedback'
import { PERM } from './helpers'
import type { PayLog } from './types'
import { formatDate } from '@/lib/date-utils'

interface Props {
  rows: PayLog[]
  isLoading: boolean
  error: Error | null
  ids: string[]
  allChecked: boolean
  onToggleAll: () => void
  onToggleOne: (id: string) => void
  onEdit: (r: PayLog) => void
  onDelete: (r: PayLog) => void
  deletePending: boolean
}

const COLSPAN = 11

export function PayLogTable({
  rows,
  isLoading,
  error,
  ids,
  allChecked,
  onToggleAll,
  onToggleOne,
  onEdit,
  onDelete,
  deletePending,
}: Props) {
  const t = useTranslations('admin.edu.finance.index')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-3 py-2.5 w-10">
              <Checkbox checked={allChecked} onCheckedChange={onToggleAll} />
            </TableHead>
            <TableHead className="px-4 py-2.5">ID</TableHead>
            <TableHead className="px-4 py-2.5">{t('colUserUuid')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colCourseId')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colVideoId')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colOutBillOn')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colPayWay')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colAmount')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colRealAmount')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colCreatedAt')}</TableHead>
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
                {error.message}
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <Wallet className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('empty')}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.id} className="hover:bg-muted/30">
                <TableCell className="px-3 py-2.5">
                  <Checkbox
                    checked={ids.includes(r.id)}
                    onCheckedChange={() => onToggleOne(r.id)}
                  />
                </TableCell>
                <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">{r.id}</TableCell>
                <TableCell className="px-4 py-2.5 text-xs font-mono">{r.userUuid}</TableCell>
                <TableCell className="px-4 py-2.5 text-xs">{r.courseId ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5 text-xs">{r.videoId ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5 text-xs">{r.outBillOn ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5 text-xs">{r.payWay ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5 font-semibold">{r.amount ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5 font-semibold text-emerald-600">
                  {r.realAmount ?? '-'}
                </TableCell>
                <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                  {r.createdAt ? formatDate(r.createdAt) : '-'}
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
