// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 补卡申请与审批(2026-11-23 立)。
 *
 * 为什么单独一屏:漏打卡是考勤里最高频的人工动作 —— 以前只有后端两个端点
 * (提交/审批),审批人看不到"有哪些待审单",只能靠线下微信要 id。
 * 这里把「提交(选员工/部门)→待审列表→通过(回写考勤)/驳回」闭成一屏。
 */

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { RESOURCE, api } from './helpers'
import type { HrEmployee, ListData } from './types'

const DAILY = '/api/hr-daily'
const field =
  'rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline focus:outline-2 focus:outline-offset-0 focus:outline-stroke-focus'

interface PunchFixRow {
  id: string
  employeeId: string
  departmentId: string
  date: string
  punchType: string
  punchTime: string | null
  reason: string
  status: string
  approveRemark: string | null
  approveAt: string | null
}

/** ISO 时刻 → 本地 HH:mm(补卡只关心时刻,日期由 date 列给) */
function hhmm(ts: string | null): string {
  if (!ts) return '-'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleTimeString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function PunchFixTab({ t }: { t: ReturnType<typeof useTranslations> }) {
  const qc = useQueryClient()
  const [employeeId, setEmployeeId] = React.useState('')
  const [date, setDate] = React.useState('')
  const [punchType, setPunchType] = React.useState<'check_in' | 'check_out'>('check_in')
  const [time, setTime] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [filterStatus, setFilterStatus] = React.useState('pending')
  const [rejecting, setRejecting] = React.useState<string | null>(null)
  const [rejectRemark, setRejectRemark] = React.useState('')

  const employeesQuery = useQuery({
    queryKey: ['hr', 'employees', 'for-punch'],
    queryFn: () => api<ListData<HrEmployee>>(`${RESOURCE}/employees`),
  })
  const employees = employeesQuery.data?.list ?? []
  const employeeOf = (id: string) => employees.find((e) => e.id === id)

  const listQuery = useQuery({
    queryKey: ['hr', 'punch-fix', filterStatus],
    queryFn: () =>
      api<ListData<PunchFixRow>>(
        `${DAILY}/punch-fix?limit=100${filterStatus ? `&status=${filterStatus}` : ''}`,
      ),
  })
  const list = listQuery.data?.list ?? []

  const submit = useMutation({
    mutationFn: () => {
      const emp = employeeOf(employeeId)
      if (!emp) throw new Error(t('punchPickEmployee'))
      if (!date) throw new Error(t('punchPickDate'))
      if (!reason.trim()) throw new Error(t('punchReasonRequired'))
      // punchTime 只在填了时刻时传后端;只给时刻就拼到该日期上
      const punchTime = time ? new Date(`${date}T${time}:00+08:00`).toISOString() : undefined
      return api(`${DAILY}/punch-fix`, {
        method: 'POST',
        body: JSON.stringify({
          employeeId: emp.id,
          departmentId: emp.departmentId,
          date,
          punchType,
          ...(punchTime ? { punchTime } : {}),
          reason: reason.trim(),
        }),
      })
    },
    onSuccess: () => {
      toast.success(t('punchSubmitOk'))
      setDate('')
      setTime('')
      setReason('')
      void qc.invalidateQueries({ queryKey: ['hr', 'punch-fix'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const decide = useMutation({
    mutationFn: (p: { id: string; approve: boolean; approveRemark?: string }) =>
      api(`${DAILY}/punch-fix/${p.id}/approve`, {
        method: 'PUT',
        body: JSON.stringify({
          approve: p.approve,
          ...(p.approveRemark ? { approveRemark: p.approveRemark } : {}),
        }),
      }),
    onSuccess: (_d, v) => {
      toast.success(v.approve ? t('punchApproveOk') : t('punchRejectOk'))
      void qc.invalidateQueries({ queryKey: ['hr', 'punch-fix'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{t('tabPunchFix')}</h2>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-stroke-subtle p-3">
        <label className="text-body">
          {t('colEmployee')}
          <select
            className={field}
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            <option value="">{t('punchPickEmployee')}</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.employeeNo} · {e.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-body">
          {t('colDate')}
          <input
            type="date"
            className={field}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="text-body">
          {t('colPunchType')}
          <select
            className={field}
            value={punchType}
            onChange={(e) => setPunchType(e.target.value as 'check_in' | 'check_out')}
          >
            <option value="check_in">{t('punchTypeIn')}</option>
            <option value="check_out">{t('punchTypeOut')}</option>
          </select>
        </label>
        <label className="text-body">
          {t('colPunchTime')}
          <input
            type="time"
            className={field}
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </label>
        <label className="min-w-48 flex-1 text-body">
          {t('colReason')}
          <input
            className={`${field} w-full`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('punchReasonPlaceholder')}
          />
        </label>
        <button
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          disabled={submit.isPending}
          onClick={() => submit.mutate()}
        >
          {t('punchSubmit')}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-body">
          {t('colStatus')}
          <select
            className={field}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="pending">{t('statusPendingLower')}</option>
            <option value="approved">{t('statusApprovedLower')}</option>
            <option value="rejected">{t('statusRejectedLower')}</option>
            <option value="">{t('allStatus')}</option>
          </select>
        </label>
        <span className="text-xs text-muted-foreground">
          {t('punchTotal', { count: listQuery.data?.total ?? 0 })}
        </span>
      </div>

      {listQuery.isLoading ? (
        <p className="text-muted-foreground">{t('loading')}</p>
      ) : list.length === 0 ? (
        <p className="text-muted-foreground">{t('noData')}</p>
      ) : (
        <table className="w-full text-body">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="px-2 py-1">{t('colEmployeeNo')}</th>
              <th className="px-2 py-1">{t('colDate')}</th>
              <th className="px-2 py-1">{t('colPunchType')}</th>
              <th className="px-2 py-1">{t('colPunchTime')}</th>
              <th className="px-2 py-1">{t('colReason')}</th>
              <th className="px-2 py-1">{t('colStatus')}</th>
              <th className="px-2 py-1">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const emp = employeeOf(r.employeeId)
              return (
                <tr key={r.id} className="border-t">
                  <td className="px-2 py-1">
                    {emp ? `${emp.employeeNo} ${emp.name}` : r.employeeId}
                  </td>
                  <td className="px-2 py-1">{r.date}</td>
                  <td className="px-2 py-1">
                    {r.punchType === 'check_in' ? t('punchTypeIn') : t('punchTypeOut')}
                  </td>
                  <td className="px-2 py-1">{hhmm(r.punchTime)}</td>
                  <td className="max-w-64 truncate px-2 py-1">{r.reason}</td>
                  <td className="px-2 py-1">
                    {r.status === 'pending'
                      ? t('statusPendingLower')
                      : r.status === 'approved'
                        ? t('statusApprovedLower')
                        : t('statusRejectedLower')}
                  </td>
                  <td className="space-x-2 px-2 py-1">
                    {r.status === 'pending' ? (
                      rejecting === r.id ? (
                        <span className="inline-flex items-center gap-1">
                          <input
                            className={field}
                            value={rejectRemark}
                            onChange={(e) => setRejectRemark(e.target.value)}
                            placeholder={t('punchRejectReason')}
                          />
                          <button
                            className="text-destructive hover:underline"
                            disabled={decide.isPending}
                            onClick={() => {
                              if (!rejectRemark.trim()) {
                                toast.error(t('punchRejectReason'))
                                return
                              }
                              decide.mutate(
                                { id: r.id, approve: false, approveRemark: rejectRemark.trim() },
                                {
                                  onSuccess: () => {
                                    setRejecting(null)
                                    setRejectRemark('')
                                  },
                                },
                              )
                            }}
                          >
                            {t('punchRejectConfirm')}
                          </button>
                          <button
                            className="text-muted-foreground hover:underline"
                            onClick={() => {
                              setRejecting(null)
                              setRejectRemark('')
                            }}
                          >
                            {t('cancel')}
                          </button>
                        </span>
                      ) : (
                        <>
                          <button
                            className="text-primary hover:underline"
                            disabled={decide.isPending}
                            onClick={() => decide.mutate({ id: r.id, approve: true })}
                          >
                            {t('approve')}
                          </button>
                          <button
                            className="text-destructive hover:underline"
                            disabled={decide.isPending}
                            onClick={() => {
                              setRejecting(r.id)
                              setRejectRemark('')
                            }}
                          >
                            {t('reject')}
                          </button>
                        </>
                      )
                    ) : (
                      <span className="text-muted-foreground">{r.approveRemark ?? '-'}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
