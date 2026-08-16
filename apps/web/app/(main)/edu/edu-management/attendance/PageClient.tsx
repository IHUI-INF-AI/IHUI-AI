'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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

const ATTENDANCE_STATUS = [
  { value: 'present', label: '正常', color: 'bg-green-500' },
  { value: 'late', label: '迟到', color: 'bg-yellow-500' },
  { value: 'early', label: '早退', color: 'bg-orange-500' },
  { value: 'absent', label: '缺勤', color: 'bg-red-500' },
  { value: 'leave', label: '请假', color: 'bg-blue-500' },
] as const

const ATTENDANCE_STATUS_MAP: Map<string, string> = new Map(
  ATTENDANCE_STATUS.map((s) => [s.value, s.label]),
)
const ATTENDANCE_COLOR_MAP: Map<string, string> = new Map(
  ATTENDANCE_STATUS.map((s) => [s.value, s.color]),
)

const LEAVE_TYPES = [
  { value: 'sick', label: '病假' },
  { value: 'personal', label: '事假' },
  { value: 'emergency', label: '紧急' },
  { value: 'other', label: '其他' },
] as const

const LEAVE_TYPE_MAP = new Map<string, string>(LEAVE_TYPES.map((t) => [t.value, t.label]))

const LEAVE_STATUS = [
  { value: 'pending', label: '待审批', color: 'bg-yellow-500' },
  { value: 'approved', label: '已批准', color: 'bg-green-500' },
  { value: 'rejected', label: '已驳回', color: 'bg-red-500' },
  { value: 'cancelled', label: '已取消', color: 'bg-gray-500' },
] as const

const LEAVE_STATUS_MAP = new Map<string, string>(LEAVE_STATUS.map((s) => [s.value, s.label]))
const LEAVE_STATUS_COLOR_MAP = new Map<string, string>(LEAVE_STATUS.map((s) => [s.value, s.color]))

const CHECK_IN_METHODS: Record<string, string> = {
  manual: '教师代签',
  face: '人脸识别',
  qrcode: '扫码签到',
  self: '学生自签',
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
          <DialogTitle>签到</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>学生ID</Label>
            <Input
              value={form.studentId}
              onChange={(e) => update('studentId', e.target.value)}
              placeholder="请输入学生ID"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>日期</Label>
            <Input type="date" value={form.date} onChange={(e) => update('date', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>签到方式</Label>
              <Select value={form.checkInMethod} onValueChange={(v) => update('checkInMethod', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CHECK_IN_METHODS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>状态</Label>
              <Select value={form.status} onValueChange={(v) => update('status', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ATTENDANCE_STATUS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>备注</Label>
            <Input
              value={form.remark}
              onChange={(e) => update('remark', e.target.value)}
              placeholder="可选，备注信息"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={saving || !form.studentId.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            确认签到
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
          <DialogTitle>提交请假申请</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>学生ID</Label>
            <Input
              value={form.studentId}
              onChange={(e) => update('studentId', e.target.value)}
              placeholder="请输入学生ID"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>请假类型</Label>
            <Select value={form.leaveType} onValueChange={(v) => update('leaveType', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAVE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>开始日期</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => update('startDate', e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>结束日期</Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => update('endDate', e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>请假天数</Label>
            <Input type="number" value={form.totalDays} readOnly className="bg-muted" />
          </div>
          <div className="grid gap-1.5">
            <Label>请假原因</Label>
            <Input
              value={form.reason}
              onChange={(e) => update('reason', e.target.value)}
              placeholder="请输入请假原因"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>附件链接</Label>
            <Input
              value={form.attachment}
              onChange={(e) => update('attachment', e.target.value)}
              placeholder="可选，病假条等附件链接"
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
            提交申请
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>审批请假申请</DialogTitle>
        </DialogHeader>
        {leave && (
          <div className="space-y-3 py-2">
            <div className="rounded-md border p-3 text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">类型：</span>
                {LEAVE_TYPE_MAP.get(leave.leaveType) ?? leave.leaveType}
              </p>
              <p>
                <span className="text-muted-foreground">日期：</span>
                {leave.startDate} ~ {leave.endDate} ({leave.totalDays}天)
              </p>
              <p>
                <span className="text-muted-foreground">原因：</span>
                {leave.reason}
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label>审批意见</Label>
              <Input
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="可选，审批意见"
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
            驳回
          </Button>
          <Button variant="default" onClick={() => handleAction('approved')} disabled={processing}>
            {processing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1 h-4 w-4" />
            )}
            批准
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Main Page ─── */

export default function AttendancePage() {
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

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />

      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">考勤管理</h1>
        <p className="text-xs text-muted-foreground">
          管理学生签到/签退、查看考勤统计、处理请假申请
        </p>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="check">
            <UserCheck className="mr-1.5 h-4 w-4" />
            签到/签退
          </TabsTrigger>
          <TabsTrigger value="stats">
            <BarChart3 className="mr-1.5 h-4 w-4" />
            考勤统计
          </TabsTrigger>
          <TabsTrigger value="leave">
            <ClipboardList className="mr-1.5 h-4 w-4" />
            请假管理
          </TabsTrigger>
        </TabsList>

        {/* ════════════════ Tab 1: Check-in/out ════════════════ */}
        <TabsContent value="check" className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
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
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  {ATTENDANCE_STATUS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => setCheckInOpen(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                签到
              </Button>
              {attendanceQuery.isLoading && (
                <div className="ml-auto flex items-center text-xs text-muted-foreground">
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  加载中...
                </div>
              )}
            </CardContent>
          </Card>

          {attendanceQuery.error ? (
            <Alert variant="danger" description="加载签到记录失败，请稍后重试" />
          ) : attendanceQuery.isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                加载签到记录...
              </CardContent>
            </Card>
          ) : records.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                暂无签到记录
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
                          学生ID
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          签到时间
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          签退时间
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          状态
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          签到方式
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          备注
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                          操作
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
                              {ATTENDANCE_STATUS_MAP.get(r.status) ?? r.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {CHECK_IN_METHODS[r.checkInMethod] ?? r.checkInMethod}
                          </td>
                          <td className="max-w-[120px] truncate px-4 py-3 text-xs text-muted-foreground">
                            {r.remark ?? '-'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {!r.checkOutTime && r.checkInTime && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => handleCheckOut(r)}
                                  disabled={checkOutMutation.isPending}
                                >
                                  <Clock className="mr-1 h-3 w-3" />
                                  签退
                                </Button>
                              )}
                              {!r.checkInTime && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    setCheckInOpen(true)
                                  }}
                                >
                                  <UserCheck className="mr-1 h-3 w-3" />
                                  补签
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-red-500"
                                onClick={() => deleteAttendanceMutation.mutate(r.id)}
                                disabled={deleteAttendanceMutation.isPending}
                              >
                                删除
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
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <div className="flex items-center gap-1 rounded-md border p-0.5">
                {(['daily', 'weekly', 'monthly'] as const).map((p) => (
                  <Button
                    key={p}
                    variant={statsPeriod === p ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setStatsPeriod(p)}
                  >
                    {p === 'daily' ? '日' : p === 'weekly' ? '周' : '月'}
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
            <Alert variant="danger" description="加载考勤统计失败，请稍后重试" />
          ) : statsQuery.isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                加载统计...
              </CardContent>
            </Card>
          ) : stats ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      总记录数
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{stats.total}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      出勤率
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-green-500">{stats.attendanceRate}%</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      正常出勤
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{presentCount}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">状态分布</CardTitle>
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
                              {s.label}
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
                    <CardTitle className="text-sm font-medium">趋势</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                              时段
                            </th>
                            {ATTENDANCE_STATUS.map((s) => (
                              <th
                                key={s.value}
                                className="px-3 py-2 text-right font-medium text-muted-foreground"
                              >
                                {s.label}
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
                                暂无趋势数据
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
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <Select
                value={leaveStatusFilter}
                onValueChange={(v) => setLeaveStatusFilter(v === 'all' ? '' : v)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  {LEAVE_STATUS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
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
                提交请假
              </Button>
              {leaveQuery.isLoading && (
                <div className="ml-auto flex items-center text-xs text-muted-foreground">
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  加载中...
                </div>
              )}
            </CardContent>
          </Card>

          {leaveQuery.error ? (
            <Alert variant="danger" description="加载请假记录失败，请稍后重试" />
          ) : leaveQuery.isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                加载请假记录...
              </CardContent>
            </Card>
          ) : leaves.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                暂无请假记录
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
                          学生ID
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          类型
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          日期范围
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          天数
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          原因
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          状态
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaves.map((l) => (
                        <tr key={l.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 text-xs font-mono">
                            {l.studentId.slice(0, 8)}...
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {LEAVE_TYPE_MAP.get(l.leaveType) ?? l.leaveType}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {l.startDate} ~ {l.endDate}
                          </td>
                          <td className="px-4 py-3 text-xs">{l.totalDays}天</td>
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
                              {LEAVE_STATUS_MAP.get(l.status) ?? l.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {l.status === 'pending' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    setApprovingLeave(l)
                                    setApproveOpen(true)
                                  }}
                                >
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                  审批
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-red-500"
                                onClick={() => handleDeleteLeave(l.id)}
                                disabled={deleteLeaveMutation.isPending}
                              >
                                删除
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
