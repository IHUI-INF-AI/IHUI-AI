'use client'
import { Edit, Trash2, Loader2, Star } from 'lucide-react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '@ihui/ui'
import { useTranslations } from 'next-intl'
import { isNotFound } from '@/lib/api-error'
import type { Level } from './types'

interface Props {
  rows: Level[]
  isLoading: boolean
  error: unknown
  onEdit: (l: Level) => void
  onDelete: (l: Level) => void
  deletePending: boolean
}

const COLSPAN = 5

export function LevelTable({ rows, isLoading, error, onEdit, onDelete, deletePending }: Props) {
  const t = useTranslations('admin.edu.student.levels')
  const noEndpoint = isNotFound(error)
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colLevel')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colName')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colScoreRange')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colDiscount')}</TableHead>
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
          ) : noEndpoint ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <Star className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noEndpoint')}
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <Star className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noLevels')}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((l) => (
              <TableRow key={l.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/10 text-xs font-bold text-amber-600 dark:text-amber-400">
                    L{l.level}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-2.5 font-medium">{l.name}</TableCell>
                <TableCell className="px-4 py-2.5 text-xs">
                  {l.minScore} ~ {l.maxScore}
                </TableCell>
                <TableCell className="px-4 py-2.5">
                  {(l.discount * 10).toFixed(1)} {t('discountUnit')}
                </TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onEdit(l)} title={t('edit')}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(l)}
                      title={t('delete')}
                      className="text-destructive hover:text-destructive"
                      disabled={deletePending}
                    >
                      <Trash2 className="h-4 w-4" />
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
