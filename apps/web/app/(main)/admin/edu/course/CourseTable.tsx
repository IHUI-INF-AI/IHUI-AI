'use client'
import Link from 'next/link'
import Image from 'next/image'
import { Edit, Trash2, Loader2, BookOpen, Video, CreditCard } from 'lucide-react'
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
import { useTranslations } from 'next-intl'
import { PERM, badgeCls } from './helpers'
import type { Course } from './types'

interface Props {
  rows: Course[]
  isLoading: boolean
  error: Error | null
  ids: string[]
  allChecked: boolean
  onToggleAll: () => void
  onToggleOne: (id: string) => void
  onEdit: (r: Course) => void
  onDelete: (r: Course) => void
  deletePending: boolean
}

const COLSPAN = 13

export function CourseTable({
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
  const t = useTranslations('admin.edu.course.index')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-3 py-2.5 w-10">
              <Checkbox checked={allChecked} onCheckedChange={onToggleAll} />
            </TableHead>
            <TableHead className="px-4 py-2.5">{t('colId')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colTitle')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colSubtitle')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colContent')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colRemark')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colRemarkFile')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colCover')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colStage')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colLabel')}</TableHead>
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
                <BookOpen className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('emptyCourses')}
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
                <TableCell className="px-4 py-2.5 font-medium">{r.title}</TableCell>
                <TableCell className="px-4 py-2.5 text-xs">{r.subtitle ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5">
                  <div
                    className="max-w-[120px] truncate text-xs text-muted-foreground"
                    title={r.content}
                  >
                    {r.content ?? '-'}
                  </div>
                </TableCell>
                <TableCell className="px-4 py-2.5">
                  <div
                    className="max-w-[120px] truncate text-xs text-muted-foreground"
                    title={r.remark}
                  >
                    {r.remark ?? '-'}
                  </div>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-xs">{r.remarkFile ?? '-'}</TableCell>
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
                <TableCell className="px-4 py-2.5">
                  <span className={badgeCls(r.stage === 2)}>{t(`stage.${r.stage ?? 0}`)}</span>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-xs">{r.label ?? '-'}</TableCell>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(r)}
                        title={t('editTitle')}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </HasPermi>
                    <HasPermi code={`${PERM}remove`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(r)}
                        title={t('deleteTitle')}
                        className="text-destructive hover:text-destructive"
                        disabled={deletePending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </HasPermi>
                    <Button asChild variant="ghost" size="sm" title={t('videoManageTitle')}>
                      <Link href={`/admin/edu/learn/recorded?courseId=${r.id}`}>
                        <Video className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm" title={t('priceManageTitle')}>
                      <Link href={`/admin/edu/course/pay?courseId=${r.id}`}>
                        <CreditCard className="h-4 w-4" />
                      </Link>
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
