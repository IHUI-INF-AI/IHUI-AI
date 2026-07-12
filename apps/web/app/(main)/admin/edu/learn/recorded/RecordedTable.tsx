'use client'

import Image from 'next/image'
import { Loader2, Edit, Trash2, FileStack } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Button,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Checkbox,
} from '@ihui/ui'
import { HasPermi } from '@/components/auth/HasPermi'
import { PERM, badgeCls } from './helpers'
import type { Video } from './types'

const COLSPAN = 14

interface Props {
  rows: Video[]
  isLoading: boolean
  error: Error | null
  ids: string[]
  allChecked: boolean
  onToggleAll: () => void
  onToggleOne: (id: string) => void
  onEdit: (r: Video) => void
  onDelete: (r: Video) => void
  deletePending: boolean
}

export function RecordedTable({
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
  const t = useTranslations('admin.edu.learn.recorded')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-3 py-2.5 w-10">
              <Checkbox checked={allChecked} onCheckedChange={onToggleAll} />
            </TableHead>
            <TableHead className="px-4 py-2.5">{t('colId')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colCourseId')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colCover')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colTitle')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colLecturer')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colDuration')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colPay')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colAmount')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colLabel')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colLevel')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colAudit')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colCreator')}</TableHead>
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
          ) : error ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-destructive">
                {error.message}
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <FileStack className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noData')}
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
                <TableCell className="px-4 py-2.5 text-xs">{r.courseId ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5">
                  {r.binding ? (
                    <Image
                      src={r.binding}
                      alt=""
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded object-cover"
                    />
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell className="px-4 py-2.5 font-medium">{r.title}</TableCell>
                <TableCell className="px-4 py-2.5 text-xs">{r.lecturer ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5 text-xs">{r.duration ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5">
                  <span className={badgeCls(r.isPay === 1)}>
                    {r.isPay === 1 ? t('payPaid') : t('payFree')}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-xs">{r.amount ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5 text-xs">{r.label ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5">
                  <span className={badgeCls(r.status === 2)}>{t(`level.${r.status ?? 0}`)}</span>
                </TableCell>
                <TableCell className="px-4 py-2.5">
                  <span className={badgeCls(r.auditStatus === 4)}>
                    {t(`audit.${r.auditStatus ?? 0}`)}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-xs">
                  {r.nickname ?? r.creator ?? '-'}
                </TableCell>
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
