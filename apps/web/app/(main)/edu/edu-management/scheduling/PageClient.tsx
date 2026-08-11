'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Calendar,
  School,
  Users,
  BookOpen,
  Wand2,
  Siren,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { fetchApi } from '@/lib/api'
import { BackButton, TruncatedText } from '@/components/common'
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

/* ─── Types ─── */

interface Term {
  id: string
  name: string
  startDate: string
  endDate: string
  isCurrent: boolean
}

interface EduClass {
  id: string
  name: string
  grade: string | null
}

interface SchedulingRule {
  id: string
  classId: string
  subject: string
  teacher: string
  weekday: number
  startTime: string
  endTime: string
  classroom: string
  priority: number
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

interface TeacherSchedule {
  id: string
  teacher: string
  weekday: number
  startTime: string
  endTime: string
  available: boolean
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

interface ScheduleChange {
  id: string
  courseName: string
  originalTime: string
  newTime: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  applicant: string
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

/* ─── API helper ─── */

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

/* ─── Constants ─── */

const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

const SCHEDULE_CHANGE_STATUS = [
  { value: 'pending', label: '待审批', color: 'bg-yellow-500 text-white' },
  { value: 'approved', label: '已批准', color: 'bg-green-500 text-white' },
  { value: 'rejected', label: '已驳回', color: 'bg-red-500 text-white' },
] as const

const SCHEDULE_CHANGE_STATUS_MAP = new Map(SCHEDULE_CHANGE_STATUS.map((s) => [s.value, s.label]))
const SCHEDULE_CHANGE_COLOR_MAP = new Map(SCHEDULE_CHANGE_STATUS.map((s) => [s.value, s.color]))

/* ─── Scheduling Rule Dialog ─── */

interface RuleFormData {
  classId: string
  subject: string
  teacher: string
  weekday: number
  startTime: string
  endTime: string
  classroom: string
  priority: number
}

function RuleDialog({
  open,
  onOpenChange,
  classes,
  initial,
  onSave,
  onDelete,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  classes: EduClass[]
  initial: SchedulingRule | null
  onSave: (data: RuleFormData) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [form, setForm] = React.useState<RuleFormData>({
    classId: '',
    subject: '',
    teacher: '',
    weekday: 1,
    startTime: '08:00',
    endTime: '09:00',
    classroom: '',
    priority: 1,
  })
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  React.useEffect(() => {
    if (initial) {
      setForm({
        classId: initial.classId,
        subject: initial.subject,
        teacher: initial.teacher,
        weekday: initial.weekday,
        startTime: initial.startTime,
        endTime: initial.endTime,
        classroom: initial.classroom,
        priority: initial.priority,
      })
    } else {
      setForm({
        classId: classes[0]?.id ?? '',
        subject: '',
        teacher: '',
        weekday: 1,
        startTime: '08:00',
        endTime: '09:00',
        classroom: '',
        priority: 1,
      })
    }
  }, [initial, classes, open])

  const update = (key: keyof RuleFormData, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!form.subject.trim() || !form.teacher.trim()) return
    setSaving(true)
    try {
      await onSave(form)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return
    setDeleting(true)
    try {
      await onDelete()
      onOpenChange(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? '编辑排课规则' : '添加排课规则'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>班级</Label>
            <Select value={form.classId} onValueChange={(v) => update('classId', v)}>
              <SelectTrigger>
                <SelectValue placeholder="选择班级" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>科目</Label>
              <Input value={form.subject} onChange={(e) => update('subject', e.target.value)} placeholder="数学" />
            </div>
            <div className="grid gap-1.5">
              <Label>教师</Label>
              <Input value={form.teacher} onChange={(e) => update('teacher', e.target.value)} placeholder="教师姓名" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>星期</Label>
            <Select value={String(form.weekday)} onValueChange={(v) => update('weekday', Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEKDAY_LABELS.map((label, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>开始时间</Label>
              <Input type="time" value={form.startTime} onChange={(e) => update('startTime', e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>结束时间</Label>
              <Input type="time" value={form.endTime} onChange={(e) => update('endTime', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>教室</Label>
              <Input value={form.classroom} onChange={(e) => update('classroom', e.target.value)} placeholder="A101" />
            </div>
            <div className="grid gap-1.5">
              <Label>优先级</Label>
              <Input type="number" min={1} value={form.priority} onChange={(e) => update('priority', Number(e.target.value))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          {initial && onDelete && (
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              删除
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving || !form.subject.trim() || !form.teacher.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {initial ? '保存' : '添加'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Teacher Schedule Dialog ─── */

interface TeacherScheduleFormData {
  teacher: string
  weekday: number
  startTime: string
  endTime: string
  available: boolean
}

function TeacherScheduleDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  onDelete,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial: TeacherSchedule | null
  onSave: (data: TeacherScheduleFormData) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [form, setForm] = React.useState<TeacherScheduleFormData>({
    teacher: '',
    weekday: 1,
    startTime: '08:00',
    endTime: '18:00',
    available: true,
  })
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  React.useEffect(() => {
    if (initial) {
      setForm({
        teacher: initial.teacher,
        weekday: initial.weekday,
        startTime: initial.startTime,
        endTime: initial.endTime,
        available: initial.available,
      })
    } else {
      setForm({
        teacher: '',
        weekday: 1,
        startTime: '08:00',
        endTime: '18:00',
        available: true,
      })
    }
  }, [initial, open])

  const update = (key: keyof TeacherScheduleFormData, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!form.teacher.trim()) return
    setSaving(true)
    try {
      await onSave(form)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return
    setDeleting(true)
    try {
      await onDelete()
      onOpenChange(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? '编辑时间条目' : '添加时间条目'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>教师</Label>
            <Input value={form.teacher} onChange={(e) => update('teacher', e.target.value)} placeholder="教师姓名" />
          </div>
          <div className="grid gap-1.5">
            <Label>星期</Label>
            <Select value={String(form.weekday)} onValueChange={(v) => update('weekday', Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEKDAY_LABELS.map((label, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>开始时间</Label>
              <Input type="time" value={form.startTime} onChange={(e) => update('startTime', e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>结束时间</Label>
              <Input type="time" value={form.endTime} onChange={(e) => update('endTime', e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300"
              checked={form.available}
              onChange={(e) => update('available', e.target.checked)}
            />
            可用
          </label>
        </div>
        <DialogFooter>
          {initial && onDelete && (
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              删除
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving || !form.teacher.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {initial ? '保存' : '添加'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Main Page ─── */

export default function SchedulingPage() {
  const queryClient = useQueryClient()

  /* ── State ── */
  const [selectedTermId, setSelectedTermId] = React.useState('')
  const [activeTab, setActiveTab] = React.useState('rules')
  const [ruleOpen, setRuleOpen] = React.useState(false)
  const [editingRule, setEditingRule] = React.useState<SchedulingRule | null>(null)
  const [teacherScheduleOpen, setTeacherScheduleOpen] = React.useState(false)
  const [editingTeacherSchedule, setEditingTeacherSchedule] = React.useState<TeacherSchedule | null>(null)
  const [conflictDialogOpen, setConflictDialogOpen] = React.useState(false)
  const [conflicts, setConflicts] = React.useState<string[]>([])

  /* ── Queries ── */
  const { data: termsData } = useQuery({
    queryKey: ['edu-ai-management', 'term'],
    queryFn: () => api<{ list: Term[] }>('/api/edu-ai-management/term'),
  })
  const terms = React.useMemo(() => termsData?.list ?? [], [termsData])

  React.useEffect(() => {
    if (terms.length > 0 && !selectedTermId) {
      const current = terms.find((t) => t.isCurrent)
      setSelectedTermId(current?.id ?? terms[0]!.id)
    }
  }, [terms, selectedTermId])

  const { data: classesData } = useQuery({
    queryKey: ['edu-ai-management', 'class', selectedTermId],
    queryFn: () => api<{ list: EduClass[] }>(`/api/edu-ai-management/class?termId=${selectedTermId}`),
    enabled: !!selectedTermId,
  })
  const classes = React.useMemo(() => classesData?.list ?? [], [classesData])

  const { data: rulesData, isLoading: rulesLoading } = useQuery({
    queryKey: ['edu-ai-management', 'scheduling', 'rule', selectedTermId],
    queryFn: () => api<{ list: SchedulingRule[] }>(`/api/edu-ai-management/scheduling/rule?termId=${selectedTermId}`),
    enabled: !!selectedTermId,
  })
  const rules = (rulesData?.list ?? []).filter((r) => !r.deletedAt)

  const { data: teacherSchedulesData, isLoading: teacherSchedulesLoading } = useQuery({
    queryKey: ['edu-ai-management', 'scheduling', 'teacher-schedule', selectedTermId],
    queryFn: () => api<{ list: TeacherSchedule[] }>(`/api/edu-ai-management/scheduling/teacher-schedule?termId=${selectedTermId}`),
    enabled: !!selectedTermId,
  })
  const teacherSchedules = (teacherSchedulesData?.list ?? []).filter((s) => !s.deletedAt)

  const { data: changesData, isLoading: changesLoading } = useQuery({
    queryKey: ['edu-ai-management', 'scheduling', 'change', selectedTermId],
    queryFn: () => api<{ list: ScheduleChange[] }>(`/api/edu-ai-management/scheduling/change?termId=${selectedTermId}`),
    enabled: !!selectedTermId,
  })
  const changes = (changesData?.list ?? []).filter((c) => !c.deletedAt)

  /* ── Mutations ── */
  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['edu-ai-management', 'scheduling'] })
  }, [queryClient])

  const createRule = useMutation({
    mutationFn: (data: RuleFormData) =>
      api('/api/edu-ai-management/scheduling/rule', {
        method: 'POST',
        body: JSON.stringify({ ...data, termId: selectedTermId }),
      }),
    onSuccess: invalidate,
  })

  const updateRule = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RuleFormData }) =>
      api(`/api/edu-ai-management/scheduling/rule/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: invalidate,
  })

  const deleteRule = useMutation({
    mutationFn: (id: string) =>
      api(`/api/edu-ai-management/scheduling/rule/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })

  const autoGenerate = useMutation({
    mutationFn: () =>
      api<{ success: boolean; message: string }>('/api/edu-ai-management/scheduling/auto-generate', {
        method: 'POST',
        body: JSON.stringify({ termId: selectedTermId }),
      }),
    onSuccess: invalidate,
  })

  const checkConflicts = useMutation({
    mutationFn: () =>
      api<{ conflicts: string[] }>('/api/edu-ai-management/scheduling/check-conflicts', {
        method: 'POST',
        body: JSON.stringify({ termId: selectedTermId }),
      }),
    onSuccess: (data) => {
      setConflicts(data.conflicts)
      setConflictDialogOpen(true)
    },
  })

  const createTeacherSchedule = useMutation({
    mutationFn: (data: TeacherScheduleFormData) =>
      api('/api/edu-ai-management/scheduling/teacher-schedule', {
        method: 'POST',
        body: JSON.stringify({ ...data, termId: selectedTermId }),
      }),
    onSuccess: invalidate,
  })

  const updateTeacherSchedule = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TeacherScheduleFormData }) =>
      api(`/api/edu-ai-management/scheduling/teacher-schedule/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: invalidate,
  })

  const deleteTeacherSchedule = useMutation({
    mutationFn: (id: string) =>
      api(`/api/edu-ai-management/scheduling/teacher-schedule/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })

  const approveChange = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'rejected' }) =>
      api(`/api/edu-ai-management/scheduling/change/${id}/approve`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),
    onSuccess: invalidate,
  })

  /* ── Handlers ── */
  const handleSaveRule = async (data: RuleFormData) => {
    if (editingRule) {
      await updateRule.mutateAsync({ id: editingRule.id, data })
    } else {
      await createRule.mutateAsync(data)
    }
  }

  const handleDeleteRule = async () => {
    if (editingRule) {
      await deleteRule.mutateAsync(editingRule.id)
    }
  }

  const handleSaveTeacherSchedule = async (data: TeacherScheduleFormData) => {
    if (editingTeacherSchedule) {
      await updateTeacherSchedule.mutateAsync({ id: editingTeacherSchedule.id, data })
    } else {
      await createTeacherSchedule.mutateAsync(data)
    }
  }

  const handleDeleteTeacherSchedule = async () => {
    if (editingTeacherSchedule) {
      await deleteTeacherSchedule.mutateAsync(editingTeacherSchedule.id)
    }
  }

  const classMap = React.useMemo(() => {
    const map = new Map(classes.map((c) => [c.id, c.name]))
    return map
  }, [classes])

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />

      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">智能排课</h1>
        <p className="text-xs text-muted-foreground">管理排课规则、教师时间表及调课申请</p>
      </header>

      {/* Term Selector */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex items-center gap-2">
            <School className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedTermId} onValueChange={setSelectedTermId}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="选择学期" />
              </SelectTrigger>
              <SelectContent>
                {terms.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}{t.isCurrent ? ' (当前)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="rules">
            <BookOpen className="mr-1.5 h-4 w-4" />
            排课规则
          </TabsTrigger>
          <TabsTrigger value="teachers">
            <Users className="mr-1.5 h-4 w-4" />
            教师时间表
          </TabsTrigger>
          <TabsTrigger value="changes">
            <Calendar className="mr-1.5 h-4 w-4" />
            调课管理
          </TabsTrigger>
        </TabsList>

        {/* ════════════ Tab 1: Rules ════════════ */}
        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <Button size="sm" onClick={() => { setEditingRule(null); setRuleOpen(true) }} disabled={!selectedTermId}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                添加规则
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => autoGenerate.mutateAsync()}
                disabled={autoGenerate.isPending || !selectedTermId}
              >
                {autoGenerate.isPending ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Wand2 className="mr-1 h-3.5 w-3.5" />
                )}
                自动排课
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => checkConflicts.mutateAsync()}
                disabled={checkConflicts.isPending || !selectedTermId}
              >
                {checkConflicts.isPending ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Siren className="mr-1 h-3.5 w-3.5" />
                )}
                冲突检测
              </Button>
              {rulesLoading && (
                <div className="ml-auto flex items-center text-xs text-muted-foreground">
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  加载中...
                </div>
              )}
            </CardContent>
          </Card>

          {rulesLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                加载排课规则...
              </CardContent>
            </Card>
          ) : rules.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                暂无排课规则
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">班级</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">科目</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">教师</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">星期</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">时间</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">教室</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">优先级</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rules.map((r) => (
                        <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 text-xs">{classMap.get(r.classId) ?? r.classId}</td>
                          <td className="px-4 py-3 text-xs font-medium">{r.subject}</td>
                          <td className="px-4 py-3 text-xs">{r.teacher}</td>
                          <td className="px-4 py-3 text-xs">{WEEKDAY_LABELS[r.weekday - 1]}</td>
                          <td className="px-4 py-3 text-xs">{r.startTime} - {r.endTime}</td>
                          <td className="px-4 py-3 text-xs">{r.classroom}</td>
                          <td className="px-4 py-3 text-xs">{r.priority}</td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => { setEditingRule(r); setRuleOpen(true) }}
                            >
                              编辑
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-red-500"
                              onClick={() => deleteRule.mutate(r.id)}
                            >
                              删除
                            </Button>
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

        {/* ════════════ Tab 2: Teacher Schedules ════════════ */}
        <TabsContent value="teachers" className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <Button size="sm" onClick={() => { setEditingTeacherSchedule(null); setTeacherScheduleOpen(true) }} disabled={!selectedTermId}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                添加时间条目
              </Button>
              {teacherSchedulesLoading && (
                <div className="ml-auto flex items-center text-xs text-muted-foreground">
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  加载中...
                </div>
              )}
            </CardContent>
          </Card>

          {teacherSchedulesLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                加载教师时间表...
              </CardContent>
            </Card>
          ) : teacherSchedules.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                暂无教师时间表
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">教师</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">星期</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">时间段</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">是否可用</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teacherSchedules.map((s) => (
                        <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 text-xs font-medium">{s.teacher}</td>
                          <td className="px-4 py-3 text-xs">{WEEKDAY_LABELS[s.weekday - 1]}</td>
                          <td className="px-4 py-3 text-xs">{s.startTime} - {s.endTime}</td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="secondary"
                              className={cn('text-[10px] text-white', s.available ? 'bg-green-500' : 'bg-red-500')}
                            >
                              {s.available ? '可用' : '不可用'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => { setEditingTeacherSchedule(s); setTeacherScheduleOpen(true) }}
                            >
                              编辑
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-red-500"
                              onClick={() => deleteTeacherSchedule.mutate(s.id)}
                            >
                              删除
                            </Button>
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

        {/* ════════════ Tab 3: Schedule Changes ════════════ */}
        <TabsContent value="changes" className="space-y-4">
          {changesLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                加载调课申请...
              </CardContent>
            </Card>
          ) : changes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                暂无调课申请
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">课程</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">原时间</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">新时间</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">原因</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">状态</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">申请人</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {changes.map((c) => (
                        <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 text-xs font-medium">{c.courseName}</td>
                          <td className="px-4 py-3 text-xs">{c.originalTime}</td>
                          <td className="px-4 py-3 text-xs">{c.newTime}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            <TruncatedText value={c.reason} className="max-w-[150px]" />
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="secondary"
                              className={cn('text-[10px] text-white', SCHEDULE_CHANGE_COLOR_MAP.get(c.status) ?? 'bg-gray-500')}
                            >
                              {SCHEDULE_CHANGE_STATUS_MAP.get(c.status) ?? c.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs">{c.applicant}</td>
                          <td className="px-4 py-3 text-right">
                            {c.status === 'pending' && (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => approveChange.mutateAsync({ id: c.id, status: 'approved' })}
                                >
                                  <CheckCircle2 className="mr-1 h-3 w-3 text-green-500" />
                                  批准
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => approveChange.mutateAsync({ id: c.id, status: 'rejected' })}
                                >
                                  <XCircle className="mr-1 h-3 w-3 text-red-500" />
                                  驳回
                                </Button>
                              </div>
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
      </Tabs>

      {/* Rule Dialog */}
      <RuleDialog
        open={ruleOpen}
        onOpenChange={setRuleOpen}
        classes={classes}
        initial={editingRule}
        onSave={handleSaveRule}
        onDelete={editingRule ? handleDeleteRule : undefined}
      />

      {/* Teacher Schedule Dialog */}
      <TeacherScheduleDialog
        open={teacherScheduleOpen}
        onOpenChange={setTeacherScheduleOpen}
        initial={editingTeacherSchedule}
        onSave={handleSaveTeacherSchedule}
        onDelete={editingTeacherSchedule ? handleDeleteTeacherSchedule : undefined}
      />

      {/* Conflict Dialog */}
      <Dialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>冲突检测结果</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {conflicts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-green-600">
                <CheckCircle2 className="mb-2 h-8 w-8" />
                <p className="text-sm font-medium">未检测到冲突</p>
              </div>
            ) : (
              <div className="space-y-2">
                {conflicts.map((msg, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{msg}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setConflictDialogOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}