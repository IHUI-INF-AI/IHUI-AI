'use client'

import { Loader2, Edit, Power } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { CONTENT_TYPE_LABEL, CONTENT_TYPE_STYLE, th } from './helpers'
import type { RecommendSlot } from './types'

interface Props {
  list: RecommendSlot[] | undefined
  isLoading: boolean
  togglePending: boolean
  onEdit: (s: RecommendSlot) => void
  onToggle: (id: string) => void
}

export function RecConfigTable({ list, isLoading, togglePending, onEdit, onToggle }: Props) {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {tc('search')}
      </div>
    )
  }

  if (!list?.length) {
    return (
      <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">
        {t('rec.noData')}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className={th}>{t('rec.colPosition')}</th>
            <th className={th}>{t('rec.colName')}</th>
            <th className={th}>{t('rec.colContentType')}</th>
            <th className={th}>{t('rec.colSort')}</th>
            <th className={th}>{t('rec.colStatus')}</th>
            <th className={cn(th, 'text-right')}>{t('rec.colActions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {list.map((s) => (
            <tr key={s.id} className="transition-colors hover:bg-muted/30">
              <td className="px-4 py-2.5">
                <code className="font-mono text-xs">{s.position}</code>
              </td>
              <td className="px-4 py-2.5 font-medium">{s.name}</td>
              <td className="px-4 py-2.5">
                <span
                  className={cn(
                    'inline-flex rounded-md px-2 py-0.5 text-xs font-medium',
                    CONTENT_TYPE_STYLE[s.contentType],
                  )}
                >
                  {CONTENT_TYPE_LABEL[s.contentType]}
                </span>
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">{s.sort}</td>
              <td className="px-4 py-2.5">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                    s.isEnabled
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      s.isEnabled ? 'bg-emerald-500' : 'bg-muted-foreground/50',
                    )}
                  />
                  {s.isEnabled ? t('rec.enabled') : t('rec.disabled')}
                </span>
              </td>
              <td className="px-4 py-2.5 text-right">
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onEdit(s)}>
                    <Edit className="h-4 w-4" />
                    {tc('edit')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={togglePending}
                    onClick={() => onToggle(s.id)}
                  >
                    <Power className="h-4 w-4" />
                    {s.isEnabled ? t('rec.disable') : t('rec.enable')}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
