'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Loader2,
  UserPlus,
  Calendar,
  BookOpen,
  CheckCircle2,
  XCircle,
  ChevronRight,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { fetchApi } from '@/lib/api'
import { BackButton } from '@/components/common'
import {
  Card,
  CardContent,
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

interface Lead {
  id: string
  name: string
  phone: string
  studentName: string
  studentAge: number
  source: string
  status: string
  follower: string
  nextFollowUp: string | null
  remark: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

interface TrialReservation {
  id: string
  studentName: string
  parentName: string
  parentPhone: string
  trialDate: string
  trialTime: string
  subject: string
  teacher: string
  classroom: string
  status: string
  remark: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

interface EnrollmentRecord {
  id: string
  studentId: string
  studentName: string
  classId: string
  className: string
  termId: string
  termName: string
  enrollDate: string
  totalFee: number
  paidAmount: number
  status: string
  remark: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

interface EduClass {
  id: string
  name: string
  grade: string | null
}

interface Term {
  id: string
  name: string
  startDate: string
  endDate: string
  isCurrent: boolean
}

/* ─── API helper ─── */

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

/* ─── Constants ─── */

const LEAD_SOURCES = [
  { value: 'wechat', label: '微信' },
  { value: 'phone', label: '电话' },
  { value: 'visit', label: '上门' },
  { value: 'referral', label: '转介绍' },
  { value: 'ad', label: '广告' },
  { value: 'other', label: '其他' },
] as const

const LEAD_SOURCE_MAP: Map<string, string> = new Map(LEAD_SOURCES.map((s) => [s.value, s.label]))

const LEAD_STATUSES = [
  { value: 'new', label: '新建', color: 'bg-blue-500' },
  { value: 'contacted', label: '已联系', color: 'bg-yellow-500' },
  { value: 'trial', label: '试听中', color: 'bg-purple-500' },
  { value: 'enrolled', label: '已报名', color: 'bg-green-500' },
  { value: 'lost', label: '已流失', color: 'bg-gray-500' },
] as const

const LEAD_STATUS_MAP: Map<string, string> = new Map(LEAD_STATUSES.map((s) => [s.value, s.label]))
const LEAD_STATUS_COLOR_MAP: Map<string, string> = new Map(
  LEAD_STATUSES.map((s) => [s.value, s.color]),
)

const STATUS_ORDER: string[] = LEAD_STATUSES.map((s) => s.value)

const TRIAL_STATUSES = [
  { value: 'pending', label: '待确认', color: 'bg-yellow-500' },
  { value: 'confirmed', label: '已确认', color: 'bg-green-500' },
  { value: 'completed', label: '已完成', color: 'bg-blue-500' },
  { value: 'cancelled', label: '已取消', color: 'bg-gray-500' },
] as const

const TRIAL_STATUS_MAP: Map<string, string> = new Map(TRIAL_STATUSES.map((s) => [s.value, s.label]))
const TRIAL_STATUS_COLOR_MAP: Map<string, string> = new Map(
  TRIAL_STATUSES.map((s) => [s.value, s.color]),
)

const ENROLLMENT_STATUSES = [
  { value: 'enrolled', label: '在读', color: 'bg-green-500' },
  { value: 'withdrawn', label: '已退学', color: 'bg-gray-500' },
  { value: 'graduate', label: '已毕业', color: 'bg-blue-500' },
] as const

const ENROLLMENT_STATUS_MAP: Map<string, string> = new Map(
  ENROLLMENT_STATUSES.map((s) => [s.value, s.label]),
)
const ENROLLMENT_STATUS_COLOR_MAP: Map<string, string> = new Map(
  ENROLLMENT_STATUSES.map((s) => [s.value, s.color]),
)

/* ─── Lead Dialog ─── */

interface LeadFormData {
  name: string
  phone: string
  studentName: string
  studentAge: number
  source: string
  follower: string
  remark: string
}

function LeadDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSave: (data: LeadFormData) => Promise<void>
}) {
  const [form, setForm] = React.useState<LeadFormData>({
    name: '',
    phone: '',
    studentName: '',
    studentAge: 0,
    source: 'wechat',
    follower: '',
    remark: '',
  })
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setForm({
        name: '',
        phone: '',
        studentName: '',
        studentAge: 0,
        source: 'wechat',
        follower: '',
        remark: '',
      })
    }
  }, [open])

  const update = (key: keyof LeadFormData, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim()) return
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
          <DialogTitle>添加线索</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>线索姓名</Label>
              <Input
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="家长姓名"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>电话</Label>
              <Input
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="手机号"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>学员姓名</Label>
              <Input
                value={form.studentName}
                onChange={(e) => update('studentName', e.target.value)}
                placeholder="学员姓名"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>学员年龄</Label>
              <Input
                type="number"
                min={0}
                value={form.studentAge}
                onChange={(e) => update('studentAge', Number(e.target.value))}
                placeholder="年龄"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>来源</Label>
              <Select value={form.source} onValueChange={(v) => update('source', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>跟进人</Label>
              <Input
                value={form.follower}
                onChange={(e) => update('follower', e.target.value)}
                placeholder="跟进人姓名"
              />
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
          <Button onClick={handleSave} disabled={saving || !form.name.trim() || !form.phone.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            添加线索
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Trial Dialog ─── */

interface TrialFormData {
  studentName: string
  parentName: string
  parentPhone: string
  trialDate: string
  trialTime: string
  subject: string
  teacher: string
  classroom: string
  remark: string
}

function TrialDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSave: (data: TrialFormData) => Promise<void>
}) {
  const [form, setForm] = React.useState<TrialFormData>({
    studentName: '',
    parentName: '',
    parentPhone: '',
    trialDate: '',
    trialTime: '',
    subject: '',
    teacher: '',
    classroom: '',
    remark: '',
  })
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setForm({
        studentName: '',
        parentName: '',
        parentPhone: '',
        trialDate: '',
        trialTime: '',
        subject: '',
        teacher: '',
        classroom: '',
        remark: '',
      })
    }
  }, [open])

  const update = (key: keyof TrialFormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (
      !form.studentName.trim() ||
      !form.parentName.trim() ||
      !form.parentPhone.trim() ||
      !form.trialDate ||
      !form.trialTime
    )
      return
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
          <DialogTitle>添加试听预约</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>学员姓名</Label>
              <Input
                value={form.studentName}
                onChange={(e) => update('studentName', e.target.value)}
                placeholder="学员姓名"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>家长姓名</Label>
              <Input
                value={form.parentName}
                onChange={(e) => update('parentName', e.target.value)}
                placeholder="家长姓名"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>家长电话</Label>
            <Input
              value={form.parentPhone}
              onChange={(e) => update('parentPhone', e.target.value)}
              placeholder="手机号"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>试听日期</Label>
              <Input
                type="date"
                value={form.trialDate}
                onChange={(e) => update('trialDate', e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>试听时间</Label>
              <Input
                type="time"
                value={form.trialTime}
                onChange={(e) => update('trialTime', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>科目</Label>
              <Input
                value={form.subject}
                onChange={(e) => update('subject', e.target.value)}
                placeholder="如：数学"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>教师</Label>
              <Input
                value={form.teacher}
                onChange={(e) => update('teacher', e.target.value)}
                placeholder="教师姓名"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>教室</Label>
            <Input
              value={form.classroom}
              onChange={(e) => update('classroom', e.target.value)}
              placeholder="如：A101"
            />
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
          <Button
            onClick={handleSave}
            disabled={
              saving ||
              !form.studentName.trim() ||
              !form.parentName.trim() ||
              !form.parentPhone.trim() ||
              !form.trialDate ||
              !form.trialTime
            }
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            添加预约
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Enrollment Dialog ─── */

interface EnrollmentFormData {
  studentId: string
  studentName: string
  classId: string
  termId: string
  enrollDate: string
  totalFee: number
  paidAmount: number
  remark: string
}

function EnrollmentDialog({
  open,
  onOpenChange,
  classes,
  terms,
  onSave,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  classes: EduClass[]
  terms: Term[]
  onSave: (data: EnrollmentFormData) => Promise<void>
}) {
  const [form, setForm] = React.useState<EnrollmentFormData>({
    studentId: '',
    studentName: '',
    classId: '',
    termId: '',
    enrollDate: new Date().toISOString().split('T')[0]!,
    totalFee: 0,
    paidAmount: 0,
    remark: '',
  })
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setForm({
        studentId: '',
        studentName: '',
        classId: classes[0]?.id ?? '',
        termId: terms[0]?.id ?? '',
        enrollDate: new Date().toISOString().split('T')[0]!,
        totalFee: 0,
        paidAmount: 0,
        remark: '',
      })
    }
  }, [open, classes, terms])

  const update = (key: keyof EnrollmentFormData, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!form.studentName.trim() || !form.classId || !form.termId || !form.enrollDate) return
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
          <DialogTitle>添加报名记录</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>学员姓名</Label>
              <Input
                value={form.studentName}
                onChange={(e) => update('studentName', e.target.value)}
                placeholder="学员姓名"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>学员ID</Label>
              <Input
                value={form.studentId}
                onChange={(e) => update('studentId', e.target.value)}
                placeholder="可选"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>班级</Label>
              <Select value={form.classId} onValueChange={(v) => update('classId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="选择班级" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>学期</Label>
              <Select value={form.termId} onValueChange={(v) => update('termId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="选择学期" />
                </SelectTrigger>
                <SelectContent>
                  {terms.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>报名日期</Label>
            <Input
              type="date"
              value={form.enrollDate}
              onChange={(e) => update('enrollDate', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>总费用</Label>
              <Input
                type="number"
                min={0}
                value={form.totalFee}
                onChange={(e) => update('totalFee', Number(e.target.value))}
                placeholder="0"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>已支付</Label>
              <Input
                type="number"
                min={0}
                value={form.paidAmount}
                onChange={(e) => update('paidAmount', Number(e.target.value))}
                placeholder="0"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>备注</Label>
            <Input
              value={form.remark}
              onChange={(e) => update('remark', e.target.value)}
              placeholder="可选"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleSave}
            disabled={
              saving ||
              !form.studentName.trim() ||
              !form.classId ||
              !form.termId ||
              !form.enrollDate
            }
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            添加报名
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Main Page ─── */

export default function EnrollmentPage() {
  const queryClient = useQueryClient()

  /* ── State ── */
  const [activeTab, setActiveTab] = React.useState('leads')
  const [leadStatusFilter, setLeadStatusFilter] = React.useState('')
  const [leadSourceFilter, setLeadSourceFilter] = React.useState('')
  const [enrollClassFilter, setEnrollClassFilter] = React.useState('')
  const [enrollTermFilter, setEnrollTermFilter] = React.useState('')
  const [enrollStatusFilter, setEnrollStatusFilter] = React.useState('')
  const [leadDialogOpen, setLeadDialogOpen] = React.useState(false)
  const [trialDialogOpen, setTrialDialogOpen] = React.useState(false)
  const [enrollDialogOpen, setEnrollDialogOpen] = React.useState(false)

  /* ── Queries ── */
  const { data: termsData } = useQuery({
    queryKey: ['edu-ai-management', 'term'],
    queryFn: () => api<{ list: Term[] }>('/api/edu-ai-management/term'),
  })
  const terms = React.useMemo(() => termsData?.list ?? [], [termsData])

  const { data: classesData } = useQuery({
    queryKey: ['edu-ai-management', 'class'],
    queryFn: () => api<{ list: EduClass[] }>('/api/edu-ai-management/class'),
  })
  const classes = React.useMemo(() => classesData?.list ?? [], [classesData])

  const leadQuery = useQuery({
    queryKey: ['edu-ai-management', 'lead', leadStatusFilter, leadSourceFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (leadStatusFilter) params.set('status', leadStatusFilter)
      if (leadSourceFilter) params.set('source', leadSourceFilter)
      const qs = params.toString()
      return api<{ list: Lead[] }>(`/api/edu-ai-management/lead${qs ? `?${qs}` : ''}`)
    },
  })

  const trialQuery = useQuery({
    queryKey: ['edu-ai-management', 'trial-reservation'],
    queryFn: () => api<{ list: TrialReservation[] }>('/api/edu-ai-management/trial-reservation'),
  })

  const enrollQuery = useQuery({
    queryKey: [
      'edu-ai-management',
      'enrollment',
      enrollClassFilter,
      enrollTermFilter,
      enrollStatusFilter,
    ],
    queryFn: () => {
      const params = new URLSearchParams()
      if (enrollClassFilter) params.set('classId', enrollClassFilter)
      if (enrollTermFilter) params.set('termId', enrollTermFilter)
      if (enrollStatusFilter) params.set('status', enrollStatusFilter)
      const qs = params.toString()
      return api<{ list: EnrollmentRecord[] }>(
        `/api/edu-ai-management/enrollment${qs ? `?${qs}` : ''}`,
      )
    },
  })

  const leads = (leadQuery.data?.list ?? []).filter((l) => !l.deletedAt)
  const trials = (trialQuery.data?.list ?? []).filter((t) => !t.deletedAt)
  const enrollments = (enrollQuery.data?.list ?? []).filter((e) => !e.deletedAt)

  /* ── Mutations ── */
  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['edu-ai-management'] })
  }, [queryClient])

  const createLead = useMutation({
    mutationFn: (data: LeadFormData) =>
      api('/api/edu-ai-management/lead', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: invalidate,
  })

  const updateLeadStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/api/edu-ai-management/lead/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),
    onSuccess: invalidate,
  })

  const createTrial = useMutation({
    mutationFn: (data: TrialFormData) =>
      api('/api/edu-ai-management/trial-reservation', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: invalidate,
  })

  const updateTrialStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/api/edu-ai-management/trial-reservation/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),
    onSuccess: invalidate,
  })

  const createEnrollment = useMutation({
    mutationFn: (data: EnrollmentFormData) =>
      api('/api/edu-ai-management/enrollment', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: invalidate,
  })

  /* ── Handlers ── */
  const handleAddLead = async (data: LeadFormData) => {
    await createLead.mutateAsync(data)
  }

  const handleNextStatus = async (lead: Lead) => {
    const currentIdx = STATUS_ORDER.indexOf(lead.status)
    if (currentIdx < STATUS_ORDER.length - 1) {
      const nextStatus = STATUS_ORDER[currentIdx + 1]!
      await updateLeadStatus.mutateAsync({ id: lead.id, status: nextStatus })
    }
  }

  const handleAddTrial = async (data: TrialFormData) => {
    await createTrial.mutateAsync(data)
  }

  const handleUpdateTrialStatus = async (id: string, status: string) => {
    await updateTrialStatus.mutateAsync({ id, status })
  }

  const handleAddEnrollment = async (data: EnrollmentFormData) => {
    await createEnrollment.mutateAsync(data)
  }

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />

      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">招生管理</h1>
        <p className="text-xs text-muted-foreground">管理线索、试听预约和报名记录</p>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="leads">
            <UserPlus className="mr-1.5 h-4 w-4" />
            线索管理
          </TabsTrigger>
          <TabsTrigger value="trials">
            <Calendar className="mr-1.5 h-4 w-4" />
            试听预约
          </TabsTrigger>
          <TabsTrigger value="enrollments">
            <BookOpen className="mr-1.5 h-4 w-4" />
            报名记录
          </TabsTrigger>
        </TabsList>

        {/* ════════════════ Tab 1: Leads ════════════════ */}
        <TabsContent value="leads" className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <Select
                value={leadStatusFilter}
                onValueChange={(v) => setLeadStatusFilter(v === 'all' ? '' : v)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  {LEAD_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={leadSourceFilter}
                onValueChange={(v) => setLeadSourceFilter(v === 'all' ? '' : v)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="全部来源" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部来源</SelectItem>
                  {LEAD_SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => setLeadDialogOpen(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                添加线索
              </Button>
              {leadQuery.isLoading && (
                <div className="ml-auto flex items-center text-xs text-muted-foreground">
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  加载中...
                </div>
              )}
            </CardContent>
          </Card>

          {leadQuery.error ? (
            <Alert variant="danger" description="加载线索数据失败，请稍后重试" />
          ) : leadQuery.isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                加载线索...
              </CardContent>
            </Card>
          ) : leads.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                暂无线索数据
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
                          线索姓名
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          电话
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          学员
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          年龄
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          来源
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          状态
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          跟进人
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          下次跟进
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {leads.map((lead) => (
                        <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 text-xs font-medium">{lead.name}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{lead.phone}</td>
                          <td className="px-4 py-3 text-xs">{lead.studentName}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {lead.studentAge}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {LEAD_SOURCE_MAP.get(lead.source) ?? lead.source}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-[10px] text-white',
                                LEAD_STATUS_COLOR_MAP.get(lead.status) ?? 'bg-gray-500',
                              )}
                            >
                              {LEAD_STATUS_MAP.get(lead.status) ?? lead.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {lead.follower}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {lead.nextFollowUp ?? '-'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {lead.status !== 'enrolled' && lead.status !== 'lost' && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => handleNextStatus(lead)}
                                disabled={updateLeadStatus.isPending}
                              >
                                <ChevronRight className="mr-1 h-3 w-3" />
                                {LEAD_STATUSES[STATUS_ORDER.indexOf(lead.status) + 1]?.label ??
                                  '推进'}
                              </Button>
                            )}
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

        {/* ════════════════ Tab 2: Trials ════════════════ */}
        <TabsContent value="trials" className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <Button size="sm" onClick={() => setTrialDialogOpen(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                添加预约
              </Button>
              {trialQuery.isLoading && (
                <div className="ml-auto flex items-center text-xs text-muted-foreground">
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  加载中...
                </div>
              )}
            </CardContent>
          </Card>

          {trialQuery.error ? (
            <Alert variant="danger" description="加载试听预约数据失败，请稍后重试" />
          ) : trialQuery.isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                加载试听预约...
              </CardContent>
            </Card>
          ) : trials.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                暂无试听预约
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
                          学员
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          家长
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          电话
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          试听日期
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          时间
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          科目
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          教师
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
                      {trials.map((t) => (
                        <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 text-xs font-medium">{t.studentName}</td>
                          <td className="px-4 py-3 text-xs">{t.parentName}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {t.parentPhone}
                          </td>
                          <td className="px-4 py-3 text-xs">{t.trialDate}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{t.trialTime}</td>
                          <td className="px-4 py-3 text-xs">{t.subject}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{t.teacher}</td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-[10px] text-white',
                                TRIAL_STATUS_COLOR_MAP.get(t.status) ?? 'bg-gray-500',
                              )}
                            >
                              {TRIAL_STATUS_MAP.get(t.status) ?? t.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {t.status === 'pending' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs text-green-600"
                                  onClick={() => handleUpdateTrialStatus(t.id, 'confirmed')}
                                  disabled={updateTrialStatus.isPending}
                                >
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                  确认
                                </Button>
                              )}
                              {t.status === 'confirmed' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs text-blue-600"
                                  onClick={() => handleUpdateTrialStatus(t.id, 'completed')}
                                  disabled={updateTrialStatus.isPending}
                                >
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                  完成
                                </Button>
                              )}
                              {(t.status === 'pending' || t.status === 'confirmed') && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-red-500"
                                  onClick={() => handleUpdateTrialStatus(t.id, 'cancelled')}
                                  disabled={updateTrialStatus.isPending}
                                >
                                  <XCircle className="mr-1 h-3 w-3" />
                                  取消
                                </Button>
                              )}
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

        {/* ════════════════ Tab 3: Enrollments ════════════════ */}
        <TabsContent value="enrollments" className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <Select
                value={enrollClassFilter}
                onValueChange={(v) => setEnrollClassFilter(v === 'all' ? '' : v)}
              >
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="全部班级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部班级</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={enrollTermFilter}
                onValueChange={(v) => setEnrollTermFilter(v === 'all' ? '' : v)}
              >
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="全部学期" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部学期</SelectItem>
                  {terms.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={enrollStatusFilter}
                onValueChange={(v) => setEnrollStatusFilter(v === 'all' ? '' : v)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  {ENROLLMENT_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => setEnrollDialogOpen(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                添加报名
              </Button>
              {enrollQuery.isLoading && (
                <div className="ml-auto flex items-center text-xs text-muted-foreground">
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  加载中...
                </div>
              )}
            </CardContent>
          </Card>

          {enrollQuery.error ? (
            <Alert variant="danger" description="加载报名记录失败，请稍后重试" />
          ) : enrollQuery.isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                加载报名记录...
              </CardContent>
            </Card>
          ) : enrollments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                暂无报名记录
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
                          学员
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          班级
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          学期
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          报名日期
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          总费用
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          已支付
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          状态
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrollments.map((e) => (
                        <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 text-xs font-medium">{e.studentName}</td>
                          <td className="px-4 py-3 text-xs">{e.className}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{e.termName}</td>
                          <td className="px-4 py-3 text-xs">{e.enrollDate}</td>
                          <td className="px-4 py-3 text-xs font-medium">
                            {e.totalFee.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-xs">{e.paidAmount.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-[10px] text-white',
                                ENROLLMENT_STATUS_COLOR_MAP.get(e.status) ?? 'bg-gray-500',
                              )}
                            >
                              {ENROLLMENT_STATUS_MAP.get(e.status) ?? e.status}
                            </Badge>
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
      <LeadDialog open={leadDialogOpen} onOpenChange={setLeadDialogOpen} onSave={handleAddLead} />

      <TrialDialog
        open={trialDialogOpen}
        onOpenChange={setTrialDialogOpen}
        onSave={handleAddTrial}
      />

      <EnrollmentDialog
        open={enrollDialogOpen}
        onOpenChange={setEnrollDialogOpen}
        classes={classes}
        terms={terms}
        onSave={handleAddEnrollment}
      />
    </div>
  )
}
