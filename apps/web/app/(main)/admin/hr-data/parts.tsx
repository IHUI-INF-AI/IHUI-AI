// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:watermarked

'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Calculator, Wallet } from 'lucide-react'

import { HasPermi } from '@/components/auth/HasPermi'
import { Button } from '@ihui/ui-react'

import { IMPORT_RESOURCE, SETTLE_RESOURCE, PAYROLL_RESOURCE, IMPORT_PERM, PAYROLL_PERM } from './helpers'
import type {
  ImportBatchDetail,
  ImportRow,
  DailyBuildResult,
  MonthlyBuildResult,
  MonthlyRow,
  PayrollRow,
  PayrollBuildResult,
} from './types'
import { api } from './types'

export const inputCls =
  'rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary'

/** Badge 在 page.tsx 里也有,这里需要独立一份(跨文件不复用内部组件) */
function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  const cls =
    tone === 'ok'
      ? 'bg-success/10 text-success'
      : tone === 'danger'
        ? 'bg-destructive/10 text-destructive'
        : tone === 'warn'
          ? 'bg-warning/10 text-warning'
          : 'bg-muted text-muted-foreground'
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-label font-medium ${cls}`}>
      {children}
    </span>
  )
}

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:watermarked

// =============================================================================
// 批次详情 + 差异裁决
// =============================================================================

export function BatchDetail({
  t,
  batchId,
  onConfirm,
  confirming,
  onClose,
}: {
  t: ReturnType<typeof useTranslations>
  batchId: string
  onConfirm: () => void
  confirming: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['hr-data', 'batch', batchId],
    queryFn: () => api<ImportBatchDetail>(`${IMPORT_RESOURCE}/batches/${batchId}`),
  })

  const resolveMut = useMutation({
    mutationFn: (p: { rowId: string; resolution: 'adopt_import' | 'keep_system' }) =>
      api(`${IMPORT_RESOURCE}/rows/${p.rowId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ resolution: p.resolution }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-data', 'batch', batchId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const rows = data?.rows ?? []
  const unresolved = rows.filter((r) => r.matchStatus === 'conflict' && !r.resolved)

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('detailTitle')}</h3>
        <button className="text-label text-muted-foreground underline" onClick={onClose}>
          {t('close')}
        </button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">{t('loading')}</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground">{t('noData')}</p>
      ) : (
        <>
          <p className="text-label text-muted-foreground">
            {t('rowSummary', {
              total: rows.length,
              conflict: rows.filter((r) => r.matchStatus === 'conflict').length,
              notFound: rows.filter((r) => r.matchStatus === 'not_found').length,
              duplicate: rows.filter((r) => r.matchStatus === 'duplicate').length,
            })}
          </p>

          <div className="max-h-96 overflow-auto">
            <table className="w-full text-body">
              <thead className="sticky top-0 bg-background">
                <tr className="text-left text-muted-foreground">
                  <th className="px-2 py-1">{t('colRow')}</th>
                  <th className="px-2 py-1">{t('colEmployeeNo')}</th>
                  <th className="px-2 py-1">{t('colMatchStatus')}</th>
                  <th className="px-2 py-1">{t('colDiff')}</th>
                  <th className="px-2 py-1">{t('colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <RowItem
                    key={r.id}
                    t={t}
                    row={r}
                    onResolve={(resolution) => resolveMut.mutate({ rowId: r.id, resolution })}
                    pending={resolveMut.isPending}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-2 border-t pt-2">
            <HasPermi code={IMPORT_PERM}>
              <Button
                size="sm"
                disabled={confirming || unresolved.length > 0}
                onClick={onConfirm}
              >
                {t('confirmWrite')}
              </Button>
            </HasPermi>
            {unresolved.length > 0 && (
              <span className="text-label text-destructive">
                {t('unresolvedHint', { count: unresolved.length })}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function RowItem({
  t,
  row,
  onResolve,
  pending,
}: {
  t: ReturnType<typeof useTranslations>
  row: ImportRow
  onResolve: (r: 'adopt_import' | 'keep_system') => void
  pending: boolean
}) {
  const tone =
    row.matchStatus === 'matched'
      ? 'ok'
      : row.matchStatus === 'conflict'
        ? 'danger'
        : 'warn'
  const diffs = row.diffDetail ?? []
  return (
    <tr className="border-t align-top">
      <td className="px-2 py-1">{row.rowNumber}</td>
      <td className="px-2 py-1">{row.employeeNo ?? '-'}</td>
      <td className="px-2 py-1">
        <Badge tone={tone}>{t(`row_${row.matchStatus}` as 'row_matched')}</Badge>
        {row.resolved && <span className="ml-1 text-label text-success">{t('resolved')}</span>}
      </td>
      <td className="px-2 py-1 text-label">
        {diffs.length === 0 ? (
          '-'
        ) : (
          <ul className="space-y-0.5">
            {diffs.map((d, i) => (
              <li key={i}>
                <span className="text-muted-foreground">{d.field}:</span>{' '}
                <span className="text-destructive">{d.systemValue ?? '空'}</span>
                {' → '}
                <span className="text-primary">{d.importValue ?? '空'}</span>
              </li>
            ))}
          </ul>
        )}
      </td>
      <td className="px-2 py-1">
        {row.matchStatus === 'conflict' && !row.resolved ? (
          <div className="flex gap-1">
            <button
              className="text-primary underline"
              disabled={pending}
              onClick={() => onResolve('adopt_import')}
            >
              {t('adoptImport')}
            </button>
            <button
              className="text-muted-foreground underline"
              disabled={pending}
              onClick={() => onResolve('keep_system')}
            >
              {t('keepSystem')}
            </button>
          </div>
        ) : (
          '-'
        )}
      </td>
    </tr>
  )
}

// =============================================================================
// 结算
// =============================================================================

export function SettleTab({
  t,
  periodMonth,
}: {
  t: ReturnType<typeof useTranslations>
  periodMonth: string
}) {
  const qc = useQueryClient()

  const dailyMut = useMutation({
    mutationFn: () =>
      api<DailyBuildResult>(`${SETTLE_RESOURCE}/daily`, {
        method: 'POST',
        body: JSON.stringify({ periodMonth }),
      }),
    onSuccess: (d) => {
      toast.success(t('dailyDone', { days: d.employeeDays, inserted: d.inserted }))
      qc.invalidateQueries({ queryKey: ['hr-data', 'monthly'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const monthlyMut = useMutation({
    mutationFn: () =>
      api<MonthlyBuildResult>(`${SETTLE_RESOURCE}/monthly`, {
        method: 'POST',
        body: JSON.stringify({ periodMonth }),
      }),
    onSuccess: (d) => {
      toast.success(t('monthlyDone', { employees: d.employees, inserted: d.inserted }))
      qc.invalidateQueries({ queryKey: ['hr-data', 'monthly'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const monthlyQuery = useQuery({
    queryKey: ['hr-data', 'monthly', periodMonth],
    queryFn: () =>
      api<{ rows: MonthlyRow[] }>(`${SETTLE_RESOURCE}/monthly?periodMonth=${periodMonth}`),
  })
  const rows = monthlyQuery.data?.rows ?? []

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <HasPermi code={IMPORT_PERM}>
          <Button
            size="sm"
            disabled={dailyMut.isPending}
            onClick={() => dailyMut.mutate()}
          >
            <Calculator className="h-4 w-4" />
            {t('buildDaily')}
          </Button>
        </HasPermi>
        <HasPermi code={IMPORT_PERM}>
          <Button
            size="sm"
            variant="outline"
            disabled={monthlyMut.isPending}
            onClick={() => monthlyMut.mutate()}
          >
            {t('buildMonthly')}
          </Button>
        </HasPermi>
      </div>
      <p className="text-label text-muted-foreground">{t('settleHint')}</p>

      {monthlyQuery.isLoading ? (
        <p className="text-muted-foreground">{t('loading')}</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground">{t('noMonthly')}</p>
      ) : (
        <table className="w-full text-body">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="px-2 py-1">{t('colEmployeeNo')}</th>
              <th className="px-2 py-1">{t('colName')}</th>
              <th className="px-2 py-1">{t('colScheduledDays')}</th>
              <th className="px-2 py-1">{t('colActualDays')}</th>
              <th className="px-2 py-1">{t('colLate')}</th>
              <th className="px-2 py-1">{t('colEarly')}</th>
              <th className="px-2 py-1">{t('colAbsent')}</th>
              <th className="px-2 py-1">{t('colOtHours')}</th>
              <th className="px-2 py-1">{t('colSigned')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-2 py-1">{r.employeeNo ?? '-'}</td>
                <td className="px-2 py-1">{r.employeeName ?? '-'}</td>
                <td className="px-2 py-1">{r.scheduledDays}</td>
                <td className="px-2 py-1">{r.actualDays}</td>
                <td className="px-2 py-1">{r.lateCount}</td>
                <td className="px-2 py-1">{r.earlyCount}</td>
                <td className="px-2 py-1">{r.absentDays}</td>
                <td className="px-2 py-1">{r.otHours}</td>
                <td className="px-2 py-1">
                  {r.signed ? (
                    <Badge tone="ok">{t('yes')}</Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

// =============================================================================
// 薪资
// =============================================================================

export function PayrollTab({
  t,
  periodMonth,
}: {
  t: ReturnType<typeof useTranslations>
  periodMonth: string
}) {
  const qc = useQueryClient()
  const [region, setRegion] = React.useState('')

  const calcMut = useMutation({
    mutationFn: () =>
      api<PayrollBuildResult>(`${PAYROLL_RESOURCE}/calculate`, {
        method: 'POST',
        body: JSON.stringify({
          periodMonth,
          regionName: region || undefined,
        }),
      }),
    onSuccess: (d) => {
      toast.success(
        t('calcDone', {
          employees: d.employees,
          gross: d.totalGross.toFixed(2),
          net: d.totalNet.toFixed(2),
        }),
      )
      qc.invalidateQueries({ queryKey: ['hr-data', 'payroll'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const itemsQuery = useQuery({
    queryKey: ['hr-data', 'payroll', periodMonth],
    queryFn: () =>
      api<{ rows: PayrollRow[]; totalGross: number; totalNet: number }>(
        `${PAYROLL_RESOURCE}/items?periodMonth=${periodMonth}`,
      ),
  })
  const rows = itemsQuery.data?.rows ?? []

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-body">
          {t('region')}
          <input
            className={inputCls}
            value={region}
            placeholder={t('regionPlaceholder')}
            onChange={(e) => setRegion(e.target.value)}
          />
        </label>
        <HasPermi code={PAYROLL_PERM}>
          <Button size="sm" disabled={calcMut.isPending} onClick={() => calcMut.mutate()}>
            <Wallet className="h-4 w-4" />
            {t('calculate')}
          </Button>
        </HasPermi>
      </div>
      <p className="text-label text-muted-foreground">{t('payrollHint')}</p>

      {itemsQuery.isLoading ? (
        <p className="text-muted-foreground">{t('loading')}</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground">{t('noPayroll')}</p>
      ) : (
        <>
          <div className="flex gap-4 text-body">
            <span>
              {t('totalGross')}:{' '}
              <strong className="text-foreground">
                {(itemsQuery.data?.totalGross ?? 0).toFixed(2)}
              </strong>
            </span>
            <span>
              {t('totalNet')}:{' '}
              <strong className="text-success">
                {(itemsQuery.data?.totalNet ?? 0).toFixed(2)}
              </strong>
            </span>
          </div>
          <table className="w-full text-body">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="px-2 py-1">{t('colEmployeeNo')}</th>
                <th className="px-2 py-1">{t('colName')}</th>
                <th className="px-2 py-1">{t('colGrossPay')}</th>
                <th className="px-2 py-1">{t('colOtAmount')}</th>
                <th className="px-2 py-1">{t('colAbsenceDeduction')}</th>
                <th className="px-2 py-1">{t('colInsurance')}</th>
                <th className="px-2 py-1">{t('colTax')}</th>
                <th className="px-2 py-1">{t('colNetPay')}</th>
                <th className="px-2 py-1">{t('colNote')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="px-2 py-1">{r.employeeNo ?? '-'}</td>
                  <td className="px-2 py-1">{r.employeeName ?? '-'}</td>
                  <td className="px-2 py-1">{r.grossPay}</td>
                  <td className="px-2 py-1">{r.otAmount}</td>
                  <td className="px-2 py-1 text-destructive">
                    {Number(r.attendanceDeduction) > 0 ? `-${r.attendanceDeduction}` : '0.00'}
                  </td>
                  <td className="px-2 py-1">
                    {(
                      Number(r.insurancePersonal) + Number(r.housingFundPersonal)
                    ).toFixed(2)}
                  </td>
                  <td className="px-2 py-1">{r.incomeTax}</td>
                  <td className="px-2 py-1 font-medium text-success">{r.netPay}</td>
                  <td className="px-2 py-1 text-label text-warning">
                    {r.breakdown?.warnings?.length ? r.breakdown.warnings[0] : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}
