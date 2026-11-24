// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 招聘作业(2026-11-23 补):招聘汇总口径与职位状态机此前没有界面 ——
 * 职位只能建、不能暂停/关闭,缺口(Gap)也看不见。
 */
import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { rowsOf } from '@/lib/api-rows'
import { Button } from '@ihui/ui-react'
import { Card, Empty, Badge, field, th, td } from './ui'
import { api, HR_RESOURCE, type HrOpening } from './types'

interface RecruitSummary {
  openings: { total: number; byStatus: Record<string, number>; openGap: number }
  candidates: { total: number; byStage: Record<string, number> }
}

const OPENING_STATUSES = ['draft', 'open', 'paused', 'closed'] as const

/** 招聘汇总 + 职位状态切换 */
export function RecruitOps() {
  const t = useTranslations('hrLifecycle')
  const qc = useQueryClient()
  const [pending, setPending] = React.useState<Record<string, string>>({})

  const sumQ = useQuery({
    queryKey: ['hrl', 'recruitment-summary'],
    queryFn: () => api<RecruitSummary>(`${HR_RESOURCE}/recruitment/summary`),
  })
  const openQ = useQuery({
    queryKey: ['hrl', 'openings-ops'],
    queryFn: () => api<unknown>(`${HR_RESOURCE}/openings`),
  })
  const openings = rowsOf<HrOpening>(openQ.data)

  const setStatus = useMutation({
    mutationFn: (p: { id: string; status: string }) =>
      api(`${HR_RESOURCE}/openings/${p.id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: p.status }),
      }),
    onSuccess: () => {
      toast.success(t('done'))
      qc.invalidateQueries({ queryKey: ['hrl'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const s = sumQ.data

  return (
    <div className="space-y-3">
      <Card title={t('recruitSummaryTitle')}>
        {!s ? (
          <Empty text={t('loading')} />
        ) : (
          <div className="space-y-1 text-xs">
            <div className="flex flex-wrap gap-4 tabular-nums">
              <span>
                {t('openingsTotal')}: <b>{s.openings.total}</b>
              </span>
              <span className={s.openings.openGap > 0 ? 'text-warning' : 'text-success'}>
                {t('openGap')}: <b>{s.openings.openGap}</b>
              </span>
              <span>
                {t('candidatesTotal')}: <b>{s.candidates.total}</b>
              </span>
            </div>
            <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
              <span>
                {t('byStatus')}:{' '}
                <span className="font-mono">
                  {Object.entries(s.openings.byStatus)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(' / ') || '-'}
                </span>
              </span>
              <span>
                {t('byStage')}:{' '}
                <span className="font-mono">
                  {Object.entries(s.candidates.byStage)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(' / ') || '-'}
                </span>
              </span>
            </div>
          </div>
        )}
      </Card>

      <Card title={t('openingStatusTitle')}>
        {openings.length === 0 ? (
          <Empty text={t('noOpenings')} />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>{t('openingCode')}</th>
                <th className={th}>{t('openingTitle')}</th>
                <th className={th}>{t('headCount')}</th>
                <th className={th}>{t('hiredCount')}</th>
                <th className={th}>{t('status')}</th>
                <th className={th}>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {openings.map((o) => {
                const next = pending[o.id] ?? o.status
                return (
                  <tr key={o.id} className="border-t border-stroke-subtle">
                    <td className={`${td} font-mono`}>{o.code}</td>
                    <td className={td}>{o.title}</td>
                    <td className={`${td} tabular-nums`}>{o.headCount}</td>
                    <td className={`${td} tabular-nums`}>{o.hiredCount}</td>
                    <td className={td}>
                      <Badge status={o.status} />
                    </td>
                    <td className={td}>
                      <div className="flex items-center gap-1">
                        <select
                          className={field}
                          value={next}
                          onChange={(e) => setPending({ ...pending, [o.id]: e.target.value })}
                        >
                          {OPENING_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          disabled={next === o.status || setStatus.isPending}
                          onClick={() => setStatus.mutate({ id: o.id, status: next })}
                        >
                          {t('applyStatus')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
