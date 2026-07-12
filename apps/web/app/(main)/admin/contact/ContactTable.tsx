'use client'

import { Loader2, Edit, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@ihui/ui'
import { HasPermi } from '@/components/auth/HasPermi'
import { PERM, th, stripHtml } from './helpers'
import type { ContactItem } from './types'

interface Props {
  list: ContactItem[]
  isLoading: boolean
  delPending: boolean
  onEdit: (item: ContactItem) => void
  onDelete: (id: string) => void
}

export function ContactTable({ list, isLoading, delPending, onEdit, onDelete }: Props) {
  const t = useTranslations('adminContact')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className={th}>{t('colId')}</th>
            <th className={th}>{t('colIntroduction')}</th>
            <th className={th}>{t('colCorporateCulture')}</th>
            <th className={`${th} text-right`}>{t('colActions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {isLoading ? (
            <tr>
              <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                {t('loading')}
              </td>
            </tr>
          ) : list.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                {t('noData')}
              </td>
            </tr>
          ) : (
            list.map((item) => (
              <tr key={item.id} className="transition-colors hover:bg-muted/30">
                <td className="px-4 py-2.5 font-medium">{item.id}</td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {stripHtml(item.introduction)}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {stripHtml(item.corporateCulture)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <HasPermi code={`${PERM}:edit`}>
                      <Button size="sm" variant="ghost" onClick={() => onEdit(item)}>
                        <Edit className="h-4 w-4" />
                        {t('edit')}
                      </Button>
                    </HasPermi>
                    <HasPermi code={`${PERM}:remove`}>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={delPending}
                        onClick={() => confirm(t('confirmDelete')) && onDelete(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        {t('delete')}
                      </Button>
                    </HasPermi>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
