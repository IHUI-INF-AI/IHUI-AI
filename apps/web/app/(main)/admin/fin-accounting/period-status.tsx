// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 期间状态(2026-11-23 补):/ledgers/:id/periods 此前没有界面 ——
 * 页面只能"点结账",看不到哪些期间已结、每期结出多少利润。
 */
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { api, FIN_RESOURCE, type FinLedger } from './types'
import { Card, Empty, StatusBadge, field, th, td } from './tabs'

interface PeriodStatus {
  currentPeriod: string
  startPeriod: string
  periods: Array<{
    period: string
    status: string
    profitAmount: string | null
    closedAt: string | null
  }>
}

export function PeriodStatusCard({ ledgers }: { ledgers: FinLedger[] }) {
  const t = useTranslations('finAccounting')
  const [ledgerId, setLedgerId] = React.useState('')

  const q = useQuery({
    queryKey: ['fin', 'periods', ledgerId],
    enabled: Boolean(ledgerId),
    queryFn: () => api<PeriodStatus>(`${FIN_RESOURCE}/ledgers/${ledgerId}/periods`),
  })
  const d = q.data
  const money2 = (v: string | null) =>
    v === null ? '-' : Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2 })

  return (
    <Card title={t('periodStatusTitle')}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <select className={field} value={ledgerId} onChange={(e) => setLedgerId(e.target.value)}>
          <option value="">{t('selectLedger')}</option>
          {ledgers.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        {d && (
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {t('currentPeriodLabel')} {d.currentPeriod} · {t('startPeriodLabel')} {d.startPeriod}
          </span>
        )}
      </div>
      {!ledgerId ? (
        <Empty text={t('periodPickHint')} />
      ) : !d ? (
        <Empty text={t('loading')} />
      ) : d.periods.length === 0 ? (
        <Empty text={t('noClosedPeriods')} />
      ) : (
        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>{t('period')}</th>
              <th className={th}>{t('status')}</th>
              <th className={th}>{t('profitAmount')}</th>
              <th className={th}>{t('closedAt')}</th>
            </tr>
          </thead>
          <tbody>
            {d.periods.map((p) => (
              <tr key={p.period} className="border-t border-stroke-subtle">
                <td className={`${td} tabular-nums`}>{p.period}</td>
                <td className={td}>
                  <StatusBadge status={p.status} />
                </td>
                <td className={`${td} tabular-nums`}>{money2(p.profitAmount)}</td>
                <td className={`${td} tabular-nums`}>{p.closedAt ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
