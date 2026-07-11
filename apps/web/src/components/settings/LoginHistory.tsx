'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { History, Loader2 } from 'lucide-react'

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
} from '@ihui/ui'
import { fetchApi } from '@/lib/api'

interface LoginRecord {
  id: string
  time: string
  ip: string
  device: string
  location: string
  status: 'success' | 'failed'
}

/**
 * 登录历史：时间 / IP / 设备 / 位置 / 状态。
 */
export function LoginHistory() {
  const t = useTranslations('settings')
  const [records, setRecords] = React.useState<LoginRecord[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    void fetchApi<LoginRecord[]>('/api/user/login-history')
      .then((res) => {
        if (res.success && res.data) setRecords(res.data)
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
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : records.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('history.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('history.time')}</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>{t('history.device')}</TableHead>
                  <TableHead>{t('history.location')}</TableHead>
                  <TableHead>{t('history.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">{r.time}</TableCell>
                    <TableCell className="font-mono text-xs">{r.ip}</TableCell>
                    <TableCell className="text-xs">{r.device}</TableCell>
                    <TableCell className="text-xs">{r.location}</TableCell>
                    <TableCell>
                      <span
                        className={
                          r.status === 'success'
                            ? 'rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-600'
                            : 'rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive'
                        }
                      >
                        {r.status === 'success' ? t('history.success') : t('history.failed')}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
