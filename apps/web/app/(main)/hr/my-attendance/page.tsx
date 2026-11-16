// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 员工自助 · 我的考勤(2026-11-15 立)。
 * 仅需登录(requireAuth):后端按登录 userId → 绑定员工 → 只返回本人档案/考勤,
 * 签到签退也被后端强制改写为本人 employeeId,不接受客户端代他人打卡。
 * 与 admin/hr-attendance 的全员管理面(HR_VIEW/HR_MANAGE)彻底分离。
 */

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { CalendarCheck, Loader2, LogIn, LogOut } from 'lucide-react'

import { Card, CardContent, Button } from '@ihui/ui-react'
import { apiOrThrow as api } from '@/lib/api'
import { AuthGatePrompt } from '@/components/common'
import { FeaturePageShell } from '@/components/layout'
import { HrSelfLinkPanel } from '@/components/hr/hr-self-link-panel'
import { useAuthGate } from '@/hooks/use-auth-gate'

interface SelfEmployee {
  id: string
  employeeNo: string
  name: string
  departmentId: string
  departmentName: string | null
  position: string | null
  hireDate: string | null
  status: string
}

interface AttendanceRow {
  id: string
  date: string
  checkInTime: string | null
  checkOutTime: string | null
  status: string
}

/** 上海时区的今天(YYYY-MM-DD),与后端 bizDayKey 同口径,避免 UTC 跨日错位。 */
function bizToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date())
}

/** 考勤状态 → i18n key(显式联合,避免动态拼接绕过 next-intl 类型校验)。 */
const STATUS_KEY = {
  present: 'statusPresent',
  late: 'statusLate',
  early: 'statusEarly',
  absent: 'statusAbsent',
  leave: 'statusLeave',
} as const

/** 时间戳 → HH:mm;空值显示 --:--。 */
function clock(ts: string | null): string {
  if (!ts) return '--:--'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '--:--'
  return d.toLocaleTimeString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export default function MyAttendancePage() {
  const t = useTranslations('hrAttendance')
  const tn = useTranslations('nav')
  const { allow } = useAuthGate()
  const qc = useQueryClient()

  const meQuery = useQuery({
    queryKey: ['hr', 'self', 'me'],
    queryFn: () =>
      api<{ employee: SelfEmployee | null; today: AttendanceRow | null }>('/api/hr-attendance/me'),
    enabled: allow,
  })
  const employee = meQuery.data?.employee ?? null
  const today = meQuery.data?.today ?? null

  const recordsQuery = useQuery({
    queryKey: ['hr', 'self', 'records'],
    queryFn: () =>
      api<{ list: AttendanceRow[]; total: number }>('/api/hr-attendance/my-records?limit=31'),
    enabled: allow && employee !== null,
  })

  const punch = useMutation({
    mutationFn: (kind: 'in' | 'out') => {
      if (!employee) throw new Error(t('noEmployeeHint'))
      const date = bizToday()
      if (kind === 'in') {
        return api('/api/hr-attendance/check-in', {
          method: 'POST',
          body: JSON.stringify({
            employeeId: employee.id,
            departmentId: employee.departmentId,
            date,
            checkInMethod: 'self',
          }),
        })
      }
      return api('/api/hr-attendance/check-out', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: employee.id,
          departmentId: employee.departmentId,
          date,
          checkOutTimeRaw: new Date().toISOString(),
        }),
      })
    },
    onSuccess: (_data, kind) => {
      toast.success(kind === 'in' ? t('checkInOk') : t('checkOutOk'))
      void qc.invalidateQueries({ queryKey: ['hr', 'self'] })
    },
    onError: (e) => toast.error((e as Error).message || t('actionFailed')),
  })

  const rows = recordsQuery.data?.list ?? []

  return (
    // 2026-11-16 接入统一子功能页外壳:BackButton + 手写 header 收编为页头卡,
    // 自动带上「人事部」返回 chip(取 hrHub.title,与域入口页大标题恒等)。
    // 图标档位/标题档位走 workspace-tokens 单一真相源,与域入口页同一视觉语言。
    <FeaturePageShell
      title={tn('hrMyAttendance')}
      description={t('mySubtitle')}
      icon={CalendarCheck}
      domain="hr"
    >
      {!allow ? (
        <AuthGatePrompt message={t('mySubtitle')} />
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
        // 未绑定:只展示待确认关联(HR 邀请 + 本人同意)或"联系 HR"提示,不暴露他人档案
        <HrSelfLinkPanel />
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-heading font-semibold">{employee.name}</span>
                  <span className="text-label text-muted-foreground">{employee.employeeNo}</span>
                  {employee.position && (
                    <span className="text-label text-muted-foreground">· {employee.position}</span>
                  )}
                </div>
                <p className="text-label text-muted-foreground">
                  {t('colDepartment')}: {employee.departmentName ?? '—'}
                </p>
                <p className="text-label text-muted-foreground">
                  <span className="font-medium">{t('todayLabel')}</span> {bizToday()} ·{' '}
                  {t('colCheckIn')} {clock(today?.checkInTime ?? null)} · {t('colCheckOut')}{' '}
                  {clock(today?.checkOutTime ?? null)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={punch.isPending || !!today?.checkInTime}
                  onClick={() => punch.mutate('in')}
                >
                  {punch.isPending && punch.variables === 'in' ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <LogIn className="mr-1 h-4 w-4" />
                  )}
                  {t('checkInAction')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={punch.isPending || !today?.checkInTime || !!today?.checkOutTime}
                  onClick={() => punch.mutate('out')}
                >
                  {punch.isPending && punch.variables === 'out' ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="mr-1 h-4 w-4" />
                  )}
                  {t('checkOutAction')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <section className="space-y-2">
            <h2 className="text-label font-semibold text-muted-foreground">
              {t('myRecordsTitle')}
            </h2>
            {recordsQuery.isLoading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('loading')}
              </div>
            ) : recordsQuery.error ? (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-body text-destructive">
                {(recordsQuery.error as Error).message}
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
                      <th className="px-3 py-2 text-left font-medium">{t('colDate')}</th>
                      <th className="px-3 py-2 text-left font-medium">{t('colCheckIn')}</th>
                      <th className="px-3 py-2 text-left font-medium">{t('colCheckOut')}</th>
                      <th className="px-3 py-2 text-left font-medium">{t('colStatus')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="px-3 py-2">{r.date}</td>
                        <td className="px-3 py-2">{clock(r.checkInTime)}</td>
                        <td className="px-3 py-2">{clock(r.checkOutTime)}</td>
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
    </FeaturePageShell>
  )
}
