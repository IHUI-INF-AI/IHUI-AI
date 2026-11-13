// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:watermarked

'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Upload, Calculator, Wallet, FileSpreadsheet, ClipboardCheck } from 'lucide-react'

import { HasPermi } from '@/components/auth/HasPermi'
import { Button } from '@ihui/ui-react'
import { BackButton } from '@/components/common'

import { IMPORT_RESOURCE, IMPORT_PERM, currentMonth } from './helpers'
import type { ImportBatch, UploadResult } from './types'
import { api } from './types'
import { BatchDetail, SettleTab, PayrollTab } from './parts'
import { TodosTab } from './todos-tab'
import { inputCls } from './parts'

/**
 * 人事数据中心(HR-5 第 6 期)。
 *
 * 三块一体:导入外部考勤 → 结算(日结/月结) → 算薪。
 * 拆成独立页面会让 HR 在三个 tab 之间来回跳,数据流本来就是一条链,
 * 所以放在同一页按顺序推进,每块做完才解锁下一块。
 */

type TabKey = 'import' | 'settle' | 'payroll' | 'todo'

const KIND_LABEL_KEY: Record<string, string> = {
  attendance: 'kindAttendance',
  leave: 'kindLeave',
  overtime: 'kindOvertime',
  outgoing: 'kindOutgoing',
}

/** 批次状态徽章 */
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

export default function HrDataPage() {
  const t = useTranslations('hrData')
  const [tab, setTab] = React.useState<TabKey>('import')
  const [periodMonth, setPeriodMonth] = React.useState(currentMonth())

  const tabs: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
    { key: 'import', label: t('tabImport'), icon: <Upload className="h-4 w-4" /> },
    { key: 'settle', label: t('tabSettle'), icon: <Calculator className="h-4 w-4" /> },
    { key: 'payroll', label: t('tabPayroll'), icon: <Wallet className="h-4 w-4" /> },
    { key: 'todo', label: t('tabTodo'), icon: <ClipboardCheck className="h-4 w-4" /> },
  ]

  return (
    <div className="space-y-4 px-4 py-4">
      <BackButton />
      <h1 className="flex items-center gap-2 text-display font-bold tracking-tight">
        <FileSpreadsheet className="h-6 w-6 text-primary" />
        {t('title')}
      </h1>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-body">
          {t('periodMonth')}
          <input
            className={inputCls}
            type="month"
            value={periodMonth}
            onChange={(e) => setPeriodMonth(e.target.value)}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-1 border-b">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`flex items-center gap-1 px-3 py-2 text-body ${
              tab === tb.key
                ? 'border-b-2 border-primary font-medium text-primary'
                : 'text-muted-foreground'
            }`}
          >
            {tb.icon}
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'import' && <ImportTab t={t} periodMonth={periodMonth} />}
      {tab === 'settle' && <SettleTab t={t} periodMonth={periodMonth} />}
      {tab === 'payroll' && <PayrollTab t={t} periodMonth={periodMonth} />}
      {tab === 'todo' && <TodosTab t={t} />}
    </div>
  )
}

// =============================================================================
// 导入
// =============================================================================

function ImportTab({
  t,
  periodMonth,
}: {
  t: ReturnType<typeof useTranslations>
  periodMonth: string
}) {
  const qc = useQueryClient()
  const [kind, setKind] = React.useState('attendance')
  const [activeBatchId, setActiveBatchId] = React.useState<string | null>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)

  const batchesQuery = useQuery({
    queryKey: ['hr-data', 'batches', periodMonth],
    queryFn: () =>
      api<{ list?: ImportBatch[] } | ImportBatch[]>(
        `${IMPORT_RESOURCE}/batches?periodMonth=${periodMonth}`,
      ),
  })
  const batches: ImportBatch[] = Array.isArray(batchesQuery.data)
    ? batchesQuery.data
    : ((batchesQuery.data as { list?: ImportBatch[] })?.list ?? [])

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('periodMonth', periodMonth)
      fd.append('importKind', kind)
      fd.append('file', file)
      return api<UploadResult>(`${IMPORT_RESOURCE}/batches`, { method: 'POST', body: fd })
    },
    onSuccess: (data) => {
      toast.success(
        t('uploadDone', {
          total: data.totalRows,
          matched: data.matchedRows,
          conflict: data.conflictRows,
          notFound: data.notFoundRows,
        }),
      )
      setActiveBatchId(data.batchId)
      qc.invalidateQueries({ queryKey: ['hr-data', 'batches'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const confirmMut = useMutation({
    mutationFn: (batchId: string) =>
      api(`${IMPORT_RESOURCE}/batches/${batchId}/confirm`, { method: 'POST' }),
    onSuccess: () => {
      toast.success(t('confirmDone'))
      qc.invalidateQueries({ queryKey: ['hr-data', 'batches'] })
      qc.invalidateQueries({ queryKey: ['hr-data', 'batch', activeBatchId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-body">
          {t('importKind')}
          <select
            className={inputCls}
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {Object.keys(KIND_LABEL_KEY).map((k) => (
              <option key={k} value={k}>
                {t(KIND_LABEL_KEY[k] as 'kindAttendance')}
              </option>
            ))}
          </select>
        </label>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" />
        <HasPermi code={IMPORT_PERM}>
          <Button
            size="sm"
            disabled={uploadMut.isPending}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {t('upload')}
          </Button>
        </HasPermi>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) uploadMut.mutate(f)
            e.target.value = ''
          }}
        />
      </div>

      <p className="text-label text-muted-foreground">{t('importHint')}</p>

      {batchesQuery.isLoading ? (
        <p className="text-muted-foreground">{t('loading')}</p>
      ) : batches.length === 0 ? (
        <p className="text-muted-foreground">{t('noData')}</p>
      ) : (
        <table className="w-full text-body">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="px-2 py-1">{t('colKind')}</th>
              <th className="px-2 py-1">{t('colFile')}</th>
              <th className="px-2 py-1">{t('colStatus')}</th>
              <th className="px-2 py-1">{t('colTotal')}</th>
              <th className="px-2 py-1">{t('colConflict')}</th>
              <th className="px-2 py-1">{t('colNotFound')}</th>
              <th className="px-2 py-1">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id} className="border-t">
                <td className="px-2 py-1">
                  {t((KIND_LABEL_KEY[b.importKind] ?? 'kindAttendance') as 'kindAttendance')}
                </td>
                <td className="px-2 py-1">{b.fileName}</td>
                <td className="px-2 py-1">
                  <Badge tone={b.status === 'verified' ? 'ok' : 'warn'}>
                    {t(`batch_${b.status}` as 'batch_parsing')}
                  </Badge>
                </td>
                <td className="px-2 py-1">{b.totalRows}</td>
                <td className="px-2 py-1">
                  {b.conflictRows > 0 ? (
                    <span className="font-medium text-destructive">{b.conflictRows}</span>
                  ) : (
                    b.conflictRows
                  )}
                </td>
                <td className="px-2 py-1">{b.notFoundRows}</td>
                <td className="px-2 py-1">
                  <button
                    className="text-primary underline"
                    onClick={() => setActiveBatchId(b.id)}
                  >
                    {t('viewDetail')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {activeBatchId && (
        <BatchDetail
          t={t}
          batchId={activeBatchId}
          onConfirm={() => confirmMut.mutate(activeBatchId)}
          confirming={confirmMut.isPending}
          onClose={() => setActiveBatchId(null)}
        />
      )}
    </section>
  )
}
