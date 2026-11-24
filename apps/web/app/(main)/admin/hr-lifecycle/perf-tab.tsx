// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 绩效 tab(2026-11-24 九波):周期管理 + 发起评估 + 评分动作 + 等级分布。走 /api/hr-perf。
 */
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { RefreshCw, Play, Square, Users, Star } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { api } from './types'
import { Card, Empty, Badge, field, th, td, btnGhost } from './ui'

const PERF = '/api/hr-perf'

type Row = Record<string, unknown>
function rowsOf(v: unknown): Row[] {
  if (Array.isArray(v)) return v as Row[]
  const o = v as { rows?: Row[]; list?: Row[] }
  return o?.rows ?? o?.list ?? []
}

export function PerfTab() {
  const t = useTranslations('hrGap')
  const qc = useQueryClient()
  const [cycleName, setCycleName] = React.useState('')
  const [cycleType, setCycleType] = React.useState('quarter')
  const [startFrom, setStartFrom] = React.useState(new Date().toISOString().slice(0, 10))
  const [endTo, setEndTo] = React.useState('')
  const [selectedCycle, setSelectedCycle] = React.useState('')
  const [employeeId, setEmployeeId] = React.useState('')
  const [reviewerId, setReviewerId] = React.useState('')
  const [finalScore, setFinalScore] = React.useState('')
  const [managerComment, setManagerComment] = React.useState('')

  const cyclesQ = useQuery({
    queryKey: ['hrp', 'cycles'],
    queryFn: () => api<unknown>(`${PERF}/cycles`),
  })
  const reviewsQ = useQuery({
    queryKey: ['hrp', 'reviews', selectedCycle],
    queryFn: () => api<unknown>(`${PERF}/cycles/${selectedCycle}/reviews`),
    enabled: Boolean(selectedCycle),
  })
  const distQ = useQuery({
    queryKey: ['hrp', 'dist', selectedCycle],
    queryFn: () => api<unknown>(`${PERF}/cycles/${selectedCycle}/distribution`),
    enabled: Boolean(selectedCycle),
  })
  const employeesQ = useQuery({
    queryKey: ['hr', 'employees'],
    queryFn: () => api<unknown>('/api/hr-attendance/employees'),
  })
  const cycles = rowsOf(cyclesQ.data)
  const reviews = rowsOf(reviewsQ.data)
  const dist = rowsOf(distQ.data)
  const employees = rowsOf(employeesQ.data)
  const invalidate = () => qc.invalidateQueries({ queryKey: ['hrp'] })

  const createCycle = useMutation({
    mutationFn: () =>
      api(`${PERF}/cycles`, {
        method: 'POST',
        body: JSON.stringify({ name: cycleName.trim(), cycleType, startFrom, endTo: endTo || startFrom }),
      }),
    onSuccess: () => {
      toast.success(t('done'))
      setCycleName('')
      invalidate()
      cyclesQ.refetch()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const cycleStatus = useMutation({
    mutationFn: (input: { id: string; status: 'open' | 'closed' }) =>
      api(`${PERF}/cycles/${input.id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: input.status }),
      }),
    onSuccess: () => {
      toast.success(t('done'))
      invalidate()
      cyclesQ.refetch()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const launch = useMutation({
    mutationFn: () =>
      api<{ created?: number; skipped?: string[] }>(`${PERF}/cycles/${selectedCycle}/launch`, {
        method: 'POST',
        body: JSON.stringify({ assignments: [{ employeeId, reviewerId }] }),
      }),
    onSuccess: (r: { created?: number; skipped?: string[] }) => {
      toast.success(`${t('done')} created=${r?.created ?? 0} skipped=${(r?.skipped ?? []).join(';')}`)
      invalidate()
      reviewsQ.refetch()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const score = useMutation({
    mutationFn: (id: string) =>
      api(`${PERF}/reviews/${id}/manager`, {
        method: 'POST',
        body: JSON.stringify({ finalScore: Number(finalScore), comment: managerComment.trim() || 'ok' }),
      }),
    onSuccess: () => {
      toast.success(t('done'))
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-3">
      <Card
        title={t('perfCycleTitle')}
        actions={
          <button className={btnGhost} onClick={() => cyclesQ.refetch()}>
            <RefreshCw className="h-3 w-3" />
            {t('refresh')}
          </button>
        }
      >
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <input className={field} placeholder={t('perfCycleName')} value={cycleName} onChange={(e) => setCycleName(e.target.value)} />
          <select className={field} value={cycleType} onChange={(e) => setCycleType(e.target.value)}>
            {['month', 'quarter', 'half', 'year'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input type="date" className={field} value={startFrom} onChange={(e) => setStartFrom(e.target.value)} />
          <input type="date" className={field} value={endTo} onChange={(e) => setEndTo(e.target.value)} />
          <Button size="sm" disabled={!cycleName.trim() || createCycle.isPending} onClick={() => createCycle.mutate()}>
            {t('create')}
          </Button>
        </div>
        {cycles.length === 0 ? (
          <Empty text={t('noData')} />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>{t('perfCycleName')}</th>
                <th className={th}>{t('perfType')}</th>
                <th className={th}>{t('perfRange')}</th>
                <th className={th}>{t('colStatus')}</th>
                <th className={th}>{t('colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {cycles.map((c) => (
                <tr key={String(c.id)} className="border-t border-stroke-subtle">
                  <td className={td}>
                    <button className={btnGhost} onClick={() => setSelectedCycle(String(c.id))}>
                      {String(c.name)}
                    </button>
                  </td>
                  <td className={td}>{String(c.cycleType)}</td>
                  <td className={td}>
                    {String(c.startFrom).slice(0, 10)} ~ {String(c.endTo).slice(0, 10)}
                  </td>
                  <td className={td}>
                    <Badge status={String(c.status)} />
                  </td>
                  <td className={td}>
                    {c.status === 'draft' ? (
                      <button className={btnGhost} onClick={() => cycleStatus.mutate({ id: String(c.id), status: 'open' })}>
                        <Play className="h-3 w-3" />
                        {t('perfOpenCycle')}
                      </button>
                    ) : null}
                    {c.status === 'reviewing' || c.status === 'open' ? (
                      <button className={btnGhost} onClick={() => cycleStatus.mutate({ id: String(c.id), status: 'closed' })}>
                        <Square className="h-3 w-3" />
                        {t('perfCloseCycle')}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {selectedCycle ? (
        <>
          <Card title={`${t('perfLaunchTitle')} · ${cycles.find((c) => String(c.id) === selectedCycle)?.name ?? ''}`}>
            <div className="mb-2 flex flex-wrap items-end gap-2">
              <select className={field} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                <option value="">{t('perfAssignEmployee')}</option>
                {employees.map((emp) => (
                  <option key={String(emp.id)} value={String(emp.id)}>
                    {String(emp.name ?? emp.id)}
                  </option>
                ))}
              </select>
              <input className={field} placeholder={t('perfAssignReviewer')} value={reviewerId} onChange={(e) => setReviewerId(e.target.value)} />
              <Button size="sm" disabled={!employeeId || !selectedCycle || launch.isPending} onClick={() => launch.mutate()}>
                {t('perfLaunchTitle')}
              </Button>
            </div>
          </Card>
          <Card title={t('perfDistTitle')}>
            {dist.length === 0 ? (
              <Empty text={t('noData')} />
            ) : (
              <div className="flex flex-wrap gap-2">
                {dist.map((d) => (
                  <div key={String(d.grade)} className="rounded-md border border-stroke-subtle px-3 py-1.5 text-xs">
                    <Star className="mr-1 inline h-3 w-3" />
                    <b>{String(d.grade)}</b> <span className="tabular-nums">{String(d.count)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card
            title={t('perfReviewsTitle')}
            actions={
              <button className={btnGhost} onClick={() => reviewsQ.refetch()}>
                <Users className="h-3 w-3" />
                {t('refresh')}
              </button>
            }
          >
            {reviews.length === 0 ? (
              <Empty text={t('noData')} />
            ) : (
              <table className="w-full">
                <thead>
                  <tr>
                    <th className={th}>{t('expEmployee')}</th>
                    <th className={th}>{t('perfSelfScore')}</th>
                    <th className={th}>{t('perfGrade')}</th>
                    <th className={th}>{t('perfRoundsLabel')}</th>
                    <th className={th}>{t('colStatus')}</th>
                    <th className={th}>{t('colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((r) => (
                    <tr key={String(r.id)} className="border-t border-stroke-subtle">
                      <td className={td}>{String(r.employeeId).slice(0, 8)}</td>
                      <td className={`${td} tabular-nums`}>{String(r.selfScore ?? '-')}</td>
                      <td className={td}>{String(r.grade ?? '-')}</td>
                      <td className={`${td} tabular-nums`}>{String(r.rounds ?? 1)}</td>
                      <td className={td}>
                        <Badge status={String(r.status)} />
                      </td>
                      <td className={td}>
                        <div className="flex flex-wrap items-center gap-1">
                          <input
                            className={`${field} w-16`}
                            type="number"
                            min="0"
                            max="100"
                            placeholder={t('scoreLabel')}
                            value={finalScore}
                            onChange={(e) => setFinalScore(e.target.value)}
                          />
                          <input
                            className={field}
                            placeholder={t('managerComment')}
                            value={managerComment}
                            onChange={(e) => setManagerComment(e.target.value)}
                          />
                          {r.status === 'self_done' || r.status === 'refused' ? (
                            <button
                              className={btnGhost}
                              disabled={!finalScore || score.isPending}
                              onClick={() => score.mutate(String(r.id))}
                            >
                              {t('perfManagerAct')}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      ) : null}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
