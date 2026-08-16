'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import { CalendarCheck, Loader2, Clock, LogOut } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { BackButton } from '@/components/common'
import { Badge } from '@/components/data'

interface AttendanceRecord {
  id: string
  date: string
  status: string
  checkInTime: string | null
  checkOutTime: string | null
  checkInMethod: string | null
  checkOutMethod: string | null
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const STATUS_LABELS: Record<string, string> = {
  present: '正常',
  late: '迟到',
  early: '早退',
  absent: '缺勤',
  leave: '请假',
}

const STATUS_VARIANTS: Record<string, string> = {
  present: 'bg-emerald-100 text-emerald-700',
  late: 'bg-amber-100 text-amber-700',
  early: 'bg-orange-100 text-orange-700',
  absent: 'bg-red-100 text-red-700',
  leave: 'bg-blue-100 text-blue-700',
}

export default function ChildAttendancePage() {
  const t = useTranslations('parentPortal')
  const tc = useTranslations('common')
  const params = useParams()
  const childId = params.childId as string

  const { data, isLoading, error } = useQuery({
    queryKey: ['parent', 'children', childId, 'attendance'],
    queryFn: () =>
      api<{ list: AttendanceRecord[] }>(
        `/api/edu-ai-management/parent/children/${childId}/attendance`,
      ),
  })

  const records = data?.list ?? []

  const stats = {
    total: records.length,
    present: records.filter((r) => r.status === 'present').length,
    late: records.filter((r) => r.status === 'late').length,
    absent: records.filter((r) => r.status === 'absent').length,
    leave: records.filter((r) => r.status === 'leave').length,
  }
  const attendanceRate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('child.attendance')}</h1>
        <p className="text-xs text-muted-foreground">{t('child.attendanceHint')}</p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {tc('loading')}
        </div>
      ) : error ? (
        <Alert variant="danger" description={tc('loadFailed')} />
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8">
          <CalendarCheck className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('child.empty')}</p>
        </div>
      ) : (
        <>
          {/* 统计概览 */}
          <div className="grid grid-cols-2 gap-4 min-[640px]:grid-cols-5">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{attendanceRate}%</p>
                <p className="text-xs text-muted-foreground">{t('attendance.rate')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">{stats.present}</p>
                <p className="text-xs text-muted-foreground">{STATUS_LABELS.present}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-amber-600">{stats.late}</p>
                <p className="text-xs text-muted-foreground">{STATUS_LABELS.late}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
                <p className="text-xs text-muted-foreground">{STATUS_LABELS.absent}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{stats.leave}</p>
                <p className="text-xs text-muted-foreground">{STATUS_LABELS.leave}</p>
              </CardContent>
            </Card>
          </div>

          {/* 签到记录列表 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('attendance.records')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {records.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-medium">{r.date}</div>
                      <Badge className={STATUS_VARIANTS[r.status] ?? ''}>
                        {STATUS_LABELS[r.status] ?? r.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {r.checkInTime && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(r.checkInTime).toLocaleTimeString('zh-CN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      )}
                      {r.checkOutTime && (
                        <div className="flex items-center gap-1">
                          <LogOut className="h-3 w-3" />
                          {new Date(r.checkOutTime).toLocaleTimeString('zh-CN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
