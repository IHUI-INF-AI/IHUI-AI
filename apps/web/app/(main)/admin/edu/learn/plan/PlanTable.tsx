'use client'

import { Loader2, Edit, Trash2, CalendarDays } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { STATUS_MAP } from './helpers'
import type { Plan } from './types'

const COLSPAN = 6

interface Props {
  rows: Plan[]
  isLoading: boolean
  noEndpoint: boolean
  onEdit: (p: Plan) => void
  onDelete: (id: string) => void
  deletePending: boolean
}

export function PlanTable({ rows, isLoading, noEndpoint, onEdit, onDelete, deletePending }: Props) {
  const t = useTranslations('admin.edu.learn.plan')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colTitle')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colStudent')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colPeriod')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colTargetHours')}</TableHead>
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
          ) : noEndpoint ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <CalendarDays className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noEndpoint')}
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <CalendarDays className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noData')}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((p) => {
              const st = STATUS_MAP[p.status] ?? {
                label: p.status,
                cls: 'bg-muted text-muted-foreground',
              }
              return (
                <TableRow key={p.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">{p.title}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    {p.userName ?? p.userId.slice(0, 8)}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                    {p.startDate} ~ {p.endDate}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    {t('hours', { hours: p.targetHours })}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                        st.cls,
                      )}
                    >
                      {t(st.label)}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => onEdit(p)} title={t('edit')}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(p.id)}
                        title={t('delete')}
                        className="text-destructive hover:text-destructive"
                        disabled={deletePending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
