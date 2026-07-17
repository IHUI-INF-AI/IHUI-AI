'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { GitBranch, Loader2, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent } from '@ihui/ui'
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

const STATUS_CONFIG = {
  stable: {
    label: '稳定',
    icon: CheckCircle,
    cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  beta: {
    label: '测试版',
    icon: AlertTriangle,
    cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  deprecated: {
    label: '已废弃',
    icon: AlertTriangle,
    cls: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  },
  sunset: {
    label: '已下线',
    icon: XCircle,
    cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  },
} as const

export default function VersionsPage() {
  const locale = useLocale()
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
          API 版本管理
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">查看 API 版本状态与废弃时间表</p>
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          加载中...
        </div>
      ) : list.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">暂无版本信息</p>
      ) : (
        <div className="space-y-3">
          {list.map((v) => {
            const cfg = STATUS_CONFIG[v.status]
            const StatusIcon = cfg.icon
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
                          cfg.cls,
                        )}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {cfg.label}
                      </span>
                    </div>
                    <span className="ml-auto text-xs text-muted-foreground">
                      发布于 {dateFmt.format(new Date(v.releaseDate))}
                    </span>
                  </div>

                  {v.changelog && (
                    <p className="mt-2 text-sm text-muted-foreground">{v.changelog}</p>
                  )}

                  {(v.deprecateDate || v.sunsetDate) && (
                    <div className="mt-3 flex flex-wrap gap-4 border-t pt-2 text-xs">
                      {v.deprecateDate && (
                        <div>
                          <span className="text-muted-foreground">废弃时间:</span>{' '}
                          <span className="font-medium text-amber-600 dark:text-amber-400">
                            {dateFmt.format(new Date(v.deprecateDate))}
                          </span>
                        </div>
                      )}
                      {v.sunsetDate && (
                        <div>
                          <span className="text-muted-foreground">下线时间:</span>{' '}
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
