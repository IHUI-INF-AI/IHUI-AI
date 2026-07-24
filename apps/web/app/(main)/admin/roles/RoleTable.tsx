'use client'

import { useTranslations, useLocale } from 'next-intl'
import { Loader2, Pencil, Trash2, Lock } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import type { Role } from './types'

interface Props {
  list: Role[]
  isLoading: boolean
  onEdit: (r: Role) => void
  onDelete: (r: Role) => void
}

export function RoleTable({ list, isLoading, onEdit, onDelete }: Props) {
  const t = useTranslations('admin.roles')
  const locale = useLocale()
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">{t('name')}</th>
            <th className="px-4 py-2.5 font-medium">{t('description')}</th>
            <th className="px-4 py-2.5 font-medium">{t('permissionsCount')}</th>
            <th className="px-4 py-2.5 font-medium">{t('type')}</th>
            <th className="px-4 py-2.5 font-medium">{t('createdAt')}</th>
            <th className="px-4 py-2.5 text-right font-medium">{t('actions')}</th>
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
            list.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-muted/30">
                <td className="px-4 py-2.5">
                  <div className="font-medium">{r.displayName}</div>
                  <div className="text-xs text-muted-foreground">{r.name}</div>
                </td>
                <td className="max-w-[240px] break-words px-4 py-2.5 text-muted-foreground">
                  {r.description || '-'}
                </td>
                <td className="px-4 py-2.5">
                  <span className="inline-flex rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                    {r.permissionsCount ?? 0}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  {r.isSystem ? (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-600 dark:text-amber-500">
                      <Lock className="h-3 w-3" />
                      {t('builtinYes')}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t('builtinNo')}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {dateFmt.format(new Date(r.createdAt))}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={r.isSystem}
                      onClick={() => onEdit(r)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {t('edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={r.isSystem}
                      onClick={() => onDelete(r)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
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
