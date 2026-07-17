'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ShieldCheck } from 'lucide-react'

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
import { Container } from '@/components/layout'
import { cn } from '@/lib/utils'

interface SecurityLogItem {
  id: string
  time: string
  event: string
  ip: string
  device: string
  status: 'success' | 'failed'
}

export default function SecurityLogPage() {
  const t = useTranslations('settings')

  const eventLabels: Record<string, string> = {
    login: t('eventLogin'),
    logout: t('eventLogout'),
    passwordChange: t('eventPasswordChange'),
    abnormalLogin: t('eventAbnormalLogin'),
    twoFactorEnabled: t('event2faEnabled'),
  }

  const logs: SecurityLogItem[] = [
    {
      id: '1',
      time: '2026-07-14 09:30:12',
      event: 'login',
      ip: '192.168.1.100',
      device: 'Chrome / Windows 10',
      status: 'success',
    },
    {
      id: '2',
      time: '2026-07-13 18:45:33',
      event: 'logout',
      ip: '192.168.1.100',
      device: 'Chrome / Windows 10',
      status: 'success',
    },
    {
      id: '3',
      time: '2026-07-13 10:20:05',
      event: 'passwordChange',
      ip: '10.0.0.52',
      device: 'Safari / macOS',
      status: 'success',
    },
    {
      id: '4',
      time: '2026-07-12 23:15:47',
      event: 'abnormalLogin',
      ip: '203.0.113.45',
      device: 'Firefox / Linux',
      status: 'failed',
    },
    {
      id: '5',
      time: '2026-07-12 14:00:00',
      event: 'twoFactorEnabled',
      ip: '192.168.1.100',
      device: 'Chrome / Windows 10',
      status: 'success',
    },
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
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-xs">{log.time}</TableCell>
                    <TableCell className="text-xs">{eventLabels[log.event]}</TableCell>
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
        </CardContent>
      </Card>
    </Container>
  )
}
