'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Activity as ActivityIcon, ChevronLeft, ChevronRight } from 'lucide-react'

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

interface ActivityLog {
  id: string
  time: string
  ip: string
  device: string
  event: string
  status: 'success' | 'failed'
}

const PAGE_SIZE = 20

export default function ActivityPage() {
  const t = useTranslations('settings')
  const [logs, setLogs] = React.useState<ActivityLog[]>([])
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')

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
    fetchApi<PageData<ActivityLog>>(
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

  return (
    <Container maxWidth="md" padding={false} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('activityTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('activityDesc')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ActivityIcon className="h-4 w-4" />
            {t('activityTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('activityLoading')}</p>
          ) : error ? (
            <p className="py-8 text-center text-sm text-destructive">{error}</p>
          ) : logs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('activityEmpty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('logTime')}</TableHead>
                    <TableHead>{t('logIp')}</TableHead>
                    <TableHead>{t('logDevice')}</TableHead>
                    <TableHead>{t('logEvent')}</TableHead>
                    <TableHead>{t('logStatus')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-xs">{log.time}</TableCell>
                      <TableCell className="font-mono text-xs">{log.ip}</TableCell>
                      <TableCell className="text-xs">{log.device}</TableCell>
                      <TableCell className="text-xs">
                        {eventLabels[log.event] ?? log.event}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
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
