// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 员工自助 · 我的请假(2026-11-15 立)。
 * 仅需登录(requireAuth):后端按登录 userId 解析本人员工档案并强制改写 employeeId,
 * 客户端传别人的 id 也无效。列表只返回本人请假单,审批仍在 admin/hr-attendance。
 */

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { CalendarDays, Loader2, Send } from 'lucide-react'

import { Card, CardContent, Button } from '@ihui/ui-react'
import { apiOrThrow as api } from '@/lib/api'
import { AuthGatePrompt, BackButton } from '@/components/common'
import { HrSelfLinkPanel } from '@/components/hr/hr-self-link-panel'
import { useAuthGate } from '@/hooks/use-auth-gate'

interface SelfEmployee {
  id: string
  employeeNo: string
  name: string
  departmentId: string
  departmentName: string | null
}

interface LeaveRow {
  id: string
  leaveType: string
  startDate: string
  endDate: string
  totalDays: number
  reason: string
  status: string
}

const STATUS_KEY = {
  pending: 'statusPending',
  approved: 'statusApproved',
  rejected: 'statusRejected',
} as const

/** 上海时区的今天(YYYY-MM-DD)。 */
function bizToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date())
}

/** 请假天数(含首尾;UTC 解析避免时区少算一天)。 */
function daysBetween(start: string, end: string): number {
  if (!start || !end) return 0
  const a = Date.parse(`${start}T00:00:00Z`)
  const b = Date.parse(`${end}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0
  return Math.round((b - a) / 86_400_000) + 1
}

export default function MyLeavePage() {
  const t = useTranslations('hrAttendance')
  const tn = useTranslations('nav')
  const { allow } = useAuthGate()
  const qc = useQueryClient()

  const today = bizToday()
  const [leaveType, setLeaveType] = React.useState('')
  const [startDate, setStartDate] = React.useState(today)
  const [endDate, setEndDate] = React.useState(today)
  const [reason, setReason] = React.useState('')

  const meQuery = useQuery({
    queryKey: ['hr', 'self', 'me'],
    queryFn: () => api<{ employee: SelfEmployee | null }>('/api/hr-attendance/me'),
    enabled: allow,
  })
  const employee = meQuery.data?.employee ?? null

  const leavesQuery = useQuery({
    queryKey: ['hr', 'self', 'leaves'],
    queryFn: () => api<{ list: LeaveRow[] }>('/api/hr-attendance/my-leaves'),
    enabled: allow && employee !== null,
  })

  const submit = useMutation({
    mutationFn: () => {
      if (!employee) throw new Error(t('noEmployeeHint'))
      const totalDays = daysBetween(startDate, endDate)
      if (!leaveType.trim()) throw new Error(t('leaveTypeLabel'))
      if (totalDays <= 0) throw new Error(t('colEnd'))
      if (!reason.trim()) throw new Error(t('leaveReasonPh'))
      return api('/api/hr-attendance/leave', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: employee.id,
          departmentId: employee.departmentId,
          leaveType: leaveType.trim(),
          startDate,
          endDate,
          totalDays,
          reason: reason.trim(),
        }),
      })
    },
    onSuccess: () => {
      toast.success(t('leaveSubmitted'))
      setLeaveType('')
      setReason('')
      void qc.invalidateQueries({ queryKey: ['hr', 'self'] })
    },
    onError: (e) => toast.error((e as Error).message || t('actionFailed')),
  })

  const rows = leavesQuery.data?.list ?? []
  const totalDays = daysBetween(startDate, endDate)

  return (
    <div className="px-4 py-4 mx-auto w-full max-w-5xl space-y-4">
      <BackButton />
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-heading font-bold tracking-tight min-[768px]:text-display">
          <CalendarDays className="h-7 w-7 text-primary" />
          {tn('hrMyLeave')}
        </h1>
        <p className="text-label text-muted-foreground">{t('myLeaveSubtitle')}</p>
      </header>

      {!allow ? (
        <AuthGatePrompt message={t('myLeaveSubtitle')} />
      ) : meQuery.isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : meQuery.error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-body text-destructive">
          {(meQuery.error as Error).message}
        </div>
      ) : !employee ? (
        // 未绑定:只展示待确认关联(HR 邀请 + 本人同意)或"联系 HR"提示
        <HrSelfLinkPanel />
      ) : (
        <>
          <Card>
            <CardContent className="space-y-3 p-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-heading font-semibold">{employee.name}</span>
                <span className="text-label text-muted-foreground">{employee.employeeNo}</span>
                <span className="text-label text-muted-foreground">
                  · {employee.departmentName ?? '—'}
                </span>
              </div>
              <div className="grid gap-3 min-[640px]:grid-cols-3">
                <label className="space-y-1 text-body">
                  <span className="block text-label text-muted-foreground">
                    {t('leaveTypeLabel')}
                  </span>
                  <input
                    className="w-full rounded-md border border-input bg-background px-2 py-1 text-body focus:outline outline-2 outline-offset-2 outline-stroke-focus"
                    placeholder={t('leaveTypePh')}
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value)}
                  />
                </label>
                <label className="space-y-1 text-body">
                  <span className="block text-label text-muted-foreground">{t('colStart')}</span>
                  <input
                    className="w-full rounded-md border border-input bg-background px-2 py-1 text-body focus:outline outline-2 outline-offset-2 outline-stroke-focus"
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value)
                      if (e.target.value > endDate) setEndDate(e.target.value)
                    }}
                  />
                </label>
                <label className="space-y-1 text-body">
                  <span className="block text-label text-muted-foreground">{t('colEnd')}</span>
                  <input
                    className="w-full rounded-md border border-input bg-background px-2 py-1 text-body focus:outline outline-2 outline-offset-2 outline-stroke-focus"
                    type="date"
                    min={startDate}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </label>
              </div>
              <label className="block space-y-1 text-body">
                <span className="block text-label text-muted-foreground">{t('colReason')}</span>
                <textarea
                  className="min-h-[72px] w-full rounded-md border border-input bg-background px-2 py-1 text-body focus:outline outline-2 outline-offset-2 outline-stroke-focus"
                  placeholder={t('leaveReasonPh')}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-label text-muted-foreground">
                  {t('totalDaysLabel')}: {totalDays}
                </span>
                <Button size="sm" disabled={submit.isPending} onClick={() => submit.mutate()}>
                  {submit.isPending ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-1 h-4 w-4" />
                  )}
                  {t('submitLeave')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <section className="space-y-2">
            <h2 className="text-label font-semibold text-muted-foreground">{t('myLeavesTitle')}</h2>
            {leavesQuery.isLoading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('loading')}
              </div>
            ) : leavesQuery.error ? (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-body text-destructive">
                {(leavesQuery.error as Error).message}
              </div>
            ) : rows.length === 0 ? (
              <div className="flex items-center justify-center rounded-lg border border-dashed py-6 text-body text-muted-foreground">
                {t('noData')}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-body">
                  <thead className="bg-muted/50 text-label text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">{t('leaveTypeLabel')}</th>
                      <th className="px-3 py-2 text-left font-medium">{t('colStart')}</th>
                      <th className="px-3 py-2 text-left font-medium">{t('colEnd')}</th>
                      <th className="px-3 py-2 text-left font-medium">{t('totalDaysLabel')}</th>
                      <th className="px-3 py-2 text-left font-medium">{t('colReason')}</th>
                      <th className="px-3 py-2 text-left font-medium">{t('colStatus')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="px-3 py-2">{r.leaveType}</td>
                        <td className="px-3 py-2">{r.startDate}</td>
                        <td className="px-3 py-2">{r.endDate}</td>
                        <td className="px-3 py-2">{r.totalDays}</td>
                        <td className="max-w-[240px] truncate px-3 py-2" title={r.reason}>
                          {r.reason}
                        </td>
                        <td className="px-3 py-2">
                          {t(STATUS_KEY[r.status as keyof typeof STATUS_KEY] ?? 'colStatus')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
