// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 请假多级审批待办台(2026-11-23 立)。
 *
 * 三件事一屏:
 *   · 提交:把某张请假单(id)按规则落实例(路由规则 → 第一级审批人 + 微信通知);
 *   · 待办:按审批人查当前步指向他的实例(pending/escalated),当场通过/驳回;
 *   · 升级:到点未决的实例一键扫描升级(有升级目标则追加一级,无则记轨迹顺延)。
 */

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ArrowUpRight } from 'lucide-react'

import { apiOrThrow as api } from '@/lib/api'
import { ApproverSingle, appField } from './approvers'

const BASE = '/api/hr-approval'

interface InstanceRow {
  id: string
  leaveRequestId: string
  chainSnapshot: string[]
  currentStep: number
  status: string
  dueAt: string | null
  createdAt: string | null
}

function stamp(ts: string | null): string {
  if (!ts) return '-'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
}

export function InstancesPanel() {
  const t = useTranslations('hrApproval')
  const qc = useQueryClient()
  const [approverId, setApproverId] = React.useState('')
  const [leaveId, setLeaveId] = React.useState('')
  const [decidingId, setDecidingId] = React.useState<string | null>(null)
  const [remark, setRemark] = React.useState('')

  const listQuery = useQuery({
    queryKey: ['hr', 'approval', 'instances', approverId],
    queryFn: () =>
      api<{ list: InstanceRow[]; total: number }>(
        `${BASE}/instances?approverId=${approverId}&limit=50`,
      ),
    enabled: approverId !== '',
  })
  const list = listQuery.data?.list ?? []

  const submitMut = useMutation({
    mutationFn: () => {
      if (!leaveId.trim()) throw new Error(t('leaveIdRequired'))
      return api(`${BASE}/leave/${leaveId.trim()}/submit`, { method: 'POST' })
    },
    onSuccess: () => {
      toast.success(t('leaveSubmitted'))
      setLeaveId('')
      void qc.invalidateQueries({ queryKey: ['hr', 'approval', 'instances'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const decideMut = useMutation({
    mutationFn: (p: { id: string; action: 'approved' | 'rejected'; remark?: string }) =>
      api(`${BASE}/leave/${p.id}/decide`, {
        method: 'PUT',
        body: JSON.stringify({
          instanceId: p.id,
          approverId,
          action: p.action,
          ...(p.remark ? { remark: p.remark } : {}),
        }),
      }),
    onSuccess: (_d, v) => {
      toast.success(v.action === 'approved' ? t('approved') : t('rejected'))
      setDecidingId(null)
      setRemark('')
      void qc.invalidateQueries({ queryKey: ['hr', 'approval', 'instances'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const escalateMut = useMutation({
    mutationFn: () => api<{ escalated: number }>(`${BASE}/instances/escalate`, { method: 'POST' }),
    onSuccess: (v) => {
      toast.success(t('escalatedDone', { count: v.escalated }))
      void qc.invalidateQueries({ queryKey: ['hr', 'approval', 'instances'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{t('tabInstances')}</h2>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-stroke-subtle p-3">
        <ApproverSingle
          label={t('approver')}
          value={approverId}
          onChange={setApproverId}
          placeholder={t('optionalUuid')}
        />
        <button
          className="font-[weight:inherit] inline-flex items-center gap-1 rounded-md border border-stroke-default px-3 py-1.5 text-body hover:bg-muted disabled:opacity-50"
          disabled={escalateMut.isPending}
          onClick={() => escalateMut.mutate()}
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
          {t('escalateScan')}
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-stroke-subtle p-3">
        <label className="min-w-64 text-body">
          {t('leaveRequestId')}
          <input
            className={`${appField} w-full`}
            value={leaveId}
            onChange={(e) => setLeaveId(e.target.value)}
            placeholder={t('leaveIdPlaceholder')}
          />
        </label>
        <button
          className="font-[weight:inherit] rounded-md bg-primary px-3 py-1.5 text-body text-primary-foreground disabled:opacity-50"
          disabled={submitMut.isPending}
          onClick={() => submitMut.mutate()}
        >
          {t('submitLeave')}
        </button>
      </div>

      {approverId === '' ? (
        <p className="text-muted-foreground">{t('pickApproverHint')}</p>
      ) : listQuery.isLoading ? (
        <p className="text-muted-foreground">{t('loading')}</p>
      ) : list.length === 0 ? (
        <p className="text-muted-foreground">{t('noInstances')}</p>
      ) : (
        <table className="w-full text-body">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="px-2 py-1">{t('leaveRequestId')}</th>
              <th className="px-2 py-1">{t('currentLevel')}</th>
              <th className="px-2 py-1">{t('colStatus')}</th>
              <th className="px-2 py-1">{t('dueAt')}</th>
              <th className="px-2 py-1">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-2 py-1 font-mono text-[11px]">{r.leaveRequestId.slice(0, 8)}</td>
                <td className="px-2 py-1">
                  {r.currentStep + 1} / {r.chainSnapshot.length}
                </td>
                <td className="px-2 py-1">{r.status}</td>
                <td className="px-2 py-1">{stamp(r.dueAt)}</td>
                <td className="space-x-2 px-2 py-1">
                  {decidingId === r.id ? (
                    <span className="inline-flex flex-wrap items-center gap-1">
                      <input
                        className={appField}
                        value={remark}
                        onChange={(e) => setRemark(e.target.value)}
                        placeholder={t('decideRemark')}
                      />
                      <button
                        className="text-primary hover:underline"
                        disabled={decideMut.isPending}
                        onClick={() => decideMut.mutate({ id: r.id, action: 'approved' })}
                      >
                        {t('approved')}
                      </button>
                      <button
                        className="text-destructive hover:underline"
                        disabled={decideMut.isPending}
                        onClick={() => {
                          if (!remark.trim()) {
                            toast.error(t('rejectRemarkRequired'))
                            return
                          }
                          decideMut.mutate({
                            id: r.id,
                            action: 'rejected',
                            remark: remark.trim(),
                          })
                        }}
                      >
                        {t('rejected')}
                      </button>
                      <button
                        className="text-muted-foreground hover:underline"
                        onClick={() => {
                          setDecidingId(null)
                          setRemark('')
                        }}
                      >
                        {t('cancel')}
                      </button>
                    </span>
                  ) : (
                    <button
                      className="text-primary hover:underline"
                      onClick={() => {
                        setDecidingId(r.id)
                        setRemark('')
                      }}
                    >
                      {t('decide')}
                    </button>
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
