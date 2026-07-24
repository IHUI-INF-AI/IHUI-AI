'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { GitBranch, Loader2, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface ApiVersion {
  id: string
  version: string
  status: 'stable' | 'beta' | 'deprecated' | 'sunset'
  releaseDate: string
  deprecateDate?: string
  sunsetDate?: string
  changelog?: string
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const STATUS_ICON = {
  stable: CheckCircle,
  beta: AlertTriangle,
  deprecated: AlertTriangle,
  sunset: XCircle,
} as const

const STATUS_CLS = {
  stable: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  beta: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  deprecated: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  sunset: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
} as const

export default function VersionsPage() {
  const locale = useLocale()
  const t = useTranslations('developerVersionsPage')
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const {
    data: list = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['developer', 'versions'],
    queryFn: () => api<ApiVersion[]>('/api/developer/versions').catch(() => [] as ApiVersion[]),
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <GitBranch className="h-5 w-5 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t('loading')}
        </div>
      ) : list.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <div className="space-y-3">
          {list.map((v) => {
            const StatusIcon = STATUS_ICON[v.status]
            const cls = STATUS_CLS[v.status]
            return (
              <Card key={v.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md border px-2 py-0.5 font-mono text-sm font-semibold">
                        v{v.version}
                      </span>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                          cls,
                        )}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {t(`status.${v.status}` as 'status.stable')}
                      </span>
                    </div>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {t('releasedAt', { date: dateFmt.format(new Date(v.releaseDate)) })}
                    </span>
                  </div>

                  {v.changelog && (
                    <p className="mt-2 text-sm text-muted-foreground">{v.changelog}</p>
                  )}

                  {(v.deprecateDate || v.sunsetDate) && (
                    <div className="mt-3 flex flex-wrap gap-4 border-t pt-2 text-xs">
                      {v.deprecateDate && (
                        <div>
                          <span className="text-muted-foreground">{t('deprecateTime')}</span>{' '}
                          <span className="font-medium text-amber-600 dark:text-amber-400">
                            {dateFmt.format(new Date(v.deprecateDate))}
                          </span>
                        </div>
                      )}
                      {v.sunsetDate && (
                        <div>
                          <span className="text-muted-foreground">{t('sunsetTime')}</span>{' '}
                          <span className="font-medium text-rose-600 dark:text-rose-400">
                            {dateFmt.format(new Date(v.sunsetDate))}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
