'use client'

import { useTranslations, useLocale } from 'next-intl'
import { Pin, Edit, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { TYPE_BADGE } from './helpers'
import type { Announcement } from './types'

interface Props {
  list: Announcement[]
  isLoading: boolean
  isError: boolean
  deletePending: boolean
  onEdit: (a: Announcement) => void
  onDelete: (id: string) => void
}

export function AnnouncementTable({
  list,
  isLoading,
  isError,
  deletePending,
  onEdit,
  onDelete,
}: Props) {
  const t = useTranslations('admin.announcements')
  const locale = useLocale()
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const th = 'px-4 py-2.5 font-medium'

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className={th}>{t('colTitle')}</th>
            <th className={th}>{t('colType')}</th>
            <th className={th}>{t('colPinned')}</th>
            <th className={th}>{t('colPublished')}</th>
            <th className={th}>{t('colPublishedAt')}</th>
            <th className={cn(th, 'text-right')}>{t('colActions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {isError ? (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-destructive">
                {t('noData')}
              </td>
            </tr>
          ) : isLoading ? (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                {t('loading')}
              </td>
            </tr>
          ) : list.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                {t('noData')}
              </td>
            </tr>
          ) : (
            list.map((a) => (
              <tr key={a.id} className="transition-colors hover:bg-muted/30">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2 font-medium">
                    {a.isPinned && <Pin className="h-3.5 w-3.5 text-amber-500" />}
                    <span>{a.title}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={cn(
                      'inline-flex rounded-md px-2 py-0.5 text-xs font-medium',
                      TYPE_BADGE[a.type],
                    )}
                  >
                    {t(`types.${a.type}`)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {a.isPinned ? t('yes') : t('no')}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                      a.isPublished
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        a.isPublished ? 'bg-emerald-500' : 'bg-muted-foreground/50',
                      )}
                    />
                    {a.isPublished ? t('published') : t('draft')}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {a.publishedAt ? dateFmt.format(new Date(a.publishedAt)) : '-'}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => onEdit(a)}>
                      <Edit className="h-4 w-4" />
                      {t('edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={deletePending}
                      onClick={() => {
                        if (confirm(t('deleteConfirm'))) onDelete(a.id)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      {t('delete')}
                    </Button>
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
