'use client'
import { Edit, Trash2, Loader2, Radio } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '@ihui/ui-react'
import { useTranslations } from 'next-intl'
import { Tooltip } from '@/components/feedback'
import { STATUS_MAP } from './helpers'
import type { Live } from './types'

interface Props {
  rows: Live[]
  isLoading: boolean
  error: unknown
  onEdit: (l: Live) => void
  onDelete: (l: Live) => void
  deletePending: boolean
}

const COLSPAN = 5

export function LiveTable({ rows, isLoading, error, onEdit, onDelete, deletePending }: Props) {
  const t = useTranslations('admin.edu.learn.live')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colTitle')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colLecturer')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colStartTime')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
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
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <Radio className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('endpointNotConfigured')}
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <Radio className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('empty')}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((l) => {
              const st = STATUS_MAP[l.status] ?? {
                labelKey: '',
                cls: 'bg-muted text-muted-foreground',
              }
              return (
                <TableRow key={l.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">{l.title}</TableCell>
                  <TableCell className="px-4 py-2.5">{l.lecturerName ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5 text-xs">{l.startTime}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                        st.cls,
                      )}
                    >
                      {st.labelKey ? t(st.labelKey) : l.status}
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
