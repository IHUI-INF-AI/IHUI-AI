'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { History, Loader2, ChevronRight } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { buildQs, type PageData } from '@/lib/edu'

interface SecurityLogItem {
  id: string
  time: string
  ip: string
  device: string
  event: string
  status: 'success' | 'failed'
}

/** 登录历史概览：显示最近一条登录记录，点击进入完整安全日志页面。 */
export function LoginHistory() {
  const t = useTranslations('settings')
  const [recent, setRecent] = React.useState<SecurityLogItem | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetchApi<PageData<SecurityLogItem>>(
      '/settings/security-logs' + buildQs({ page: 1, pageSize: 1 }),
    )
      .then((res) => {
        if (res.success && res.data.list?.length > 0) {
          setRecent(res.data.list[0] ?? null)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          {t('history.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : recent ? (
          <Link
            href="/settings/security-log"
            className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-accent"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground">{recent.time}</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <span className="font-mono">{recent.ip}</span>
                <span className="text-border">·</span>
                <span>{recent.device}</span>
              </p>
            </div>
            <span className="flex items-center gap-1 text-sm font-medium text-primary">
              {t('history.viewAll')}
              <ChevronRight className="h-4 w-4" />
            </span>
          </Link>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">{t('history.empty')}</p>
        )}
      </CardContent>
    </Card>
  )
}
