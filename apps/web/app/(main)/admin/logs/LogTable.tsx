'use client'

import { useTranslations } from 'next-intl'
import { Loader2, ScrollText } from 'lucide-react'
import { Badge, methodClass, statusClass } from './helpers'
import type { ApiLog } from './types'

interface Props {
  list: ApiLog[]
  isLoading: boolean
  error: Error | null
  dateFmt: Intl.DateTimeFormat
  onSelect: (log: ApiLog) => void
}

export function LogTable({ list, isLoading, error, dateFmt, onSelect }: Props) {
  const t = useTranslations('admin.logs')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            {[t('time'), t('method'), t('path'), t('statusCode'), t('duration'), t('user')].map(
              (h) => (
                <th key={h} className="px-4 py-2.5 font-medium">
                  {h}
                </th>
              ),
            )}
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
          ) : error ? (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-destructive">
                {error.message}
              </td>
            </tr>
          ) : list.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                <ScrollText className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noData')}
              </td>
            </tr>
          ) : (
            list.map((log) => (
              <tr
                key={log.id}
                onClick={() => onSelect(log)}
                className="cursor-pointer transition-colors hover:bg-muted/30"
              >
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                  {dateFmt.format(new Date(log.createdAt))}
                </td>
                <td className="px-4 py-2.5">
                  <Badge cls={methodClass(log.method)}>{log.method}</Badge>
                </td>
                <td className="max-w-[280px] break-words px-4 py-2.5 font-mono text-xs">
                  {log.path}
                </td>
                <td className="px-4 py-2.5">
                  <Badge cls={statusClass(log.statusCode)}>{log.statusCode}</Badge>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                  {log.duration}
                  {t('ms')}
                </td>
                <td className="max-w-[120px] break-words px-4 py-2.5 text-xs text-muted-foreground">
                  {log.userId ? (
                    <span className="font-mono">{log.userId.slice(0, 8)}</span>
                  ) : (
                    t('anonymous')
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
