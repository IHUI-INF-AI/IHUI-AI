'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Monitor, Loader2, ChevronRight } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import type { PageData } from '@/lib/edu'

interface SessionInfo {
  id: string
  createdAt: string | null
  expiresAt: string | null
  familyId: string | null
}

/** 设备管理概览：显示最近登录时间，点击进入会话管理页面。 */
export function DeviceManager() {
  const t = useTranslations('settings')
  const [lastLogin, setLastLogin] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetchApi<PageData<SessionInfo>>('/settings/authorizations?page=1&pageSize=1')
      .then((res) => {
        if (res.success && res.data.list?.length > 0) {
          setLastLogin(res.data.list[0]?.createdAt ?? null)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Monitor className="h-4 w-4" />
          {t('device.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Link
            href="/settings/authorizations"
            className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-accent"
          >
            <span className="text-sm text-muted-foreground">
              {lastLogin
                ? `${t('device.lastLoginLabel')}: ${dateFormatter.format(new Date(lastLogin))}`
                : t('device.empty')}
            </span>
            <span className="flex items-center gap-1 text-sm font-medium text-primary">
              {t('device.manage')}
              <ChevronRight className="h-4 w-4" />
            </span>
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
