// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 申报看板(2026-11-23 补):把 /filing/summary 与 /filing/deadlines 两个只读口径
 * 摆到界面上——此前页面上只能推进单条申报任务,看不到"本月应报几格、哪几格逾期"。
 */
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { AlarmClock } from 'lucide-react'

import { api, FIN_RESOURCE, type FinClient } from './types'
import { Card, Empty, StatusBadge, field } from './tabs'

interface FilingSummary {
  today: string
  total: number
  pending: number
  computed: number
  drafted: number
  submitted: number
  accepted: number
  failed: number
  overdue: number
  dueThisMonth: number
  dueThisMonthTypes: string[]
}

interface FilingTaskRow {
  id: string
  clientId: string
  taxType: string
  period: string
  dueDate: string
  status: string
  taxAmount: string | null
}

interface Deadlines {
  today: string
  horizon: string
  overdue: FilingTaskRow[]
  dueToday: FilingTaskRow[]
  upcoming: FilingTaskRow[]
}

const fmtDate = (d: string) => d

/** 申报看板:客户维度汇总 + 三段到期清单(逾期/今日/近 N 天) */
export function FilingBoard({ clients }: { clients: FinClient[] }) {
  const t = useTranslations('finAccounting')
  const [clientId, setClientId] = React.useState('')
  const [upcomingDays, setUpcomingDays] = React.useState('7')

  const qs = clientId ? `&clientId=${clientId}` : ''
  const summaryQ = useQuery({
    queryKey: ['fin', 'filing-summary', clientId],
    queryFn: () => api<FilingSummary>(`${FIN_RESOURCE}/filing/summary?x=1${qs}`),
  })
  const deadlinesQ = useQuery({
    queryKey: ['fin', 'filing-deadlines', clientId, upcomingDays],
    queryFn: () =>
      api<Deadlines>(`${FIN_RESOURCE}/filing/deadlines?upcomingDays=${upcomingDays || '7'}${qs}`),
  })

  const nameOf = React.useMemo(() => {
    const m = new Map<string, string>()
    for (const c of clients) m.set(c.id, c.name)
    return m
  }, [clients])

  const s = summaryQ.data

  const rowsOfSection = (rows: FilingTaskRow[]) => (
    <div className="space-y-1">
      {rows.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="font-medium">{nameOf.get(r.clientId) ?? r.clientId.slice(0, 8)}</span>
          <span className="font-mono">{r.taxType}</span>
          <span className="text-muted-foreground tabular-nums">{r.period}</span>
          <span className="tabular-nums">{fmtDate(r.dueDate)}</span>
          <StatusBadge status={r.status} />
          {r.taxAmount ? <span className="tabular-nums">{r.taxAmount}</span> : null}
        </div>
      ))}
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select className={field} value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">{t('allClients')}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-muted-foreground">{t('upcomingDays')}</span>
        <input
          className={`${field} w-16`}
          value={upcomingDays}
          onChange={(e) => setUpcomingDays(e.target.value)}
        />
      </div>

      <Card
        title={t('filingBoardTitle')}
        actions={s ? <span className="text-[11px] text-muted-foreground">{s.today}</span> : null}
      >
        {!s ? (
          <Empty text={t('loading')} />
        ) : (
          <div className="space-y-2">
            <div className="font-[weight:inherit] flex flex-wrap gap-4 text-label tabular-nums">
              <span>
                {t('filingTotal')}: <b>{s.total}</b>
              </span>
              <span>
                {t('filingPending')}: <b>{s.pending}</b>
              </span>
              <span>
                {t('filingComputed')}: <b>{s.computed}</b>
              </span>
              <span>
                {t('filingDrafted')}: <b>{s.drafted}</b>
              </span>
              <span>
                {t('filingSubmitted')}: <b>{s.submitted}</b>
              </span>
              <span className="text-success">
                {t('filingAccepted')}: <b>{s.accepted}</b>
              </span>
              <span className={s.overdue > 0 ? 'text-destructive' : 'text-muted-foreground'}>
                {t('filingOverdue')}: <b>{s.overdue}</b>
              </span>
              <span className="text-muted-foreground">
                {t('filingDueThisMonth')}: {s.dueThisMonth}
              </span>
            </div>
            {s.dueThisMonthTypes.length > 0 && (
              <div className="text-[11px] text-muted-foreground">
                {t('filingDueTypes')}:{' '}
                <span className="font-mono">{s.dueThisMonthTypes.join(' / ')}</span>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card
        title={t('filingDeadlinesTitle')}
        actions={
          deadlinesQ.data ? (
            <span className="text-[11px] text-muted-foreground">
              {deadlinesQ.data.today} → {deadlinesQ.data.horizon}
            </span>
          ) : null
        }
      >
        {!deadlinesQ.data ? (
          <Empty text={t('loading')} />
        ) : (
          <div className="space-y-2">
            {deadlinesQ.data.overdue.length === 0 &&
            deadlinesQ.data.dueToday.length === 0 &&
            deadlinesQ.data.upcoming.length === 0 ? (
              <Empty text={t('noDeadlines')} />
            ) : (
              <>
                {deadlinesQ.data.overdue.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-destructive">
                      <AlarmClock className="h-3 w-3" />
                      {t('filingOverdueSection')}
                    </div>
                    {rowsOfSection(deadlinesQ.data.overdue)}
                  </div>
                )}
                {deadlinesQ.data.dueToday.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold text-warning">
                      {t('filingDueTodaySection')}
                    </div>
                    {rowsOfSection(deadlinesQ.data.dueToday)}
                  </div>
                )}
                {deadlinesQ.data.upcoming.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold text-muted-foreground">
                      {t('filingUpcomingSection')}
                    </div>
                    {rowsOfSection(deadlinesQ.data.upcoming)}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
