// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { History, Loader2, ChevronRight } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { useAuthGate } from '@/hooks/use-auth-gate'
import { buildQs, type PageData } from '@/lib/edu'

/**
 * GET /user/login-history 的行 = `audit_logs` 投影(apps/api/src/routes/user.ts:117-127)。
 * 数据源换过一次:原读 /settings/security-logs(security_logs 表),但 `createSecurityLog` 全仓
 * 零调用方 ⇒ 那张表恒空,卡片永远只能说"暂无"。旧声明里的 time/event/device/status 后端从未返回。
 */
interface SecurityLogItem {
  id: string
  action: string
  ip: string | null
  userAgent: string | null
  createdAt: string
}

/** 登录历史概览：显示最近一条登录记录，点击进入完整安全日志页面。 */
export function LoginHistory() {
  const t = useTranslations('settings')
  const locale = useLocale()
  const [recent, setRecent] = React.useState<SecurityLogItem | null>(null)
  const [loading, setLoading] = React.useState(true)
  const { allow } = useAuthGate()

  const dateFmt = React.useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }),
    [locale],
  )
  const fmtTime = (iso: string) => {
    const d = new Date(iso)
    // 解析不了就交原文,不编一个日期
    return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d)
  }

  React.useEffect(() => {
    if (!allow) {
      setLoading(false)
      return
    }
    fetchApi<PageData<SecurityLogItem>>(
      '/user/login-history' + buildQs({ page: 1, pageSize: 1 }),
    )
      .then((res) => {
        if (res.success && res.data.list?.length > 0) {
          setRecent(res.data.list[0] ?? null)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [allow])

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
              <p className="text-sm text-muted-foreground">{fmtTime(recent.createdAt)}</p>
              {/* 本卡只取 login-history(audit_logs 恒 auth.login),把 action 原值摊给中文用户没有信息量,
                  故显示 IP 与 UA;UA 为空时不留一个孤立的分隔点 */}
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <span className="font-mono">{recent.ip ?? '-'}</span>
                {recent.userAgent ? (
                  <>
                    <span className="text-border">·</span>
                    <span className="min-w-0 flex-1 truncate">{recent.userAgent}</span>
                  </>
                ) : null}
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
