// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Plus, FileDown } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { rowsOf } from '@/lib/api-rows'
import {
  api,
  PAYOUT_RESOURCE,
  fmtMoney,
  currentMonth,
  type PayoutBatch,
  type PayoutExport,
  type BankCoverage,
  type PayoutSummary,
} from './types'
import { Card, Empty, Badge, field, th, td, btnGhost, downloadText } from './ui'

export function PayoutTab() {
  const t = useTranslations('hrLifecycle')
  const qc = useQueryClient()
  const [periodMonth, setPeriodMonth] = React.useState(currentMonth())
  const [exported, setExported] = React.useState<PayoutExport | null>(null)

  const batchesQ = useQuery({
    queryKey: ['hrl', 'payout', periodMonth],
    queryFn: () =>
      api<unknown>(`${PAYOUT_RESOURCE}/batches${periodMonth ? `?periodMonth=${periodMonth}` : ''}`),
  })
  const coverQ = useQuery({
    queryKey: ['hrl', 'coverage', periodMonth],
    queryFn: () => api<BankCoverage>(`${PAYOUT_RESOURCE}/bank-coverage?periodMonth=${periodMonth}`),
  })
  const batches = rowsOf<PayoutBatch>(batchesQ.data)
  const cover = coverQ.data
  const summaryQ = useQuery({
    queryKey: ['hrl', 'payout-summary', periodMonth],
    enabled: Boolean(periodMonth),
    queryFn: () =>
      api<PayoutSummary>(`${PAYOUT_RESOURCE}/summary?periodMonth=${periodMonth}`),
  })
  const summary = summaryQ.data
  const invalidate = () => qc.invalidateQueries({ queryKey: ['hrl'] })

  // ---------- 工资条(2026-11-23 补):生成 → 推送 → 员工签收 ----------
  interface HrPayslip {
    id: string
    periodMonth: string
    employeeId: string
    status: string
    snapshot: Record<string, unknown> | null
    pushedAt: string | null
    acknowledgedAt: string | null
    ackChannel: string | null
  }
  const slipName = (s: HrPayslip) => {
    const snap = s.snapshot ?? {}
    const name = snap.name ?? snap.employeeName
    const no = snap.employeeNo
    return typeof name === 'string'
      ? `${no ? `${String(no)} ` : ''}${name}`
      : s.employeeId.slice(0, 8)
  }
  const slipNet = (s: HrPayslip) => {
    const snap = s.snapshot ?? {}
    const v = snap.netPay ?? snap.net ?? snap.takeHome ?? snap.totalAmount
    return v === undefined || v === null ? '-' : fmtMoney(v as string | number)
  }

  const slipsQ = useQuery({
    queryKey: ['hrl', 'payslips', periodMonth],
    queryFn: () => api<unknown>(`${PAYOUT_RESOURCE}/payslips?periodMonth=${periodMonth}`),
    enabled: !!periodMonth,
  })
  const slips = rowsOf<HrPayslip>(slipsQ.data)

  const generateSlips = useMutation({
    mutationFn: () =>
      api(`${PAYOUT_RESOURCE}/payslips/generate`, {
        method: 'POST',
        body: JSON.stringify({ periodMonth }),
      }),
    onSuccess: () => {
      toast.success(t('slipsGenerated'))
      qc.invalidateQueries({ queryKey: ['hrl', 'payslips', periodMonth] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const pushSlips = useMutation({
    mutationFn: () =>
      api(`${PAYOUT_RESOURCE}/payslips/push`, {
        method: 'POST',
        body: JSON.stringify({ periodMonth, channel: 'inapp' }),
      }),
    onSuccess: () => {
      toast.success(t('slipsPushed'))
      qc.invalidateQueries({ queryKey: ['hrl', 'payslips', periodMonth] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const ackSlip = useMutation({
    mutationFn: (id: string) =>
      api(`${PAYOUT_RESOURCE}/payslips/${id}/acknowledge`, {
        method: 'POST',
        body: JSON.stringify({ channel: 'inapp' }),
      }),
    onSuccess: () => {
      toast.success(t('slipAcknowledged'))
      qc.invalidateQueries({ queryKey: ['hrl', 'payslips', periodMonth] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const build = useMutation({
    mutationFn: () =>
      api(`${PAYOUT_RESOURCE}/batches`, { method: 'POST', body: JSON.stringify({ periodMonth }) }),
    onSuccess: () => {
      toast.success(t('done'))
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const exportFile = useMutation({
    mutationFn: (id: string) =>
      api<PayoutExport>(`${PAYOUT_RESOURCE}/batches/${id}/export`, { method: 'POST' }),
    onSuccess: (data) => {
      setExported(data)
      toast.success(t('exported'))
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const mark = useMutation({
    mutationFn: (input: { id: string; to: 'submit' | 'paid' }) =>
      api(`${PAYOUT_RESOURCE}/batches/${input.id}/${input.to}`, { method: 'POST' }),
    onSuccess: () => {
      toast.success(t('done'))
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-3">
      <Card
        title={t('payoutSummaryTitle')}
        actions={
          summary ? (
            <span className="text-[11px] text-muted-foreground">{summary.periodMonth}</span>
          ) : null
        }
      >
        {!summary ? (
          <Empty text={t('loading')} />
        ) : (
          <div className="flex flex-wrap gap-4 text-xs tabular-nums">
            <span>
              {t('payoutLatestBatch')}:{' '}
              {summary.batch ? <Badge status={summary.batch.status} /> : t('noneBatch')}
            </span>
            {summary.batch && (
              <>
                <span>
                  {t('headCount')}: <b>{summary.batch.headCount}</b>
                </span>
                <span>
                  {t('totalAmount')}: <b>{fmtMoney(summary.batch.totalAmount)}</b>
                </span>
                <span
                  className={summary.batch.missing > 0 ? 'text-warning' : 'text-success'}
                >
                  {t('missingCards')}: <b>{summary.batch.missing}</b>
                </span>
              </>
            )}
            <span>
              {t('batchCount')}: {summary.batches}
            </span>
            <span>
              {t('slipTotal')}: {summary.slips.total}
            </span>
            <span>
              {t('generated')}: {summary.slips.generated}
            </span>
            <span>
              {t('pushed')}: {summary.slips.pushed}
            </span>
            <span className="text-success">
              {t('acknowledged')}: {summary.slips.acknowledged}
            </span>
          </div>
        )}
      </Card>

      <Card
        title={t('payoutTitle')}
        actions={
          <div className="flex items-end gap-1">
            <input
              className={`${field} w-32`}
              placeholder={t('periodMonth')}
              value={periodMonth}
              onChange={(e) => setPeriodMonth(e.target.value)}
            />
            <Button
              size="sm"
              disabled={!periodMonth || build.isPending}
              onClick={() => build.mutate()}
            >
              <Plus className="h-3.5 w-3.5" />
              {t('buildBatch')}
            </Button>
          </div>
        }
      >
        {batches.length === 0 ? (
          <Empty text={t('noBatches')} />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>{t('periodMonth')}</th>
                <th className={th}>{t('headCount')}</th>
                <th className={th}>{t('totalAmount')}</th>
                <th className={th}>{t('fileHash')}</th>
                <th className={th}>{t('status')}</th>
                <th className={th}>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-t border-stroke-subtle">
                  <td className={td}>{b.periodMonth}</td>
                  <td className={`${td} tabular-nums`}>{b.headCount}</td>
                  <td className={`${td} tabular-nums`}>{fmtMoney(b.totalAmount)}</td>
                  <td className={`${td} font-mono text-[10px]`}>
                    {b.fileHash?.slice(0, 12) ?? '-'}
                  </td>
                  <td className={td}>
                    <Badge status={b.status} />
                  </td>
                  <td className={td}>
                    <div className="flex flex-wrap gap-0.5">
                      {b.status !== 'paid' && (
                        <button
                          className={btnGhost}
                          disabled={exportFile.isPending}
                          onClick={() => exportFile.mutate(b.id)}
                        >
                          <FileDown className="h-3 w-3" />
                          {t('exportFile')}
                        </button>
                      )}
                      {b.status === 'exported' && (
                        <button
                          className={btnGhost}
                          onClick={() => mark.mutate({ id: b.id, to: 'submit' })}
                        >
                          {t('markSubmitted')}
                        </button>
                      )}
                      {b.status === 'submitted' && (
                        <button
                          className={btnGhost}
                          onClick={() => mark.mutate({ id: b.id, to: 'paid' })}
                        >
                          {t('markPaid')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {exported && (
        <Card title={t('exportResult')}>
          <p className="text-xs text-muted-foreground">
            {exported.fileName} · {t('headCount')} {exported.rows} ·{' '}
            {fmtMoney(exported.totalAmount)} · sha256 {exported.fileHash.slice(0, 12)}
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              onClick={() => downloadText(exported.fileName, exported.content, true)}
            >
              <FileDown className="h-3.5 w-3.5" />
              {t('downloadCsv')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setExported(null)}>
              {t('close')}
            </Button>
          </div>
        </Card>
      )}

      <Card
        title={t('payslipsTitle')}
        actions={
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-muted-foreground">{slips.length}</span>
            <Button
              size="sm"
              variant="outline"
              disabled={!periodMonth || generateSlips.isPending}
              onClick={() => generateSlips.mutate()}
            >
              <Plus className="h-3.5 w-3.5" />
              {t('generateSlips')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!periodMonth || pushSlips.isPending}
              onClick={() => pushSlips.mutate()}
            >
              {t('pushSlips')}
            </Button>
          </div>
        }
      >
        {slips.length === 0 ? (
          <Empty text={t('noPayslips')} />
        ) : (
          <div className="max-h-64 overflow-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className={th}>{t('employeeName')}</th>
                  <th className={th}>{t('periodMonth')}</th>
                  <th className={th}>{t('netPay')}</th>
                  <th className={th}>{t('status')}</th>
                  <th className={th}>{t('acknowledgedAt')}</th>
                  <th className={th}>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {slips.map((s) => (
                  <tr key={s.id} className="border-t border-stroke-subtle">
                    <td className={td}>{slipName(s)}</td>
                    <td className={td}>{s.periodMonth}</td>
                    <td className={`${td} tabular-nums`}>{slipNet(s)}</td>
                    <td className={td}>
                      <Badge status={s.status} />
                    </td>
                    <td className={td}>{s.acknowledgedAt ?? '-'}</td>
                    <td className={td}>
                      {s.status !== 'acknowledged' && (
                        <button
                          className={btnGhost}
                          disabled={ackSlip.isPending}
                          onClick={() => ackSlip.mutate(s.id)}
                        >
                          {t('acknowledge')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={t('coverageTitle')}>
        {!cover ? (
          <Empty text={t('loading')} />
        ) : (
          <div className="space-y-1 text-xs">
            <p className="text-muted-foreground">
              {t('coverageHint', {
                total: Number(cover.total ?? 0),
                withAccount: Number(cover.covered ?? 0),
                missing: Number(cover.missing ?? 0),
              })}
            </p>
            {(cover.missingList ?? []).length > 0 && (
              <table className="w-full">
                <thead>
                  <tr>
                    <th className={th}>{t('employeeNo')}</th>
                    <th className={th}>{t('employeeName')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(cover.missingList ?? []).map((m) => (
                    <tr key={m.employeeNo} className="border-t border-stroke-subtle">
                      <td className={td}>{m.employeeNo}</td>
                      <td className={td}>{m.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

/** 文本落盘(BOM 由后端已带,这里只在需要时补) */
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
