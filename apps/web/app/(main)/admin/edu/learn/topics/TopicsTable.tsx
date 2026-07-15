'use client'

import { Loader2, Edit, Trash2, ImageOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { STATUS_MAP } from './helpers'
import type { Topic } from './types'

const COLSPAN = 5

interface Props {
  rows: Topic[]
  isLoading: boolean
  noEndpoint: boolean
  onEdit: (t: Topic) => void
  onDelete: (id: string) => void
  deletePending: boolean
}

export function TopicsTable({
  rows,
  isLoading,
  noEndpoint,
  onEdit,
  onDelete,
  deletePending,
}: Props) {
  const t = useTranslations('admin.edu.learn.topics')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colTitle')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colImage')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colPrice')}</TableHead>
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
                <ImageOff className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noEndpoint')}
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <ImageOff className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noData')}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((tp) => {
              const st = STATUS_MAP[tp.status] ?? {
                label: tp.status,
                cls: 'bg-muted text-muted-foreground',
              }
              return (
                <TableRow key={tp.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">{tp.title}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    {tp.image ? (
                      <Image
                        src={tp.image}
                        alt={tp.title}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded object-cover"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span className="font-medium text-emerald-600 dark:text-emerald-500">
                      ¥{tp.price ?? '0'}
                    </span>
                    {tp.originalPrice && tp.originalPrice !== '0' && (
                      <span className="ml-1 text-xs text-muted-foreground line-through">
                        ¥{tp.originalPrice}
                      </span>
                    )}
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(tp)}
                        title={t('edit')}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(tp.id)}
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
