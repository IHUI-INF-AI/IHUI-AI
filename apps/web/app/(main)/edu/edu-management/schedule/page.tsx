'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Loader2,
  School,
  Users,
  AlertCircle,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { fetchApi } from '@/lib/api'
import { BackButton } from '@/components/common'
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
} from '@ihui/ui-react'
import { Alert } from '@/components/feedback'

/* ─── Types ─── */

interface Term {
  id: string
  name: string
  startDate: string
  endDate: string
  isCurrent: boolean
  createdAt: string
  updatedAt: string
}

interface EduClass {
  id: string
  termId: string
  name: string
  grade: string | null
  createdAt: string
  updatedAt: string
}

interface ScheduleEntry {
  id: string
  termId: string
  classId: string
  courseName: string
  teacher: string | null
  weekday: number
  startTime: string
  endTime: string
  classroom: string | null
  color: string | null
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

const TIME_SLOTS = Array.from({ length: 13 }, (_, i) => {
  const h = i + 8
  return `${String(h).padStart(2, '0')}:00`
})

const COLOR_OPTIONS = [
  { value: 'bg-blue-500', label: '蓝色' },
  { value: 'bg-green-500', label: '绿色' },
  { value: 'bg-purple-500', label: '紫色' },
  { value: 'bg-orange-500', label: '橙色' },
  { value: 'bg-pink-500', label: '粉色' },
  { value: 'bg-teal-500', label: '青色' },
  { value: 'bg-indigo-500', label: '靛蓝' },
  { value: 'bg-rose-500', label: '玫瑰红' },
]

/* ─── Helpers ─── */

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getMonthFirstWeekday(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

/* ─── Schedule Edit Dialog ─── */

interface ScheduleFormData {
  courseName: string
  teacher: string
  startTime: string
  endTime: string
  classroom: string
  color: string
  weekday: number
}

const emptyScheduleForm: ScheduleFormData = {
  courseName: '',
  teacher: '',
  startTime: '08:00',
  endTime: '09:00',
  classroom: '',
  color: 'bg-blue-500',
  weekday: 1,
}

function ScheduleEditDialog({
  open,
  onOpenChange,
  initial,
  weekday,
  onSave,
  onDelete,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial: ScheduleEntry | null
  weekday?: number
  onSave: (data: ScheduleFormData) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [form, setForm] = React.useState<ScheduleFormData>(emptyScheduleForm)
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  React.useEffect(() => {
    if (initial) {
      setForm({
        courseName: initial.courseName,
        teacher: initial.teacher ?? '',
        startTime: initial.startTime,
        endTime: initial.endTime,
        classroom: initial.classroom ?? '',
        color: initial.color ?? 'bg-blue-500',
        weekday: initial.weekday,
      })
    } else {
      setForm({ ...emptyScheduleForm, weekday: weekday ?? 1 })
    }
  }, [initial, weekday, open])

  const update = (key: keyof ScheduleFormData, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!form.courseName.trim()) return
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
          <DialogTitle>{initial ? '编辑课程' : '添加课程'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>课程名称</Label>
            <Input
              value={form.courseName}
              onChange={(e) => update('courseName', e.target.value)}
              placeholder="例如：高等数学"
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
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>开始时间</Label>
              <Input
                type="time"
                value={form.startTime}
                onChange={(e) => update('startTime', e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>结束时间</Label>
              <Input
                type="time"
                value={form.endTime}
                onChange={(e) => update('endTime', e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>教室</Label>
            <Input
              value={form.classroom}
              onChange={(e) => update('classroom', e.target.value)}
              placeholder="例如：A101"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>颜色标记</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  className={cn(
                    'h-7 w-7 rounded-md transition-all',
                    c.value,
                    form.color === c.value && 'ring-2 ring-offset-2 ring-ring',
                  )}
                  onClick={() => update('color', c.value)}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          {initial && onDelete && (
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              删除
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving || !form.courseName.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {initial ? '保存' : '添加'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Term Management Dialog ─── */

function TermDialog({
  open,
  onOpenChange,
  terms,
  onSave,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  terms: Term[]
  onSave: (data: Partial<Term>) => Promise<void>
}) {
  const [editTerm, setEditTerm] = React.useState<Term | null>(null)
  const [name, setName] = React.useState('')
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [isCurrent, setIsCurrent] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  const resetForm = (term?: Term | null) => {
    if (term) {
      setName(term.name)
      setStartDate(term.startDate)
      setEndDate(term.endDate)
      setIsCurrent(term.isCurrent)
      setEditTerm(term)
    } else {
      setName('')
      setStartDate('')
      setEndDate('')
      setIsCurrent(false)
      setEditTerm(null)
    }
  }

  React.useEffect(() => {
    if (open) resetForm(null)
  }, [open])

  const handleSave = async () => {
    if (!name.trim() || !startDate || !endDate) return
    setSaving(true)
    try {
      await onSave({ name: name.trim(), startDate, endDate, isCurrent })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>学期管理</DialogTitle>
        </DialogHeader>

        <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
          {terms.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">暂无学期</p>
          ) : (
            terms.map((t) => (
              <div
                key={t.id}
                role="button"
                tabIndex={0}
                className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
                onClick={() => resetForm(t)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') resetForm(t) }}
              >
                <span className={cn(editTerm?.id === t.id && 'font-medium')}>
                  {t.name}
                  {t.isCurrent && (
                    <Badge variant="default" className="ml-2 text-[10px]">
                      当前
                    </Badge>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t.startDate} ~ {t.endDate}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">{editTerm ? '编辑学期' : '新建学期'}</p>
          <div className="grid gap-1.5">
            <Label>学期名称</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：2026年春季学期" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>开始日期</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>结束日期</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300"
              checked={isCurrent}
              onChange={(e) => setIsCurrent(e.target.checked)}
            />
            设为当前学期
          </label>
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={saving || !name.trim() || !startDate || !endDate}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {editTerm ? '保存修改' : '创建学期'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Class Management Dialog ─── */

function ClassDialog({
  open,
  onOpenChange,
  classes,
  onSave,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  classes: EduClass[]
  onSave: (data: { name: string; grade: string }) => Promise<void>
}) {
  const [name, setName] = React.useState('')
  const [grade, setGrade] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setName('')
      setGrade('')
    }
  }, [open])

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave({ name: name.trim(), grade: grade.trim() })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>班级管理</DialogTitle>
        </DialogHeader>

        <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
          {classes.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">暂无班级</p>
          ) : (
            classes.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm"
              >
                <span>
                  {c.name}
                  {c.grade && <span className="ml-2 text-xs text-muted-foreground">({c.grade})</span>}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">新建班级</p>
          <div className="grid gap-1.5">
            <Label>班级名称</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：计算机科学1班" />
          </div>
          <div className="grid gap-1.5">
            <Label>年级</Label>
            <Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="例如：2024级" />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            创建班级
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Main Page ─── */

export default function SchedulePage() {
  const queryClient = useQueryClient()

  /* ── State ── */
  const [selectedTermId, setSelectedTermId] = React.useState('')
  const [selectedClassId, setSelectedClassId] = React.useState('')
  const [viewMode, setViewMode] = React.useState<'week' | 'month'>('week')
  const [weekOffset, setWeekOffset] = React.useState(0)
  const [monthOffset, setMonthOffset] = React.useState(0)
  const [scheduleEditOpen, setScheduleEditOpen] = React.useState(false)
  const [editingSchedule, setEditingSchedule] = React.useState<ScheduleEntry | null>(null)
  const [editWeekday, setEditWeekday] = React.useState(1)
  const [termDialogOpen, setTermDialogOpen] = React.useState(false)
  const [classDialogOpen, setClassDialogOpen] = React.useState(false)

  /* ── Queries ── */
  const {
    data: termsData,
    isLoading: termsLoading,
    error: termsError,
  } = useQuery({
    queryKey: ['edu-ai-management', 'term'],
    queryFn: () => api<{ list: Term[] }>('/api/edu-ai-management/term'),
  })

  const terms = React.useMemo(() => termsData?.list ?? [], [termsData])

  // Auto-select the first term (current term preferred)
  React.useEffect(() => {
    if (terms.length > 0 && !selectedTermId) {
      const current = terms.find((t) => t.isCurrent)
      setSelectedTermId(current?.id ?? terms[0]!.id)
    }
  }, [terms, selectedTermId])

  const {
    data: classesData,
    isLoading: classesLoading,
  } = useQuery({
    queryKey: ['edu-ai-management', 'class', selectedTermId],
    queryFn: () => api<{ list: EduClass[] }>(`/api/edu-ai-management/class?termId=${selectedTermId}`),
    enabled: !!selectedTermId,
  })

  const classes = React.useMemo(() => classesData?.list ?? [], [classesData])

  // Auto-select first class
  React.useEffect(() => {
    if (classes.length > 0 && !selectedClassId) {
      setSelectedClassId(classes[0]!.id)
    }
  }, [classes, selectedClassId])

  const {
    data: schedulesData,
    isLoading: schedulesLoading,
  } = useQuery({
    queryKey: ['edu-ai-management', 'schedule', selectedTermId, selectedClassId],
    queryFn: () =>
      api<{ list: ScheduleEntry[] }>(
        `/api/edu-ai-management/schedule?termId=${selectedTermId}&classId=${selectedClassId}`,
      ),
    enabled: !!selectedTermId && !!selectedClassId,
  })

  const schedules = (schedulesData?.list ?? []).filter((s) => !s.deletedAt)

  /* ── Mutations ── */
  const invalidate = React.useCallback(
    () => {
      queryClient.invalidateQueries({ queryKey: ['edu-ai-management'] })
    },
    [queryClient],
  )

  const createSchedule = useMutation({
    mutationFn: (data: ScheduleFormData) =>
      api('/api/edu-ai-management/schedule', {
        method: 'POST',
        body: JSON.stringify({
          termId: selectedTermId,
          classId: selectedClassId,
          courseName: data.courseName,
          teacher: data.teacher || null,
          weekday: data.weekday,
          startTime: data.startTime,
          endTime: data.endTime,
          classroom: data.classroom || null,
          color: data.color || null,
        }),
      }),
    onSuccess: invalidate,
  })

  const updateSchedule = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ScheduleFormData }) =>
      api(`/api/edu-ai-management/schedule/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          courseName: data.courseName,
          teacher: data.teacher || null,
          weekday: data.weekday,
          startTime: data.startTime,
          endTime: data.endTime,
          classroom: data.classroom || null,
          color: data.color || null,
        }),
      }),
    onSuccess: invalidate,
  })

  const deleteSchedule = useMutation({
    mutationFn: (id: string) =>
      api(`/api/edu-ai-management/schedule/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })

  const saveTerm = useMutation({
    mutationFn: (data: Partial<Term>) =>
      data.id
        ? api(`/api/edu-ai-management/term/${data.id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
          })
        : api('/api/edu-ai-management/term', {
            method: 'POST',
            body: JSON.stringify(data),
          }),
    onSuccess: invalidate,
  })

  const saveClass = useMutation({
    mutationFn: (data: { name: string; grade: string }) =>
      api('/api/edu-ai-management/class', {
        method: 'POST',
        body: JSON.stringify({ ...data, termId: selectedTermId }),
      }),
    onSuccess: invalidate,
  })

  /* ── Week / Month helpers ── */
  const today = React.useMemo(() => new Date(), [])
  const currentMonday = React.useMemo(() => {
    const m = getMonday(today)
    m.setDate(m.getDate() + weekOffset * 7)
    return m
  }, [today, weekOffset])

  const weekDays = React.useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(currentMonday)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [currentMonday])

  const currentMonth = React.useMemo(() => {
    const d = new Date(today)
    d.setMonth(d.getMonth() + monthOffset)
    return d
  }, [today, monthOffset])

  const monthGrid = React.useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const daysInMonth = getDaysInMonth(year, month)
    const firstWeekday = getMonthFirstWeekday(year, month)
    const cells: Array<{ day: number | null; date: Date | null }> = []
    // Fill leading blanks
    for (let i = 0; i < firstWeekday; i++) {
      cells.push({ day: null, date: null })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d)
      cells.push({ day: d, date })
    }
    return cells
  }, [currentMonth])

  /* ── Group schedules by weekday for week view ── */
  const scheduleMap = React.useMemo(() => {
    const map = new Map<number, ScheduleEntry[]>()
    for (const s of schedules) {
      const list = map.get(s.weekday) ?? []
      list.push(s)
      map.set(s.weekday, list)
    }
    // Sort each list by startTime
    for (const [, list] of map) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime))
    }
    return map
  }, [schedules])

  

  /* ── Edit handlers ── */
  const handleAddSchedule = (weekday: number) => {
    setEditingSchedule(null)
    setEditWeekday(weekday)
    setScheduleEditOpen(true)
  }

  const handleEditSchedule = (entry: ScheduleEntry) => {
    setEditingSchedule(entry)
    setEditWeekday(entry.weekday)
    setScheduleEditOpen(true)
  }

  const handleSaveSchedule = async (data: ScheduleFormData) => {
    if (editingSchedule) {
      await updateSchedule.mutateAsync({ id: editingSchedule.id, data })
    } else {
      await createSchedule.mutateAsync(data)
    }
  }

  const handleDeleteSchedule = async () => {
    if (editingSchedule) {
      await deleteSchedule.mutateAsync(editingSchedule.id)
    }
  }

  /* ── Render helpers ── */
  const renderScheduleCard = (entry: ScheduleEntry) => {
    const bgColor = entry.color ?? 'bg-blue-500'
    return (
      <button
        key={entry.id}
        type="button"
        className={cn(
          'w-full rounded-md px-2 py-1 text-left text-xs text-white transition-opacity hover:opacity-90',
          bgColor,
        )}
        onClick={() => handleEditSchedule(entry)}
      >
        <div className="truncate font-medium">{entry.courseName}</div>
        <div className="truncate opacity-80">
          {entry.startTime}
          {entry.endTime ? `-${entry.endTime}` : ''}
        </div>
      </button>
    )
  }

  const renderScheduleCount = (weekday: number) => {
    const list = scheduleMap.get(weekday)
    if (!list?.length) return null
    return (
      <div className="flex flex-wrap gap-1">
        {list.slice(0, 3).map((s) => (
          <span
            key={s.id}
            className={cn(
              'inline-block rounded px-1.5 py-0.5 text-[10px] text-white',
              s.color ?? 'bg-blue-500',
            )}
          >
            {s.courseName}
          </span>
        ))}
        {list.length > 3 && (
          <span className="text-[10px] text-muted-foreground">+{list.length - 3}</span>
        )}
      </div>
    )
  }

  /* ── Loading / Error states ── */
  if (termsLoading) {
    return (
      <div className="space-y-4 px-4 py-6">
        <BackButton />
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      </div>
    )
  }

  if (termsError) {
    return (
      <div className="space-y-4 px-4 py-6">
        <BackButton />
        <Alert variant="danger" description="加载学期数据失败，请稍后重试" />
      </div>
    )
  }

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />

      {/* Header */}
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">课程表管理</h1>
        <p className="text-xs text-muted-foreground">管理学期的课程安排，支持周视图和月视图</p>
      </header>

      {/* Toolbar */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          {/* Term selector */}
          <div className="flex items-center gap-2">
            <School className="h-4 w-4 text-muted-foreground" />
            <Select
              value={selectedTermId}
              onValueChange={(v) => {
                setSelectedTermId(v)
                setSelectedClassId('')
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="选择学期" />
              </SelectTrigger>
              <SelectContent>
                {terms.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    {t.isCurrent ? ' (当前)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setTermDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Class selector */}
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <Select
              value={selectedClassId}
              onValueChange={setSelectedClassId}
              disabled={!selectedTermId || classes.length === 0}
            >
              <SelectTrigger className="w-44">
                <SelectValue
                  placeholder={
                    classesLoading
                      ? '加载中...'
                      : selectedTermId
                        ? '选择班级'
                        : '请先选择学期'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.grade ? ` (${c.grade})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setClassDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* View toggle */}
          <div className="ml-auto flex items-center gap-1 rounded-md border p-0.5">
            <Button
              variant={viewMode === 'week' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('week')}
            >
              <Calendar className="mr-1 h-3.5 w-3.5" />
              周
            </Button>
            <Button
              variant={viewMode === 'month' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('month')}
            >
              <CalendarDays className="mr-1 h-3.5 w-3.5" />
              月
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Schedule area */}
      <Card>
        {schedulesLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            加载课程表...
          </div>
        ) : !selectedClassId ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <AlertCircle className="mb-2 h-8 w-8" />
            <p className="text-sm">请先选择学期和班级</p>
          </div>
        ) : viewMode === 'week' ? (
          <>
            {/* Week navigation */}
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {weekDays[0] && weekDays[6]
                  ? `${formatDate(weekDays[0])} ~ ${formatDate(weekDays[6])}`
                  : ''}
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setWeekOffset((o) => o - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setWeekOffset(0)}
                  disabled={weekOffset === 0}
                >
                  本周
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setWeekOffset((o) => o + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            {/* Week grid */}
            <CardContent className="overflow-x-auto p-0">
              <div className="grid min-w-[700px]" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
                {/* Header row */}
                <div className="sticky left-0 bg-background p-2 text-xs text-muted-foreground" />
                {WEEKDAY_LABELS.map((label, i) => {
                  const d = weekDays[i]
                  const isToday = d && formatDate(d) === formatDate(today)
                  return (
                    <div
                      key={label}
                      className={cn(
                        'border-b border-r p-2 text-center text-xs font-medium',
                        isToday && 'bg-primary/5',
                      )}
                    >
                      <div>{label}</div>
                      <div className={cn('text-muted-foreground', isToday && 'text-primary')}>
                        {d ? d.getDate() : ''}
                      </div>
                    </div>
                  )
                })}

                {/* Time slots */}
                {TIME_SLOTS.map((time) => (
                  <React.Fragment key={time}>
                    <div className="sticky left-0 flex items-start justify-end border-b bg-background pr-2 pt-2 text-xs text-muted-foreground">
                      {time}
                    </div>
                    {WEEKDAY_LABELS.map((_, wi) => {
                      const weekday = wi + 1
                      const entries = scheduleMap.get(weekday) ?? []
                      const slotEntries = entries.filter((e) => {
                        const slotHour = Number.parseInt(time.split(':')[0]!, 10)
                        const startHour = Number.parseInt(e.startTime.split(':')[0]!, 10)
                        const endHour = Number.parseInt(e.endTime.split(':')[0]!, 10)
                        return startHour <= slotHour && slotHour < endHour
                      })
                      const isFirstSlot = slotEntries.length > 0 && slotEntries.some((e) => {
                        const startHour = Number.parseInt(e.startTime.split(':')[0]!, 10)
                        const slotHour = Number.parseInt(time.split(':')[0]!, 10)
                        return startHour === slotHour
                      })
                      return (
                        <div
                          key={`${time}-${wi}`}
                          role="button"
                          tabIndex={0}
                          className={cn(
                            'relative min-h-[60px] border-b border-r p-1 transition-colors hover:bg-accent/30',
                          )}
                          onClick={() => {
                            if (slotEntries.length === 0) handleAddSchedule(weekday)
                          }}
                          onKeyDown={(e) => {
                            if ((e.key === 'Enter' || e.key === ' ') && slotEntries.length === 0) handleAddSchedule(weekday)
                          }}
                        >
                          {isFirstSlot &&
                            slotEntries.map((e) => renderScheduleCard(e))}
                        </div>
                      )
                    })}
                  </React.Fragment>
                ))}
              </div>
            </CardContent>
          </>
        ) : (
          <>
            {/* Month navigation */}
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setMonthOffset((o) => o - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMonthOffset(0)}
                  disabled={monthOffset === 0}
                >
                  本月
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setMonthOffset((o) => o + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            {/* Month grid */}
            <CardContent className="overflow-x-auto p-0">
              <div className="grid min-w-[600px] grid-cols-7">
                {WEEKDAY_LABELS.map((label) => (
                  <div
                    key={label}
                    className="border-b border-r p-2 text-center text-xs font-medium text-muted-foreground"
                  >
                    {label}
                  </div>
                ))}
                {monthGrid.map((cell, i) => {
                  if (!cell.day || !cell.date) {
                    return <div key={`empty-${i}`} className="border-b border-r bg-muted/20" />
                  }
                  const isToday = formatDate(cell.date) === formatDate(today)
                  const weekday = cell.date.getDay() === 0 ? 7 : cell.date.getDay()
                  return (
                    <div
                      key={cell.day}
                      className={cn(
                        'min-h-[80px] border-b border-r p-1.5',
                        isToday && 'bg-primary/5',
                      )}
                    >
                      <div
                        className={cn(
                          'mb-1 text-xs font-medium',
                          isToday ? 'text-primary' : 'text-muted-foreground',
                        )}
                      >
                        {cell.day}
                      </div>
                      {renderScheduleCount(weekday)}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </>
        )}
      </Card>

      {/* Schedule Edit Dialog */}
      <ScheduleEditDialog
        open={scheduleEditOpen}
        onOpenChange={setScheduleEditOpen}
        initial={editingSchedule}
        weekday={editWeekday}
        onSave={handleSaveSchedule}
        onDelete={editingSchedule ? handleDeleteSchedule : undefined}
      />

      {/* Term Dialog */}
      <TermDialog
        open={termDialogOpen}
        onOpenChange={setTermDialogOpen}
        terms={terms}
        onSave={async (data) => {
          await saveTerm.mutateAsync(data)
        }}
      />

      {/* Class Dialog */}
      <ClassDialog
        open={classDialogOpen}
        onOpenChange={setClassDialogOpen}
        classes={classes}
        onSave={async (data) => {
          await saveClass.mutateAsync(data)
        }}
      />
    </div>
  )
}