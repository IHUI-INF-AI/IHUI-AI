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
  HR_RESOURCE,
  RESIGN_REASONS,
  CHECKLIST_KEYS,
  checklistProgress,
  todayStr,
  type HrResignation,
} from './types'
import { Card, Empty, Badge, field, th, td, btnGhost, downloadText } from './ui'

export function ResignTab() {
  const t = useTranslations('hrLifecycle')
  const qc = useQueryClient()
  const [employeeId, setEmployeeId] = React.useState('')
  const [lastWorkDate, setLastWorkDate] = React.useState(todayStr())
  const [reasonType, setReasonType] = React.useState('voluntary')
  const [reason, setReason] = React.useState('')

  const listQ = useQuery({
    queryKey: ['hrl', 'resignations'],
    queryFn: () => api<unknown>(`${HR_RESOURCE}/resignations`),
  })
  const rows = rowsOf<HrResignation>(listQ.data)
  const invalidate = () => qc.invalidateQueries({ queryKey: ['hrl'] })

  const apply = useMutation({
    mutationFn: () =>
      api(`${HR_RESOURCE}/resignations`, {
        method: 'POST',
        body: JSON.stringify({
          employeeId: employeeId.trim(),
          lastWorkDate,
          reasonType,
          reason: reason.trim() || null,
        }),
      }),
    onSuccess: () => {
      toast.success(t('done'))
      setEmployeeId('')
      setReason('')
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const act = useMutation({
    mutationFn: (input: { id: string; action: 'approve' | 'cancel' | 'settle' }) =>
      api(`${HR_RESOURCE}/resignations/${input.id}/${input.action}`, {
        method: 'POST',
        body:
          input.action === 'settle'
            ? JSON.stringify({
                checklist: Object.fromEntries(CHECKLIST_KEYS.map((k) => [k, true])),
              })
            : undefined,
      }),
    onSuccess: () => {
      toast.success(t('done'))
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const cert = useMutation({
    mutationFn: (id: string) =>
      api<{ certificateNo?: string; text?: string }>(
        `${HR_RESOURCE}/resignations/${id}/certificate`,
      ),
    onSuccess: (data) => {
      toast.success(t('certReady'))
      if (data?.text) downloadText(`离职证明-${data.certificateNo ?? 'cert'}.txt`, data.text)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-3">
      <Card title={t('resignApplyTitle')}>
        <div className="flex flex-wrap items-end gap-2">
          <input
            className={`${field} w-80`}
            placeholder={t('employeeId')}
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          />
          <input
            type="date"
            className={field}
            value={lastWorkDate}
            onChange={(e) => setLastWorkDate(e.target.value)}
          />
          <select
            className={field}
            value={reasonType}
            onChange={(e) => setReasonType(e.target.value)}
          >
            {RESIGN_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <input
            className={field}
            placeholder={t('resignReason')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button
            size="sm"
            disabled={!employeeId.trim() || apply.isPending}
            onClick={() => apply.mutate()}
          >
            <Plus className="h-3.5 w-3.5" />
            {t('resignApply')}
          </Button>
        </div>
      </Card>

      <Card title={t('resignListTitle')}>
        {rows.length === 0 ? (
          <Empty text={t('noResignations')} />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>{t('employee')}</th>
                <th className={th}>{t('applyDate')}</th>
                <th className={th}>{t('lastWorkDate')}</th>
                <th className={th}>{t('reasonType')}</th>
                <th className={th}>{t('checklist')}</th>
                <th className={th}>{t('status')}</th>
                <th className={th}>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const prog = checklistProgress(r.checklist)
                return (
                  <tr key={r.id} className="border-t border-stroke-subtle">
                    <td className={td}>{r.employeeId.slice(0, 8)}</td>
                    <td className={td}>{r.applyDate}</td>
                    <td className={td}>{r.lastWorkDate}</td>
                    <td className={td}>{r.reasonType}</td>
                    <td className={`${td} tabular-nums`}>
                      {prog.done}/{prog.total}
                    </td>
                    <td className={td}>
                      <Badge status={r.status} />
                    </td>
                    <td className={td}>
                      <div className="flex flex-wrap gap-0.5">
                        {r.status === 'pending' && (
                          <>
                            <button
                              className={btnGhost}
                              onClick={() => act.mutate({ id: r.id, action: 'approve' })}
                            >
                              {t('approve')}
                            </button>
                            <button
                              className={btnGhost}
                              onClick={() => act.mutate({ id: r.id, action: 'cancel' })}
                            >
                              {t('cancel')}
                            </button>
                          </>
                        )}
                        {r.status === 'approved' && (
                          <button
                            className={btnGhost}
                            onClick={() => act.mutate({ id: r.id, action: 'settle' })}
                          >
                            {t('settle')}
                          </button>
                        )}
                        {r.status === 'settled' && (
                          <button className={btnGhost} onClick={() => cert.mutate(r.id)}>
                            <FileDown className="h-3 w-3" />
                            {t('certificate')}
                          </button>
                        )}
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

/** 发薪闭环:生成批次 → 导出网银文件 → 交银行 → 到账 */
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
