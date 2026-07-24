'use client'

import { useTranslations } from 'next-intl'
import { Loader2, ClipboardList, CheckCircle2 } from 'lucide-react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '@ihui/ui-react'
import { Tooltip } from '@/components/feedback'
import type { MarkRecord } from './types'

const COLSPAN = 5

interface Props {
  records: MarkRecord[]
  isLoading: boolean
  error: unknown
  onGrade: (id: string) => void
}

export function GradesTable({ records, isLoading, error, onGrade }: Props) {
  const t = useTranslations('admin.edu.exam.grades')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colUser')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colPaper')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colScore')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colSubmittedAt')}</TableHead>
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
                {(error as Error).message}
              </TableCell>
            </TableRow>
          ) : records.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noData')}
              </TableCell>
            </TableRow>
          ) : (
            records.map((r) => (
              <TableRow key={r.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5">{r.userName ?? r.userId.slice(0, 8)}</TableCell>
                <TableCell className="px-4 py-2.5">
                  {r.paperTitle ?? r.paperId.slice(0, 8)}
                </TableCell>
                <TableCell className="px-4 py-2.5 font-medium">{Number(r.score)}</TableCell>
                <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                  {r.submittedAt ?? '-'}
                </TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <Tooltip content={t('grade')}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onGrade(r.id)}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {t('grade')}
                    </Button>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
