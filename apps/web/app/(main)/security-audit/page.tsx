'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, ShieldAlert, KeyRound, LogIn, Settings } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { formatDate } from '@/lib/date-utils'

import {
  Card,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@ihui/ui'

interface AuditEvent {
  id: string
  type: 'login' | 'permission' | 'sensitive'
  description: string
  ip: string
  createdAt: string
}

const TYPE_ICON: Record<AuditEvent['type'], React.ComponentType<{ className?: string }>> = {
  login: LogIn,
  permission: KeyRound,
  sensitive: Settings,
}

const DEFAULT_ICON = ShieldAlert

export default function SecurityAuditPage() {
  const t = useTranslations('securityAuditPage')
  const { data: list = [], isLoading } = useQuery({
    queryKey: ['security-audit'],
    queryFn: async () => {
      const r = await fetchApi<AuditEvent[]>('/api/security-audit')
      if (r.success && r.data) return r.data
      return []
    },
  })

  const fmtDate = (v: string) => {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : formatDate(d)
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ShieldAlert className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t('loading')}
            </div>
          ) : list.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">{t('empty')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-32 px-4 py-2.5">{t('colType')}</TableHead>
                  <TableHead className="px-4 py-2.5">{t('colDesc')}</TableHead>
                  <TableHead className="px-4 py-2.5">{t('colIp')}</TableHead>
                  <TableHead className="px-4 py-2.5">{t('colTime')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((ev) => {
                  const Icon = TYPE_ICON[ev.type] ?? DEFAULT_ICON
                  return (
                    <TableRow key={ev.id}>
                      <TableCell className="px-4 py-2.5">
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          {t(`type.${ev.type}`)}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-2.5">{ev.description}</TableCell>
                      <TableCell className="px-4 py-2.5 text-muted-foreground">{ev.ip}</TableCell>
                      <TableCell className="px-4 py-2.5 text-muted-foreground">
                        {fmtDate(ev.createdAt)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
