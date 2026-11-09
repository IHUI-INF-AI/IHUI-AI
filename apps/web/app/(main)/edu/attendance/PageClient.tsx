// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Calendar, ChevronLeft, ChevronRight, Loader2, LogOut, UserCheck } from 'lucide-react'

import {
  eduAttendanceSelfCheckIn,
  eduAttendanceSelfCheckOut,
  eduMyAttendance,
} from '@ihui/api-client'
import { useAuth } from '@/hooks/use-auth'
import { Button, Card, CardContent, Input, Label } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { SelfAttendanceTable, type StudentAttendanceRecord } from './SelfAttendanceTable'
import { monthKey, monthRange, shiftMonth, todayStr } from './month'

/** 状态码 → 取词键(与教师端协议码同源);value 是协议码不得取词 */
const STATUS_KEYS: Record<string, string> = {
  present: 'statusPresent',
  late: 'statusLate',
  early: 'statusEarly',
  absent: 'statusAbsent',
  leave: 'statusLeave',
}

export default function MyAttendancePageClient() {
  const t = useTranslations('eduAttendance')
  const queryClient = useQueryClient()
  const { user, isAuthenticated } = useAuth()
  const studentId = user?.id ?? ''

  const today = todayStr()
  const currentMonth = monthKey(today)
  const [month, setMonth] = React.useState(currentMonth)
  const [remark, setRemark] = React.useState('')
  const [signed, setSigned] = React.useState(false)
  const [checkedOut, setCheckedOut] = React.useState(false)
  // 切月即清掉上一月的成功横幅;今日签/退成功在当月内保持
  React.useEffect(() => {
    setSigned(false)
    setCheckedOut(false)
  }, [month])
  const viewRange = monthRange(month)
  /** 视图含今日才摆自签入口:翻到历史月时给一枚「点了签的是今天」的按钮是骗人 */
  const showsToday = month === currentMonth

  // 学生本人取自己的考勤一律走 /attendance/me(只要求登录);
  // 旧写法 /attendance?studentId=<本人> 带 edu:view/edu:manage 权限守卫,普通学生必 403
  // 取数按整月区间(后端 startDate/endDate 既有能力;旧写法只传 date=当日 ⇒ 学生只见当天一行)
  const recordsQuery = useQuery({
    queryKey: ['edu-attendance-self', viewRange.startDate, viewRange.endDate],
    enabled: isAuthenticated && studentId.length > 0,
    queryFn: async () => {
      const r = await eduMyAttendance<{ list: StudentAttendanceRecord[] }>({
        startDate: viewRange.startDate,
        endDate: viewRange.endDate,
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  // 自签载荷只带日期与备注:身份与班级由后端按登录态与在册学籍现取,客户端不传
  const selfCheckInMutation = useMutation({
    mutationFn: async () => {
      const r = await eduAttendanceSelfCheckIn<{
        classId: string
        status: string
        checkInTime: string
      }>({ date: today, remark: remark.trim() || undefined })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      setSigned(true)
      queryClient.invalidateQueries({ queryKey: ['edu-attendance-self'] })
    },
  })

  // 自签退载荷只带业务日:身份/班级由后端按登录态现取;重复签退由后端幂等口径裁决(409 上屏)
  const selfCheckOutMutation = useMutation({
    mutationFn: async () => {
      const r = await eduAttendanceSelfCheckOut<{
        classId: string
        status: string
        checkOutTime: string
      }>({ date: today })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      setCheckedOut(true)
      queryClient.invalidateQueries({ queryKey: ['edu-attendance-self'] })
    },
  })

  const records = (recordsQuery.data?.list ?? []).filter((r) => !('deletedAt' in r && r.deletedAt))
  const todayRecord = records.find((r) => r.date === today) ?? null
  /** 签退资格只由后端协议行现算:今日已签到且尚未签退;不另造状态判据 */
  const canSelfCheckOut = !!todayRecord?.checkInTime && !todayRecord?.checkOutTime

  /** 后端可读 message 优先显示(409 取不到在册班级 / 403 / 401 一律不许静默) */
  const serverMessage = (error: unknown, fallbackKey: string): string => {
    const message = error instanceof Error ? error.message.trim() : ''
    return message.length > 0 ? message : t(fallbackKey)
  }

  /** 状态码取词:未知码(后端新增值)原样回显,不吞协议数据 */
  const statusLabel = (status: string): string => {
    const key = STATUS_KEYS[status]
    return key ? t(key) : status
  }

  if (!isAuthenticated || !studentId) {
    return (
      <Card>
        <CardContent className="font-[weight:inherit] py-12 text-center text-body text-muted-foreground">
          {t('notLoggedIn')}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-display font-bold tracking-tight">{t('studentPageTitle')}</h1>
        <p className="font-[weight:inherit] text-label text-muted-foreground">
          {t('studentPageSubtitle')}
        </p>
      </header>

      <Card>
        <CardContent className="min-[640px]:p-3 flex flex-wrap items-center gap-3 p-3">
          <div className="flex items-center gap-2">
            <Button
              size="icon-xs"
              variant="outline"
              aria-label={t('prevMonth')}
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="inline-flex items-center gap-1 text-body font-semibold tabular-nums">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {month}
            </span>
            <Button
              size="icon-xs"
              variant="outline"
              aria-label={t('nextMonth')}
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {!showsToday && (
              <Button size="xs" variant="ghost" onClick={() => setMonth(currentMonth)}>
                {t('thisMonth')}
              </Button>
            )}
          </div>
          {showsToday && (
            <>
              <div className="flex items-center gap-2">
                <Label className="font-[weight:inherit] text-label text-muted-foreground">
                  {t('remark')}
                </Label>
                <Input
                  value={remark}
                  onChange={(e) => {
                    setRemark(e.target.value)
                    setSigned(false)
                  }}
                  placeholder={t('remarkPlaceholder')}
                  className="w-40"
                />
              </div>
              <Button
                size="sm"
                onClick={() => selfCheckInMutation.mutate()}
                disabled={selfCheckInMutation.isPending || !!todayRecord?.checkInTime}
              >
                {selfCheckInMutation.isPending ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UserCheck className="mr-1 h-3.5 w-3.5" />
                )}
                {t('selfCheckIn')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => selfCheckOutMutation.mutate()}
                disabled={selfCheckOutMutation.isPending || !canSelfCheckOut}
              >
                {selfCheckOutMutation.isPending ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LogOut className="mr-1 h-3.5 w-3.5" />
                )}
                {t('checkOut')}
              </Button>
            </>
          )}
          {recordsQuery.isLoading && (
            <div className="font-[weight:inherit] ml-auto flex items-center text-label text-muted-foreground">
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              {t('loading')}
            </div>
          )}
        </CardContent>
      </Card>

      {signed && <Alert variant="success" description={t('selfCheckInSuccess')} />}
      {checkedOut && <Alert variant="success" description={t('selfCheckOutSuccess')} />}
      {selfCheckOutMutation.error && (
        <Alert
          variant="danger"
          description={serverMessage(selfCheckOutMutation.error, 'selfCheckOutFailed')}
        />
      )}
      {selfCheckInMutation.error && (
        <Alert
          variant="danger"
          description={serverMessage(selfCheckInMutation.error, 'selfCheckInFailed')}
        />
      )}

      {recordsQuery.error ? (
        <Alert
          variant="danger"
          description={serverMessage(recordsQuery.error, 'loadRecordsFailed')}
        />
      ) : records.length === 0 && !recordsQuery.isLoading ? (
        <Card>
          <CardContent className="font-[weight:inherit] py-12 text-center text-body text-muted-foreground">
            {t('emptyRecords')}
          </CardContent>
        </Card>
      ) : (
        <SelfAttendanceTable records={records} statusLabel={statusLabel} />
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
