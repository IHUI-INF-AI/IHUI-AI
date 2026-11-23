// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 假期额度查询(2026-11-23 立)。
 *
 * 后端 GET /api/hr-daily/leave-balance 一直有,但前端没人接 —— HR 想知道
 * 「某人还剩几天年假」只能翻库。这里按 员工(+ 类型 + 年度) 出额度台账,
 * remaining 列是写入口维护的派生列(total - used - frozen),读它就不必前端再算。
 */

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import type { useTranslations } from 'next-intl'

import { RESOURCE, api } from './helpers'
import type { HrEmployee, ListData } from './types'

const DAILY = '/api/hr-daily'
const field =
  'rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline focus:outline-2 focus:outline-offset-0 focus:outline-stroke-focus'

interface LeaveBalanceRow {
  id: string
  employeeId: string
  leaveType: string
  year: number
  totalDays: number
  usedDays: number
  frozenDays: number
  remainingDays: number
}

export function LeaveBalanceTab({ t }: { t: ReturnType<typeof useTranslations> }) {
  const [employeeId, setEmployeeId] = React.useState('')
  const [leaveType, setLeaveType] = React.useState('')
  const [year, setYear] = React.useState(String(new Date().getFullYear()))

  const employeesQuery = useQuery({
    queryKey: ['hr', 'employees', 'for-balance'],
    queryFn: () => api<ListData<HrEmployee>>(`${RESOURCE}/employees`),
  })
  const employees = employeesQuery.data?.list ?? []

  const listQuery = useQuery({
    queryKey: ['hr', 'leave-balance', employeeId, leaveType, year],
    queryFn: () => {
      const params = new URLSearchParams({ employeeId })
      if (leaveType.trim()) params.set('leaveType', leaveType.trim())
      if (/^\d{4}$/.test(year)) params.set('year', year)
      return api<{ list: LeaveBalanceRow[] }>(`${DAILY}/leave-balance?${params.toString()}`)
    },
    enabled: employeeId !== '' && employeeId !== undefined,
  })
  const list = listQuery.data?.list ?? []

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{t('tabLeaveBalance')}</h2>
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
          {t('leaveType')}
          <input
            className={field}
            value={leaveType}
            onChange={(e) => setLeaveType(e.target.value)}
            placeholder={t('leaveTypePlaceholder')}
          />
        </label>
        <label className="text-body">
          {t('year')}
          <input
            className={`${field} w-20`}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            inputMode="numeric"
          />
        </label>
      </div>

      {employeeId === '' ? (
        <p className="text-muted-foreground">{t('punchPickEmployee')}</p>
      ) : listQuery.isLoading ? (
        <p className="text-muted-foreground">{t('loading')}</p>
      ) : list.length === 0 ? (
        <p className="text-muted-foreground">{t('noData')}</p>
      ) : (
        <table className="w-full text-body">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="px-2 py-1">{t('leaveType')}</th>
              <th className="px-2 py-1">{t('year')}</th>
              <th className="px-2 py-1 text-right">{t('colTotalDays')}</th>
              <th className="px-2 py-1 text-right">{t('colUsedDays')}</th>
              <th className="px-2 py-1 text-right">{t('colFrozenDays')}</th>
              <th className="px-2 py-1 text-right">{t('colRemainingDays')}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-2 py-1">{r.leaveType}</td>
                <td className="px-2 py-1">{r.year}</td>
                <td className="px-2 py-1 text-right tabular-nums">{r.totalDays}</td>
                <td className="px-2 py-1 text-right tabular-nums">{r.usedDays}</td>
                <td className="px-2 py-1 text-right tabular-nums">{r.frozenDays}</td>
                <td className="px-2 py-1 text-right font-medium tabular-nums">{r.remainingDays}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
