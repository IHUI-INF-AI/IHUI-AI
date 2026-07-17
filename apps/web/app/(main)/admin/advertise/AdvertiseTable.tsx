'use client'

import { Loader2, Edit, Trash2, Megaphone } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@ihui/ui'
import { HasPermi } from '@/components/auth/HasPermi'
import type { Advertise } from './types'

interface Props {
  list: Advertise[]
  isLoading: boolean
  onEdit: (item: Advertise) => void
  onDelete: (item: Advertise) => void
}

export function AdvertiseTable({ list, isLoading, onEdit, onDelete }: Props) {
  const t = useTranslations('admin.advertise')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colTitle')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colPosition')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colImage')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colSort')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colCreatedAt')}</TableHead>
            <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                {t('loading')}
              </TableCell>
            </TableRow>
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                <Megaphone className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noData')}
              </TableCell>
            </TableRow>
          ) : (
            list.map((item) => (
              <TableRow key={item.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5 font-medium">{item.title}</TableCell>
                <TableCell className="px-4 py-2.5">{item.position || '-'}</TableCell>
                <TableCell className="px-4 py-2.5">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.title || '广告图'}
                      className="h-10 w-10 rounded object-cover"
                    />
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="px-4 py-2.5">{item.sort}</TableCell>
                <TableCell className="px-4 py-2.5">
                  <span
                    className={
                      item.status === 1
                        ? 'inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600'
                        : 'inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'
                    }
                  >
                    {item.status === 1 ? t('enabled') : t('disabled')}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-muted-foreground">
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-'}
                </TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <HasPermi code="ai:advertise:edit">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(item)}
                        title={t('edit')}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </HasPermi>
                    <HasPermi code="ai:advertise:remove">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(item)}
                        title={t('delete')}
                        className="text-destructive hover:text-destructive"
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
