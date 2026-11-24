// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 申报表级复核(2026-11-23 立)。
 *
 * 一次申报常有多张表(主表 + 附表)。之前"任务 submitted"只说明有人点了按钮,
 * 表上谁编/谁审/过没过全无记录。这里按表看板:
 *   生成草稿(从申报任务取计税依据/应纳税额) → 提审 → 通过/驳回(驳回必写理由)。
 */

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { FileCheck2 } from 'lucide-react'

import { api, FIN_RESOURCE, type FinClient } from './types'
import { Card, Empty, StatusBadge, field, th, td } from './tabs'

interface ReturnRow {
  id: string
  taskId: string
  clientId: string
  taxType: string
  period: string
  formCode: string
  formName: string
  status: string
  version: number
  taxAmount: string | null
  reviewRemark: string | null
  submittedAt: string | null
  reviewedAt: string | null
}

interface Summary {
  total: number
  draft: number
  submitted: number
  approved: number
  rejected: number
  filed: number
  pendingReview: number
  allApproved: boolean
}

interface FilingTask {
  id: string
  taxType: string
  period: string
  status: string
  dueDate: string
}

export function FilingReturnReview({ clients }: { clients: FinClient[] }) {
  const t = useTranslations('finAccounting')
  const qc = useQueryClient()
  const [clientId, setClientId] = React.useState('')
  const [taskId, setTaskId] = React.useState('')
  const [formCode, setFormCode] = React.useState('')
  const [rejecting, setRejecting] = React.useState<string | null>(null)
  const [remark, setRemark] = React.useState('')

  const tasksQ = useQuery({
    queryKey: ['fin', 'filingTasks', clientId],
    queryFn: () =>
      api<{ list: FilingTask[]; total: number }>(
        `${FIN_RESOURCE}/filing-tasks?clientId=${clientId}&limit=100`,
      ),
    enabled: clientId !== '',
  })
  const tasks = tasksQ.data?.list ?? []

  const returnsQ = useQuery({
    queryKey: ['fin', 'filingReturns', clientId],
    queryFn: () =>
      api<{ list: ReturnRow[]; total: number }>(
        `${FIN_RESOURCE}/filing/returns?clientId=${clientId}&limit=100`,
      ),
    enabled: clientId !== '',
  })
  const rows = returnsQ.data?.list ?? []

  const summaryQ = useQuery({
    queryKey: ['fin', 'filingReturnsSummary', clientId],
    queryFn: () => api<Summary>(`${FIN_RESOURCE}/filing/returns/summary?clientId=${clientId}`),
    enabled: clientId !== '',
  })
  const summary = summaryQ.data

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['fin', 'filingReturns', clientId] })
    void qc.invalidateQueries({ queryKey: ['fin', 'filingReturnsSummary', clientId] })
  }

  const generateMut = useMutation({
    mutationFn: () => {
      if (!taskId) throw new Error(t('filingPickTask'))
      return api(`${FIN_RESOURCE}/filing/returns/generate`, {
        method: 'POST',
        body: JSON.stringify({
          taskId,
          ...(formCode.trim() ? { formCode: formCode.trim() } : {}),
        }),
      })
    },
    onSuccess: () => {
      toast.success(t('filingGenerated'))
      setFormCode('')
      refresh()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const submitMut = useMutation({
    mutationFn: (id: string) =>
      api(`${FIN_RESOURCE}/filing/returns/${id}/submit`, { method: 'POST' }),
    onSuccess: () => {
      toast.success(t('filingSubmittedOk'))
      refresh()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const reviewMut = useMutation({
    mutationFn: (p: { id: string; approve: boolean; remark?: string }) =>
      api(`${FIN_RESOURCE}/filing/returns/${p.id}/review`, {
        method: 'POST',
        body: JSON.stringify({ approve: p.approve, ...(p.remark ? { remark: p.remark } : {}) }),
      }),
    onSuccess: (_d, v) => {
      toast.success(v.approve ? t('filingApproved') : t('filingRejected'))
      setRejecting(null)
      setRemark('')
      refresh()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Card
      title={t('filingReviewTitle')}
      actions={
        summary ? (
          <span className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
            <span>{t('filingReviewTotal', { count: summary.total })}</span>
            <span>· {t('filingPendingReview', { count: summary.pendingReview })}</span>
            <span>· {t('filingApprovedCount', { count: summary.approved })}</span>
            {summary.rejected > 0 && (
              <span className="text-destructive">
                · {t('filingRejectedCount', { count: summary.rejected })}
              </span>
            )}
            {summary.allApproved && (
              <span className="text-success">· {t('filingAllApproved')}</span>
            )}
          </span>
        ) : null
      }
    >
      <div className="mb-2 flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted-foreground">
          {t('colClient')}
          <select
            className={`${field} block`}
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value)
              setTaskId('')
            }}
          >
            <option value="">{t('pickClient')}</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {clientId && (
          <>
            <label className="text-xs text-muted-foreground">
              {t('filingTask')}
              <select
                className={`${field} block`}
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
              >
                <option value="">{t('filingPickTask')}</option>
                {tasks.map((tk) => (
                  <option key={tk.id} value={tk.id}>
                    {tk.taxType} · {tk.period} · {tk.status} · {tk.dueDate}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              {t('filingFormCode')}
              <input
                className={`${field} block`}
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder={t('filingFormCodeHint')}
              />
            </label>
            <button
              className="rounded-md bg-primary px-2.5 py-1 text-xs text-primary-foreground disabled:opacity-50"
              disabled={generateMut.isPending}
              onClick={() => generateMut.mutate()}
            >
              <FileCheck2 className="mr-1 inline h-3 w-3" />
              {t('filingGenerate')}
            </button>
          </>
        )}
      </div>

      {!clientId ? (
        <Empty text={t('pickClient')} />
      ) : returnsQ.isLoading ? (
        <Empty text={t('loading')} />
      ) : rows.length === 0 ? (
        <Empty text={t('filingEmpty')} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>{t('colPeriod')}</th>
                <th className={th}>{t('filingFormName')}</th>
                <th className={th}>{t('colTaxAmount')}</th>
                <th className={th}>{t('colStatus')}</th>
                <th className={th}>{t('filingVersion')}</th>
                <th className={th}>{t('filingReviewRemark')}</th>
                <th className={th}>{t('colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-stroke-subtle">
                  <td className={td}>{r.period}</td>
                  <td className={td}>{r.formName}</td>
                  <td className={td}>{r.taxAmount ?? '-'}</td>
                  <td className={td}>
                    <StatusBadge status={r.status} />
                  </td>
                  <td className={td}>v{r.version}</td>
                  <td className={`${td} max-w-56 truncate`}>{r.reviewRemark ?? '-'}</td>
                  <td className={`${td} space-x-2 whitespace-nowrap`}>
                    {(r.status === 'draft' || r.status === 'rejected') && (
                      <button
                        className="text-primary hover:underline"
                        disabled={submitMut.isPending}
                        onClick={() => submitMut.mutate(r.id)}
                      >
                        {t('filingSubmitReview')}
                      </button>
                    )}
                    {r.status === 'submitted' &&
                      (rejecting === r.id ? (
                        <>
                          <input
                            className={field}
                            value={remark}
                            onChange={(e) => setRemark(e.target.value)}
                            placeholder={t('filingRejectReason')}
                          />
                          <button
                            className="text-destructive hover:underline"
                            disabled={reviewMut.isPending}
                            onClick={() => {
                              if (!remark.trim()) {
                                toast.error(t('filingRejectReason'))
                                return
                              }
                              reviewMut.mutate({
                                id: r.id,
                                approve: false,
                                remark: remark.trim(),
                              })
                            }}
                          >
                            {t('filingConfirmReject')}
                          </button>
                          <button
                            className="text-muted-foreground hover:underline"
                            onClick={() => {
                              setRejecting(null)
                              setRemark('')
                            }}
                          >
                            {t('cancel')}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="text-primary hover:underline"
                            disabled={reviewMut.isPending}
                            onClick={() => reviewMut.mutate({ id: r.id, approve: true })}
                          >
                            {t('filingApprove')}
                          </button>
                          <button
                            className="text-destructive hover:underline"
                            disabled={reviewMut.isPending}
                            onClick={() => {
                              setRejecting(r.id)
                              setRemark('')
                            }}
                          >
                            {t('filingReject')}
                          </button>
                        </>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
