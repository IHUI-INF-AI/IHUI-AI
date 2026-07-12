'use client'

import { Loader2, Edit, Trash2, Star } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { th } from './helpers'
import type { OssDriver } from './types'

interface Props {
  list: OssDriver[]
  isLoading: boolean
  deletePending: boolean
  onEdit: (c: OssDriver) => void
  onDelete: (c: OssDriver) => void
}

export function OssConfigTable({ list, isLoading, deletePending, onEdit, onDelete }: Props) {
  const t = useTranslations('admin.oss')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className={th}>{t('colName')}</th>
            <th className={th}>{t('colDriver')}</th>
            <th className={th}>{t('colEnabled')}</th>
            <th className={th}>{t('colDefault')}</th>
            <th className={th}>{t('colSort')}</th>
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
            list.map((c) => (
              <tr key={c.id} className="transition-colors hover:bg-muted/30">
                <td className="px-4 py-2.5">
                  <div className="font-medium">{c.name}</div>
                  {c.description && (
                    <div className="text-xs text-muted-foreground">{c.description}</div>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                    {c.driver}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                      c.isEnabled
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        c.isEnabled ? 'bg-emerald-500' : 'bg-muted-foreground/50',
                      )}
                    />
                    {c.isEnabled ? t('enabled') : t('disabled')}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  {c.isDefault && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{c.sort}</td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => onEdit(c)}>
                      <Edit className="h-4 w-4" />
                      {t('edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={deletePending}
                      onClick={() => onDelete(c)}
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
