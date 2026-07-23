'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Users, Loader2, ChevronRight } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent } from '@ihui/ui'
import { fetchApi } from '@/lib/api'
import type { PageData } from '@/lib/edu'

interface SessionInfo {
  id: string
  createdAt: string | null
  expiresAt: string | null
  familyId: string | null
}

/** 会话管理概览：显示活跃会话数，点击进入完整管理页面。 */
export function SessionManager() {
  const t = useTranslations('settings')
  const [count, setCount] = React.useState(0)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetchApi<PageData<SessionInfo>>('/settings/authorizations?page=1&pageSize=1')
      .then((res) => {
        if (res.success) setCount(res.data.total ?? 0)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          {t('session.title')}
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
              {t('session.activeCount', { count })}
            </span>
            <span className="flex items-center gap-1 text-sm font-medium text-primary">
              {t('session.manage')}
              <ChevronRight className="h-4 w-4" />
            </span>
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
