// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  UserCheck,
  ClipboardList,
  BarChart3,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Loader2,
  Calendar,
  CalendarDays,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { fetchApi } from '@/lib/api'
import { BackButton, TruncatedText } from '@/components/common'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Label,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@ihui/ui-react'
import { Alert } from '@/components/feedback'

/* ─── Types ─── */

interface AttendanceRecord {
  id: string
  studentId: string
  classId: string
  date: string
  checkInTime: string | null
  checkOutTime: string | null
  status: string
  checkInMethod: string
  checkOutMethod: string | null
  operatedBy: string | null
  remark: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

interface LeaveRequest {
  id: string
  studentId: string
  classId: string
  leaveType: string
  startDate: string
  endDate: string
  totalDays: number
  reason: string
  attachment: string | null
  status: string
  approverId: string | null
  approveRemark: string | null
  approveAt: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

interface AttendanceStats {
  total: number
  attendanceRate: number
  statusBreakdown: Array<{ status: string; count: number }>
  periodBreakdown: Array<{ period: string; status: string; count: number }>
}

/* ─── API helper ─── */

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

/* ─── Constants ─── */

/** 考勤状态码 → eduAttendance 取词键;value 是与后端比对的协议码,不得取词 */
const ATTENDANCE_STATUS = [
  { value: 'present', labelKey: 'statusPresent', color: 'bg-green-500' },
  { value: 'late', labelKey: 'statusLate', color: 'bg-yellow-500' },
  { value: 'early', labelKey: 'statusEarly', color: 'bg-orange-500' },
  { value: 'absent', labelKey: 'statusAbsent', color: 'bg-red-500' },
  { value: 'leave', labelKey: 'statusLeave', color: 'bg-blue-500' },
] as const

const ATTENDANCE_STATUS_KEY_MAP: Map<string, string> = new Map(
  ATTENDANCE_STATUS.map((s) => [s.value, s.labelKey]),
)
const ATTENDANCE_COLOR_MAP: Map<string, string> = new Map(
  ATTENDANCE_STATUS.map((s) => [s.value, s.color]),
)

const LEAVE_TYPES = [
  { value: 'sick', labelKey: 'leaveTypeSick' },
  { value: 'personal', labelKey: 'leaveTypePersonal' },
  { value: 'emergency', labelKey: 'leaveTypeEmergency' },
  { value: 'other', labelKey: 'leaveTypeOther' },
] as const

const LEAVE_TYPE_KEY_MAP: Map<string, string> = new Map(
  LEAVE_TYPES.map((item) => [item.value, item.labelKey]),
)

const LEAVE_STATUS = [
  { value: 'pending', labelKey: 'leaveStatusPending', color: 'bg-yellow-500' },
  { value: 'approved', labelKey: 'leaveStatusApproved', color: 'bg-green-500' },
  { value: 'rejected', labelKey: 'leaveStatusRejected', color: 'bg-red-500' },
  { value: 'cancelled', labelKey: 'leaveStatusCancelled', color: 'bg-gray-500' },
] as const

const LEAVE_STATUS_KEY_MAP: Map<string, string> = new Map(
  LEAVE_STATUS.map((s) => [s.value, s.labelKey]),
)
const LEAVE_STATUS_COLOR_MAP: Map<string, string> = new Map(
  LEAVE_STATUS.map((s) => [s.value, s.color]),
)

/** 签到方式码 → eduAttendance 取词键;对象 key 是后端 checkInMethod 协议字面值 */
const CHECK_IN_METHOD_KEYS: Record<string, string> = {
  manual: 'methodManual',
  face: 'methodFace',
  qrcode: 'methodQrcode',
  self: 'methodSelf',
}

/** 统计周期 → eduAttendance 取词键;对象 key 是 statsPeriod 协议字面值 */
const STATS_PERIOD_KEYS: Record<'daily' | 'weekly' | 'monthly', string> = {
  daily: 'periodDaily',
  weekly: 'periodWeekly',
  monthly: 'periodMonthly',
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function todayStr(): string {
  return formatDate(new Date())
}

/* ─── Check-in Dialog ─── */

interface CheckInFormData {
  studentId: string
  classId: string
  date: string
  checkInMethod: string
  status: string
  remark: string
}

function CheckInDialog({
  open,
  onOpenChange,
  classId,
  defaultDate,
  onSave,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  classId: string
  defaultDate: string
  onSave: (data: CheckInFormData) => Promise<void>
}) {
  const t = useTranslations('eduAttendance')
  const [form, setForm] = React.useState<CheckInFormData>({
    studentId: '',
    classId,
    date: defaultDate,
    checkInMethod: 'manual',
    status: 'present',
    remark: '',
  })
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setForm((prev) => ({
        ...prev,
        classId,
        date: defaultDate,
      }))
    }
  }, [open, classId, defaultDate])

  const update = (key: keyof CheckInFormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!form.studentId.trim()) return
    setSaving(true)
    try {
      await onSave(form)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('checkIn')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>{t('studentId')}</Label>
            <Input
              value={form.studentId}
              onChange={(e) => update('studentId', e.target.value)}
              placeholder={t('studentIdPlaceholder')}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{t('date')}</Label>
            <Input type="date" value={form.date} onChange={(e) => update('date', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t('checkInMethod')}</Label>
              <Select value={form.checkInMethod} onValueChange={(v) => update('checkInMethod', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CHECK_IN_METHOD_KEYS).map(([key, labelKey]) => (
                    <SelectItem key={key} value={key}>
                      {t(labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>{t('status')}</Label>
              <Select value={form.status} onValueChange={(v) => update('status', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ATTENDANCE_STATUS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {t(s.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>{t('remark')}</Label>
            <Input
              value={form.remark}
              onChange={(e) => update('remark', e.target.value)}
              placeholder={t('remarkPlaceholder')}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={saving || !form.studentId.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t('confirmCheckIn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Leave Request Dialog ─── */

interface LeaveFormData {
  studentId: string
  classId: string
  leaveType: string
  startDate: string
  endDate: string
  totalDays: number
  reason: string
  attachment: string
}

function LeaveDialog({
  open,
  onOpenChange,
  classId,
  onSave,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  classId: string
  onSave: (data: LeaveFormData) => Promise<void>
}) {
  const t = useTranslations('eduAttendance')
  const [form, setForm] = React.useState<LeaveFormData>({
    studentId: '',
    classId,
    leaveType: 'sick',
    startDate: '',
    endDate: '',
    totalDays: 1,
    reason: '',
    attachment: '',
  })
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setForm((prev) => ({
        ...prev,
        classId,
      }))
    }
  }, [open, classId])

  const update = (key: keyof LeaveFormData, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  React.useEffect(() => {
    if (form.startDate && form.endDate) {
      const start = new Date(form.startDate)
      const end = new Date(form.endDate)
      const diff = Math.max(
        1,
        Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1,
      )
      update('totalDays', diff)
    }
  }, [form.startDate, form.endDate])

  const handleSave = async () => {
    if (!form.studentId.trim() || !form.reason.trim() || !form.startDate || !form.endDate) return
    setSaving(true)
    try {
      await onSave(form)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('leaveDialogTitle')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>{t('studentId')}</Label>
            <Input
              value={form.studentId}
              onChange={(e) => update('studentId', e.target.value)}
              placeholder={t('studentIdPlaceholder')}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{t('leaveType')}</Label>
            <Select value={form.leaveType} onValueChange={(v) => update('leaveType', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAVE_TYPES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {t(item.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t('startDate')}</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => update('startDate', e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t('endDate')}</Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => update('endDate', e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>{t('leaveDays')}</Label>
            <Input type="number" value={form.totalDays} readOnly className="bg-muted" />
          </div>
          <div className="grid gap-1.5">
            <Label>{t('leaveReason')}</Label>
            <Input
              value={form.reason}
              onChange={(e) => update('reason', e.target.value)}
              placeholder={t('leaveReasonPlaceholder')}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{t('attachment')}</Label>
            <Input
              value={form.attachment}
              onChange={(e) => update('attachment', e.target.value)}
              placeholder={t('attachmentPlaceholder')}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleSave}
            disabled={
              saving ||
              !form.studentId.trim() ||
              !form.reason.trim() ||
              !form.startDate ||
              !form.endDate
            }
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t('submitApplication')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Approve Dialog ─── */

function ApproveDialog({
  open,
  onOpenChange,
  leave,
  onApprove,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  leave: LeaveRequest | null
  onApprove: (id: string, status: 'approved' | 'rejected', remark: string) => Promise<void>
}) {
  const t = useTranslations('eduAttendance')
  const [remark, setRemark] = React.useState('')
  const [processing, setProcessing] = React.useState(false)

  React.useEffect(() => {
    if (open) setRemark('')
  }, [open])

  const handleAction = async (status: 'approved' | 'rejected') => {
    if (!leave) return
    setProcessing(true)
    try {
      await onApprove(leave.id, status, remark)
      onOpenChange(false)
    } finally {
      setProcessing(false)
    }
  }

  /** 请假类型码取词:未知码(后端新增值)原样回显,不吞数据 */
  const leaveTypeLabel = (leaveType: string): string => {
    const key = LEAVE_TYPE_KEY_MAP.get(leaveType)
    return key ? t(key) : leaveType
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('approveDialogTitle')}</DialogTitle>
        </DialogHeader>
        {leave && (
          <div className="space-y-3 py-2">
            <div className="rounded-md border p-3 text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">{t('typeLabel')}</span>
                {leaveTypeLabel(leave.leaveType)}
              </p>
              <p>
                <span className="text-muted-foreground">{t('dateLabel')}</span>
                {t('dateRangeDays', {
                  start: leave.startDate,
                  end: leave.endDate,
                  days: leave.totalDays,
                })}
              </p>
              <p>
                <span className="text-muted-foreground">{t('reasonLabel')}</span>
                {leave.reason}
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label>{t('approveRemark')}</Label>
              <Input
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder={t('approveRemarkPlaceholder')}
              />
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button
            variant="destructive"
            onClick={() => handleAction('rejected')}
            disabled={processing}
          >
            {processing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="mr-1 h-4 w-4" />
            )}
            {t('reject')}
          </Button>
          <Button variant="default" onClick={() => handleAction('approved')} disabled={processing}>
            {processing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1 h-4 w-4" />
            )}
            {t('approve')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Main Page ─── */

export default function AttendancePage() {
  const t = useTranslations('eduAttendance')
  const queryClient = useQueryClient()

  /* ── State ── */
  const [activeTab, setActiveTab] = React.useState('check')
  const [attendanceDate, setAttendanceDate] = React.useState(todayStr())
  const [attendanceStatusFilter, setAttendanceStatusFilter] = React.useState('')
  const [statsPeriod, setStatsPeriod] = React.useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [statsStartDate, setStatsStartDate] = React.useState(todayStr())
  const [statsEndDate, setStatsEndDate] = React.useState(todayStr())
  const [leaveStatusFilter, setLeaveStatusFilter] = React.useState('')
  const [leaveStartDate, setLeaveStartDate] = React.useState('')
  const [leaveEndDate, setLeaveEndDate] = React.useState('')
  const [checkInOpen, setCheckInOpen] = React.useState(false)
  const [leaveOpen, setLeaveOpen] = React.useState(false)
  const [approveOpen, setApproveOpen] = React.useState(false)
  const [approvingLeave, setApprovingLeave] = React.useState<LeaveRequest | null>(null)

  /* ── Queries ── */
  const attendanceQuery = useQuery({
    queryKey: ['edu-ai-management', 'attendance', attendanceDate, attendanceStatusFilter],
    queryFn: () =>
      api<{ list: AttendanceRecord[] }>(
        `/api/edu-ai-management/attendance?date=${attendanceDate}${attendanceStatusFilter ? `&status=${attendanceStatusFilter}` : ''}`,
      ),
  })

  const statsQuery = useQuery({
    queryKey: ['edu-ai-management', 'attendance-stats', statsPeriod, statsStartDate, statsEndDate],
    queryFn: () =>
      api<AttendanceStats>(
        `/api/edu-ai-management/attendance/stats?period=${statsPeriod}&startDate=${statsStartDate}&endDate=${statsEndDate}`,
      ),
  })

  const leaveQuery = useQuery({
    queryKey: ['edu-ai-management', 'leave', leaveStatusFilter, leaveStartDate, leaveEndDate],
    queryFn: () => {
      let url = '/api/edu-ai-management/leave'
      const params = new URLSearchParams()
      if (leaveStatusFilter) params.set('status', leaveStatusFilter)
      if (leaveStartDate) params.set('startDate', leaveStartDate)
      if (leaveEndDate) params.set('endDate', leaveEndDate)
      const qs = params.toString()
      if (qs) url += `?${qs}`
      return api<{ list: LeaveRequest[] }>(url)
    },
  })

  const records = (attendanceQuery.data?.list ?? []).filter((r) => !r.deletedAt)
  const leaves = (leaveQuery.data?.list ?? []).filter((l) => !l.deletedAt)

  /* ── Mutations ── */
  const invalidateAttendance = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['edu-ai-management', 'attendance'] })
    queryClient.invalidateQueries({ queryKey: ['edu-ai-management', 'attendance-stats'] })
  }, [queryClient])

  const invalidateLeave = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['edu-ai-management', 'leave'] })
  }, [queryClient])

  const checkInMutation = useMutation({
    mutationFn: (data: CheckInFormData) =>
      api('/api/edu-ai-management/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: invalidateAttendance,
  })

  const checkOutMutation = useMutation({
    mutationFn: ({
      studentId,
      classId,
      date,
    }: {
      studentId: string
      classId: string
      date: string
    }) =>
      api('/api/edu-ai-management/attendance/check-out', {
        method: 'PUT',
        body: JSON.stringify({ studentId, classId, date, checkOutMethod: 'manual' }),
      }),
    onSuccess: invalidateAttendance,
  })

  const deleteAttendanceMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/api/edu-ai-management/attendance/${id}`, { method: 'DELETE' }),
    onSuccess: invalidateAttendance,
  })

  const createLeaveMutation = useMutation({
    mutationFn: (data: LeaveFormData) =>
      api('/api/edu-ai-management/leave', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: invalidateLeave,
  })

  const approveLeaveMutation = useMutation({
    mutationFn: ({
      id,
      status,
      remark,
    }: {
      id: string
      status: 'approved' | 'rejected'
      remark: string
    }) =>
      api(`/api/edu-ai-management/leave/${id}/approve`, {
        method: 'PUT',
        body: JSON.stringify({ status, approveRemark: remark || null }),
      }),
    onSuccess: invalidateLeave,
  })

  const deleteLeaveMutation = useMutation({
    mutationFn: (id: string) => api(`/api/edu-ai-management/leave/${id}`, { method: 'DELETE' }),
    onSuccess: invalidateLeave,
  })

  /* ── Handlers ── */
  const handleCheckIn = async (data: CheckInFormData) => {
    await checkInMutation.mutateAsync(data)
  }

  const handleCheckOut = async (record: AttendanceRecord) => {
    if (!record.checkInTime) return
    await checkOutMutation.mutateAsync({
      studentId: record.studentId,
      classId: record.classId,
      date: record.date,
    })
  }

  const handleCreateLeave = async (data: LeaveFormData) => {
    await createLeaveMutation.mutateAsync(data)
  }

  const handleApprove = async (id: string, status: 'approved' | 'rejected', remark: string) => {
    await approveLeaveMutation.mutateAsync({ id, status, remark })
  }

  const handleDeleteLeave = async (id: string) => {
    await deleteLeaveMutation.mutateAsync(id)
  }

  /* ── Stats helpers ── */
  const stats = statsQuery.data
  const presentCount = stats?.statusBreakdown.find((s) => s.status === 'present')?.count ?? 0

  /* ── 取词解析:未知码(后端新增值)原样回显,不吞协议数据 ── */
  const attendanceStatusLabel = (status: string): string => {
    const key = ATTENDANCE_STATUS_KEY_MAP.get(status)
    return key ? t(key) : status
  }
  const checkInMethodLabel = (method: string): string => {
    const key = CHECK_IN_METHOD_KEYS[method]
    return key ? t(key) : method
  }
  const leaveStatusLabel = (status: string): string => {
    const key = LEAVE_STATUS_KEY_MAP.get(status)
    return key ? t(key) : status
  }
  const leaveTypeLabel = (leaveType: string): string => {
    const key = LEAVE_TYPE_KEY_MAP.get(leaveType)
    return key ? t(key) : leaveType
  }

  return (
    <div className="space-y-4">
      <BackButton />

      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('pageTitle')}</h1>
        <p className="text-xs text-muted-foreground">{t('pageSubtitle')}</p>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="check">
            <UserCheck className="mr-1.5 h-4 w-4" />
            <span>{t('tabCheck')}</span>
          </TabsTrigger>
          <TabsTrigger value="stats">
            <BarChart3 className="mr-1.5 h-4 w-4" />
            <span>{t('tabStats')}</span>
          </TabsTrigger>
          <TabsTrigger value="leave">
            <ClipboardList className="mr-1.5 h-4 w-4" />
            <span>{t('tabLeave')}</span>
          </TabsTrigger>
        </TabsList>

        {/* ════════════════ Tab 1: Check-in/out ════════════════ */}
        <TabsContent value="check" className="space-y-4">
          <Card>
            <CardContent className="min-[640px]:p-3 flex flex-wrap items-center gap-3 p-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <Select value={attendanceStatusFilter} onValueChange={setAttendanceStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder={t('allStatus')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allStatus')}</SelectItem>
                  {ATTENDANCE_STATUS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {t(s.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => setCheckInOpen(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                {t('checkIn')}
              </Button>
              {attendanceQuery.isLoading && (
                <div className="ml-auto flex items-center text-xs text-muted-foreground">
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  {t('loading')}
                </div>
              )}
            </CardContent>
          </Card>

          {attendanceQuery.error ? (
            <Alert variant="danger" description={t('loadRecordsFailed')} />
          ) : attendanceQuery.isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {t('loadingRecords')}
              </CardContent>
            </Card>
          ) : records.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                {t('emptyRecords')}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          {t('studentId')}
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          {t('checkInTime')}
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          {t('checkOutTime')}
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          {t('status')}
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          {t('checkInMethod')}
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          {t('remark')}
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                          {t('actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r) => (
                        <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 text-xs font-mono">
                            {r.studentId.slice(0, 8)}...
                          </td>
                          <td className="px-4 py-3">
                            {r.checkInTime ? (
                              <span className="inline-flex items-center gap-1 text-xs">
                                <Clock className="h-3 w-3 text-green-500" />
                                {new Date(r.checkInTime).toLocaleTimeString('zh-CN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {r.checkOutTime ? (
                              <span className="inline-flex items-center gap-1 text-xs">
                                <Clock className="h-3 w-3 text-orange-500" />
                                {new Date(r.checkOutTime).toLocaleTimeString('zh-CN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-[10px] text-white',
                                ATTENDANCE_COLOR_MAP.get(r.status) ?? 'bg-gray-500',
                              )}
                            >
                              {attendanceStatusLabel(r.status)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {checkInMethodLabel(r.checkInMethod)}
                          </td>
                          <td className="max-w-[120px] truncate px-4 py-3 text-xs text-muted-foreground">
                            {r.remark ?? '-'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {!r.checkOutTime && r.checkInTime && (
                                <Button
                                  variant="outline"
                                  size="xs"
                                  className="text-xs"
                                  onClick={() => handleCheckOut(r)}
                                  disabled={checkOutMutation.isPending}
                                >
                                  <Clock className="mr-1 h-3 w-3" />
                                  {t('checkOut')}
                                </Button>
                              )}
                              {!r.checkInTime && (
                                <Button
                                  variant="outline"
                                  size="xs"
                                  className="text-xs"
                                  onClick={() => {
                                    setCheckInOpen(true)
                                  }}
                                >
                                  <UserCheck className="mr-1 h-3 w-3" />
                                  {t('makeUpCheckIn')}
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="xs"
                                className="text-xs text-red-500"
                                onClick={() => deleteAttendanceMutation.mutate(r.id)}
                                disabled={deleteAttendanceMutation.isPending}
                              >
                                {t('deleteAction')}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ════════════════ Tab 2: Stats ════════════════ */}
        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardContent className="min-[640px]:p-3 flex flex-wrap items-center gap-3 p-3">
              <div className="flex items-center gap-1 rounded-md border p-0.5">
                {(['daily', 'weekly', 'monthly'] as const).map((p) => (
                  <Button
                    key={p}
                    variant={statsPeriod === p ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setStatsPeriod(p)}
                  >
                    {t(STATS_PERIOD_KEYS[p])}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={statsStartDate}
                  onChange={(e) => setStatsStartDate(e.target.value)}
                  className="w-36"
                />
                <span className="text-xs text-muted-foreground">~</span>
                <Input
                  type="date"
                  value={statsEndDate}
                  onChange={(e) => setStatsEndDate(e.target.value)}
                  className="w-36"
                />
              </div>
              {statsQuery.isLoading && (
                <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </CardContent>
          </Card>

          {statsQuery.error ? (
            <Alert variant="danger" description={t('loadStatsFailed')} />
          ) : statsQuery.isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {t('loadingStats')}
              </CardContent>
            </Card>
          ) : stats ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t('statsTotal')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{stats.total}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t('statsAttendanceRate')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-green-500">{stats.attendanceRate}%</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t('statsNormalAttendance')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{presentCount}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">{t('statusDistribution')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {ATTENDANCE_STATUS.map((s) => {
                      const count =
                        stats.statusBreakdown.find((b) => b.status === s.value)?.count ?? 0
                      const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0
                      return (
                        <div key={s.value} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5">
                              <span className={cn('inline-block h-2 w-2 rounded-sm', s.color)} />
                              {t(s.labelKey)}
                            </span>
                            <span className="text-muted-foreground">
                              {count} ({pct}%)
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-sm bg-muted">
                            <div
                              className={cn('h-full rounded-sm transition-all', s.color)}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {stats.periodBreakdown.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">{t('trend')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                              {t('period')}
                            </th>
                            {ATTENDANCE_STATUS.map((s) => (
                              <th
                                key={s.value}
                                className="px-3 py-2 text-right font-medium text-muted-foreground"
                              >
                                {t(s.labelKey)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {stats.periodBreakdown
                            .reduce<Array<{ period: string; breakdown: Record<string, number> }>>(
                              (acc, item) => {
                                let group = acc.find((g) => g.period === item.period)
                                if (!group) {
                                  group = { period: item.period, breakdown: {} }
                                  acc.push(group)
                                }
                                group.breakdown[item.status] =
                                  (group.breakdown[item.status] ?? 0) + item.count
                                return acc
                              },
                              [],
                            )
                            .map((group) => (
                              <tr
                                key={group.period}
                                className="border-b last:border-0 hover:bg-muted/30"
                              >
                                <td className="px-3 py-2 text-xs font-medium">{group.period}</td>
                                {ATTENDANCE_STATUS.map((s) => (
                                  <td key={s.value} className="px-3 py-2 text-right text-xs">
                                    {group.breakdown[s.value] ?? 0}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          {stats.periodBreakdown.length === 0 && (
                            <tr>
                              <td
                                colSpan={6}
                                className="py-4 text-center text-xs text-muted-foreground"
                              >
                                {t('emptyTrend')}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
        </TabsContent>

        {/* ════════════════ Tab 3: Leave Requests ════════════════ */}
        <TabsContent value="leave" className="space-y-4">
          <Card>
            <CardContent className="min-[640px]:p-3 flex flex-wrap items-center gap-3 p-3">
              <Select
                value={leaveStatusFilter}
                onValueChange={(v) => setLeaveStatusFilter(v === 'all' ? '' : v)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder={t('allStatus')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allStatus')}</SelectItem>
                  {LEAVE_STATUS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {t(s.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={leaveStartDate}
                  onChange={(e) => setLeaveStartDate(e.target.value)}
                  className="w-36"
                />
                <span className="text-xs text-muted-foreground">~</span>
                <Input
                  type="date"
                  value={leaveEndDate}
                  onChange={(e) => setLeaveEndDate(e.target.value)}
                  className="w-36"
                />
              </div>
              <Button size="sm" onClick={() => setLeaveOpen(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                {t('submitLeave')}
              </Button>
              {leaveQuery.isLoading && (
                <div className="ml-auto flex items-center text-xs text-muted-foreground">
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  {t('loading')}
                </div>
              )}
            </CardContent>
          </Card>

          {leaveQuery.error ? (
            <Alert variant="danger" description={t('loadLeavesFailed')} />
          ) : leaveQuery.isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {t('loadingLeaves')}
              </CardContent>
            </Card>
          ) : leaves.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                {t('emptyLeaves')}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          {t('studentId')}
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          {t('type')}
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          {t('dateRange')}
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          {t('days')}
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          {t('reason')}
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          {t('status')}
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                          {t('actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaves.map((l) => (
                        <tr key={l.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 text-xs font-mono">
                            {l.studentId.slice(0, 8)}...
                          </td>
                          <td className="px-4 py-3 text-xs">{leaveTypeLabel(l.leaveType)}</td>
                          <td className="px-4 py-3 text-xs">
                            {l.startDate} ~ {l.endDate}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {t('daysWithUnit', { count: l.totalDays })}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            <TruncatedText value={l.reason} className="max-w-[150px]" />
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-[10px] text-white',
                                LEAVE_STATUS_COLOR_MAP.get(l.status) ?? 'bg-gray-500',
                              )}
                            >
                              {leaveStatusLabel(l.status)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {l.status === 'pending' && (
                                <Button
                                  variant="outline"
                                  size="xs"
                                  className="text-xs"
                                  onClick={() => {
                                    setApprovingLeave(l)
                                    setApproveOpen(true)
                                  }}
                                >
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                  {t('approveAction')}
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="xs"
                                className="text-xs text-red-500"
                                onClick={() => handleDeleteLeave(l.id)}
                                disabled={deleteLeaveMutation.isPending}
                              >
                                {t('deleteAction')}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CheckInDialog
        open={checkInOpen}
        onOpenChange={setCheckInOpen}
        classId=""
        defaultDate={attendanceDate}
        onSave={handleCheckIn}
      />

      <LeaveDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        classId=""
        onSave={handleCreateLeave}
      />

      <ApproveDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        leave={approvingLeave}
        onApprove={handleApprove}
      />
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
