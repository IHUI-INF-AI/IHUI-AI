// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useAuthGate } from '@/hooks/use-auth-gate'
import { AuthGatePrompt } from '@/components/common'
import { ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react'

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button,
} from '@ihui/ui-react'
import { BackButton } from '@/components/common'
import { Container } from '@/components/layout'
import { fetchApi } from '@/lib/api'
import { buildQs, type PageData } from '@/lib/edu'

/**
 * GET /settings/security-logs 的行 = `security_logs` 表实列
 * (packages/database/src/schema/security-logs.ts:18-27)。
 * 旧声明的 time/event/device/status 后端从未返回 ⇒ 四列里三列恒空、状态列恒判"成功"。
 * 后端也不给成败结论(它只记发生了什么)，故本表不再有一列"状态"。
 */
interface SecurityLogItem {
  id: string
  action: string
  ip: string | null
  userAgent: string | null
  createdAt: string
}

const PAGE_SIZE = 20

type TabKey = 'all' | 'security' | 'abnormal'

/** 本表已插桩写入口径（recordSecurityEvent）；abnormal 那一维等 IP 白名单拦截落地后才有行。 */
const SECURITY_EVENTS = new Set([
  'password_change',
  'two_factor_enable',
  'two_factor_disable',
])
const ABNORMAL_EVENTS = new Set(['login_blocked_by_ip_allowlist'])

export default function SecurityLogPage() {
  const t = useTranslations('settings')
  // 2026-10-15 登录态门(与 /settings/notifications 同型):未就绪/未登录不发注定 401 的请求,改显登录引导
  const tGate = useTranslations('chatHistory')
  const locale = useLocale()
  const { allow } = useAuthGate()
  const [logs, setLogs] = React.useState<SecurityLogItem[]>([])
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [tab, setTab] = React.useState<TabKey>('all')

  const eventLabels: Record<string, string> = {
    password_change: t('eventPasswordChange'),
    two_factor_enable: t('event2faEnabled'),
    two_factor_disable: t('event2faDisabled'),
    login_blocked_by_ip_allowlist: t('eventIpBlocked'),
  }

  const dateFmt = React.useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }),
    [locale],
  )
  const fmtTime = (iso: string) => {
    const d = new Date(iso)
    // 解析不了就交原文，不编一个时间给表格
    return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  React.useEffect(() => {
    if (!allow) return
    let cancelled = false
    setLoading(true)
    setError('')
    fetchApi<PageData<SecurityLogItem>>(
      '/settings/security-logs' + buildQs({ page, pageSize: PAGE_SIZE }),
    )
      .then((res) => {
        if (cancelled) return
        if (res.success) {
          setLogs(res.data.list ?? [])
          setTotal(res.data.total ?? 0)
        } else {
          setError(res.error)
          setLogs([])
          setTotal(0)
        }
      })
      .catch(() => {
        if (cancelled) return
        setError(t('activityLoadFailed'))
        setLogs([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [page, t, allow])

  const filteredLogs = React.useMemo(() => {
    if (tab === 'all') return logs
    if (tab === 'security') {
      return logs.filter((l) => SECURITY_EVENTS.has(l.action))
    }
    return logs.filter((l) => ABNORMAL_EVENTS.has(l.action))
  }, [logs, tab])

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: t('loginHistory.allTypes') },
    { key: 'security', label: t('securityLogTitle') },
    { key: 'abnormal', label: t('eventAbnormalLogin') },
  ]

  return (
    <Container maxWidth="full" padding={false} className="px-4 flex h-full flex-col py-4">
      <BackButton />
      <div className="shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">{t('securityLogTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('securityLogDesc')}</p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" />
              {t('securityLogTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex gap-2">
              {tabs.map((tb) => (
                <Button
                  key={tb.key}
                  variant={tab === tb.key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTab(tb.key)}
                >
                  {tb.label}
                </Button>
              ))}
            </div>

            {!allow ? (
              <AuthGatePrompt message={tGate('loginRequired')} />
            ) : loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t('activityLoading')}
              </p>
            ) : error ? (
              <p className="py-8 text-center text-sm text-destructive">{error}</p>
            ) : filteredLogs.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t('activityEmpty')}</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('logTime')}</TableHead>
                      <TableHead>{t('logEvent')}</TableHead>
                      <TableHead>{t('logIp')}</TableHead>
                      <TableHead>{t('logDevice')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {fmtTime(log.createdAt)}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="inline-flex items-center gap-1.5">
                            <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                            {/* 未插桩的 action 显原文，不替它编一个中文名 */}
                            {eventLabels[log.action] ?? log.action}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{log.ip ?? '-'}</TableCell>
                        <TableCell className="max-w-[280px] truncate text-xs">
                          {log.userAgent ?? '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {!loading && !error && logs.length > 0 && (
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {t('activityPageInfo', { page, totalPages })}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {t('activityPrev')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    {t('activityNext')}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Container>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
