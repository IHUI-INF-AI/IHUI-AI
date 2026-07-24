'use client'

import { Loader2, Edit, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import type { HelpArticle } from './types'

interface Props {
  list: HelpArticle[]
  isLoading: boolean
  deletePending: boolean
  onEdit: (h: HelpArticle) => void
  onDelete: (h: HelpArticle) => void
}

const th = 'px-4 py-2.5 font-medium'

export function HelpTable({ list, isLoading, deletePending, onEdit, onDelete }: Props) {
  const t = useTranslations('admin.help')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className={th}>{t('colTitle')}</th>
            <th className={th}>{t('colCategory')}</th>
            <th className={th}>{t('colSlug')}</th>
            <th className={th}>{t('colStatus')}</th>
            <th className={th}>{t('colViews')}</th>
            <th className={cn(th, 'text-right')}>{t('colActions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {isLoading ? (
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
            list.map((h) => (
              <tr key={h.id} className="transition-colors hover:bg-muted/30">
                <td className="px-4 py-2.5 font-medium">{h.title}</td>
                <td className="px-4 py-2.5">
                  <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {t(`categories.${h.category}`)}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{h.slug}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                      h.isPublished
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        h.isPublished ? 'bg-emerald-500' : 'bg-muted-foreground/50',
                      )}
                    />
                    {h.isPublished ? t('published') : t('draft')}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{h.viewCount ?? 0}</td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => onEdit(h)}>
                      <Edit className="h-4 w-4" />
                      {t('edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={deletePending}
                      onClick={() => onDelete(h)}
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
