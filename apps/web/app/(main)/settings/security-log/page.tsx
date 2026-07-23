'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ShieldCheck, ShieldAlert, ChevronLeft, ChevronRight } from 'lucide-react'

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
} from '@ihui/ui'
import { Container } from '@/components/layout'
import { fetchApi } from '@/lib/api'
import { buildQs, type PageData } from '@/lib/edu'
import { cn } from '@/lib/utils'

interface SecurityLogItem {
  id: string
  time: string
  event: string
  ip: string
  device: string
  status: 'success' | 'failed'
}

const PAGE_SIZE = 20

type TabKey = 'all' | 'security' | 'abnormal'

const SECURITY_EVENTS = new Set(['passwordChange', 'abnormalLogin', 'twoFactorEnabled'])

export default function SecurityLogPage() {
  const t = useTranslations('settings')
  const [logs, setLogs] = React.useState<SecurityLogItem[]>([])
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [tab, setTab] = React.useState<TabKey>('all')

  const eventLabels: Record<string, string> = {
    login: t('eventLogin'),
    logout: t('eventLogout'),
    passwordChange: t('eventPasswordChange'),
    abnormalLogin: t('eventAbnormalLogin'),
    twoFactorEnabled: t('event2faEnabled'),
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  React.useEffect(() => {
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
  }, [page, t])

  const filteredLogs = React.useMemo(() => {
    if (tab === 'all') return logs
    if (tab === 'security') {
      return logs.filter((l) => SECURITY_EVENTS.has(l.event))
    }
    return logs.filter((l) => l.event === 'abnormalLogin' && l.status === 'failed')
  }, [logs, tab])

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: t('loginHistory.allTypes') },
    { key: 'security', label: t('securityLogTitle') },
    { key: 'abnormal', label: t('eventAbnormalLogin') },
  ]

  return (
    <Container maxWidth="md" padding={false} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('securityLogTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('securityLogDesc')}</p>
      </div>

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

          {loading ? (
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
                    <TableHead>{t('logStatus')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-xs">{log.time}</TableCell>
                      <TableCell className="text-xs">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={cn(
                              'inline-flex h-5 w-5 items-center justify-center rounded',
                              log.status === 'failed' ? 'bg-red-100' : 'bg-green-100',
                            )}
                          >
                            {log.status === 'failed' ? (
                              <ShieldAlert className="h-3 w-3 text-red-600" />
                            ) : (
                              <ShieldCheck className="h-3 w-3 text-green-600" />
                            )}
                          </span>
                          {eventLabels[log.event] ?? log.event}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{log.ip}</TableCell>
                      <TableCell className="text-xs">{log.device}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                            log.status === 'success'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700',
                          )}
                        >
                          {log.status === 'success' ? t('statusSuccess') : t('statusFailed')}
                        </span>
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
    </Container>
  )
}
