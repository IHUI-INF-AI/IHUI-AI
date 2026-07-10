'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Webhook, Activity, CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface EventStats {
  total: number
  today: number
  processing: number
  failed: number
}

interface EventItem {
  id: string
  name: string
  source: string
  status: 'pending' | 'processing' | 'success' | 'failed'
  time: string
}

const MOCK_STATS: EventStats = { total: 128420, today: 3210, processing: 12, failed: 24 }
const MOCK_EVENTS: EventItem[] = [
  { id: '1', name: 'order.created', source: 'orders-service', status: 'success', time: '2026-07-10 09:12:30' },
  { id: '2', name: 'user.registered', source: 'auth-service', status: 'success', time: '2026-07-10 09:11:18' },
  { id: '3', name: 'message.sent', source: 'chat-service', status: 'processing', time: '2026-07-10 09:10:42' },
  { id: '4', name: 'payment.refunded', source: 'payment-service', status: 'failed', time: '2026-07-10 09:08:55' },
  { id: '5', name: 'agent.published', source: 'agent-service', status: 'success', time: '2026-07-10 09:05:12' },
  { id: '6', name: 'email.queued', source: 'notification-service', status: 'pending', time: '2026-07-10 09:02:00' },
]

const STATUS_STYLE: Record<EventItem['status'], { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-muted', text: 'text-muted-foreground', label: 'Pending' },
  processing: { bg: 'bg-amber-500/10', text: 'text-amber-600', label: 'Processing' },
  success: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', label: 'Success' },
  failed: { bg: 'bg-red-500/10', text: 'text-red-600', label: 'Failed' },
}

export default function EventBusMonitorPage() {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')

  const { data: stats = MOCK_STATS, isLoading } = useQuery({
    queryKey: ['admin', 'event-bus', 'stats'],
    queryFn: () => Promise.resolve(MOCK_STATS),
  })
  const { data: events = MOCK_EVENTS } = useQuery({
    queryKey: ['admin', 'event-bus', 'events'],
    queryFn: () => Promise.resolve(MOCK_EVENTS),
  })

  const cards = [
    { label: t('eventBus.total'), value: stats.total, icon: Webhook, color: 'text-primary' },
    { label: t('eventBus.today'), value: stats.today, icon: Activity, color: 'text-blue-600' },
    { label: t('eventBus.processing'), value: stats.processing, icon: Clock, color: 'text-amber-600' },
    { label: t('eventBus.failed'), value: stats.failed, icon: XCircle, color: 'text-red-600' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Webhook className="h-6 w-6 text-primary" />
          {t('eventBus.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('eventBus.subtitle')}</p>
      </div>

      {/* 统计卡片 */}
      <section>
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {tc('search')}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <Card key={c.label}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
                  <c.icon className={cn('h-4 w-4', c.color)} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{c.value.toLocaleString()}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 事件列表 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('eventBus.eventList')}</h2>
        {events.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
            {t('eventBus.noData')}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{t('eventBus.colName')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('eventBus.colSource')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('eventBus.colStatus')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('eventBus.colTime')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {events.map((e) => {
                  const st = STATUS_STYLE[e.status]
                  return (
                    <tr key={e.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {e.status === 'success' ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : e.status === 'failed' ? (
                            <XCircle className="h-4 w-4 text-red-600" />
                          ) : (
                            <Clock className="h-4 w-4 text-amber-600" />
                          )}
                          <span className="font-mono text-xs font-medium">{e.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{e.source}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', st.bg, st.text)}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{e.time}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
