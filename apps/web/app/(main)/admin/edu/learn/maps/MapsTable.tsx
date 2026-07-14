'use client'

import { Loader2, Edit, Trash2, MapIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { STATUS_MAP } from './helpers'
import type { Map } from './types'

const COLSPAN = 5

interface Props {
  rows: Map[]
  isLoading: boolean
  noEndpoint: boolean
  onEdit: (m: Map) => void
  onDelete: (id: string) => void
  deletePending: boolean
}

export function MapsTable({ rows, isLoading, noEndpoint, onEdit, onDelete, deletePending }: Props) {
  const t = useTranslations('admin.edu.learn.maps')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colTitle')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colCover')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colSort')}</TableHead>
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
                <MapIcon className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noEndpoint')}
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <MapIcon className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noData')}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((m) => {
              const status = m.isPublished ? 'published' : 'draft'
              const st = STATUS_MAP[status] ?? {
                label: status,
                cls: 'bg-muted text-muted-foreground',
              }
              return (
                <TableRow key={m.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">{m.title}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    {m.cover ? (
                      <img src={m.cover} alt={m.title} className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                    {m.sort}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        st.cls,
                      )}
                    >
                      {t(st.label)}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => onEdit(m)} title={t('edit')}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(m.id)}
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
