'use client'

import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

import { METHOD_COLOR, th } from './helpers'
import type { ApiLog } from './types'

interface Props {
  paged: ApiLog[]
  isLoading: boolean
}

export function ApiLogTable({ paged, isLoading }: Props) {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')
  return (
    <>
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {tc('search')}
        </div>
      ) : paged.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">
          {t('apiLogs.noData')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className={th}>{t('apiLogs.colTime')}</th>
                <th className={th}>{t('apiLogs.colEndpoint')}</th>
                <th className={th}>{t('apiLogs.colMethod')}</th>
                <th className={th}>{t('apiLogs.colStatus')}</th>
                <th className={th}>{t('apiLogs.colLatency')}</th>
                <th className={th}>{t('apiLogs.colIp')}</th>
                <th className={th}>{t('apiLogs.colUser')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paged.map((l) => (
                <tr key={l.id} className="transition-colors hover:bg-muted/30">
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                    {l.time}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{l.endpoint}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex rounded px-2 py-0.5 text-xs font-medium',
                        METHOD_COLOR[l.method] ?? 'bg-muted text-muted-foreground',
                      )}
                    >
                      {l.method}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        'font-medium',
                        l.statusCode >= 500
                          ? 'text-red-600'
                          : l.statusCode >= 400
                            ? 'text-amber-600'
                            : 'text-emerald-600',
                      )}
                    >
                      {l.statusCode}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        'text-xs',
                        l.latency > 500
                          ? 'text-red-600'
                          : l.latency > 200
                            ? 'text-amber-600'
                            : 'text-muted-foreground',
                      )}
                    >
                      {l.latency}ms
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{l.ip}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{l.user}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
