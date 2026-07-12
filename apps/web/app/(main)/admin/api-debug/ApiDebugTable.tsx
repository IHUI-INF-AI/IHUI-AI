'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { METHOD_COLOR } from './helpers'
import type { HistoryItem } from './types'

interface Props {
  list: HistoryItem[]
}

export function ApiDebugTable({ list }: Props) {
  const t = useTranslations('adminTools')
  if (list.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-8 text-center text-muted-foreground">
        {t('apiDebug.noHistory')}
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">{t('apiDebug.colMethod')}</th>
            <th className="px-4 py-2 font-medium">URL</th>
            <th className="px-4 py-2 font-medium">{t('apiDebug.colStatus')}</th>
            <th className="px-4 py-2 font-medium">{t('apiDebug.colTime')}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {list.map((h) => (
            <tr key={h.id} className="transition-colors hover:bg-muted/30">
              <td className="px-4 py-2">
                <span
                  className={cn(
                    'inline-flex rounded px-2 py-0.5 text-xs font-medium',
                    METHOD_COLOR[h.method],
                  )}
                >
                  {h.method}
                </span>
              </td>
              <td className="max-w-[320px] break-words px-4 py-2 font-mono text-xs" title={h.url}>
                {h.url}
              </td>
              <td className="px-4 py-2">
                <span
                  className={cn(
                    'font-medium',
                    h.status >= 400 ? 'text-red-600' : 'text-emerald-600',
                  )}
                >
                  {h.status}
                </span>
              </td>
              <td className="px-4 py-2 text-muted-foreground">{h.time}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
