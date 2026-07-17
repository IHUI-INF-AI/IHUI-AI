'use client'

import { Loader2, Bell } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { briefConfig, type Item } from './helpers'

interface Props {
  list: Item[]
  isLoading: boolean
  onEdit: (item: Item) => void
  onDelete: (id: string) => void
}

export function ChannelsTable({ list, isLoading, onEdit, onDelete }: Props) {
  const t = useTranslations('adminTools.notificationChannels')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">{t('colId')}</th>
            <th className="px-4 py-2.5 font-medium">{t('colName')}</th>
            <th className="px-4 py-2.5 font-medium">{t('colType')}</th>
            <th className="px-4 py-2.5 font-medium">{t('colConfig')}</th>
            <th className="px-4 py-2.5 font-medium">{t('colStatus')}</th>
            <th className="px-4 py-2.5 font-medium">{t('colActions')}</th>
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
                <Bell className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noData')}
              </td>
            </tr>
          ) : (
            list.map((item) => (
              <tr key={item.id} className="hover:bg-muted/30">
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                  {item.id.slice(0, 8)}
                </td>
                <td className="px-4 py-2.5 font-medium">{item.name}</td>
                <td className="px-4 py-2.5">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {t(`type_${item.type}`)}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                  {briefConfig(item.config)}
                </td>
                <td className="px-4 py-2.5">
                  {item.is_active ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      {t('enabled')}
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {t('disabled')}
                    </span>
                  )}
                </td>
                <td className="space-x-2 px-4 py-2.5">
                  <button className="text-primary hover:underline" onClick={() => onEdit(item)}>
                    {t('edit')}
                  </button>
                  <button
                    className="text-destructive hover:underline"
                    onClick={() => onDelete(item.id)}
                  >
                    {t('delete')}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
