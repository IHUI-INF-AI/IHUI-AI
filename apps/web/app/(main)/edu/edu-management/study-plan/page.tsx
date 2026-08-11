'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Trash2,
  Loader2,
  School,
  Users,
  AlertCircle,
  CheckCircle2,
  Calendar,
  ChevronRight,
  ChevronLeft,
  GripVertical,
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
  Checkbox,
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

type PlanType = 'monthly' | 'weekly'
type PlanStatus = 'draft' | 'active' | 'completed' | 'archived'

interface StudyPlan {
  id: string
  title: string
  planType: PlanType
  classId: string
  termId: string
  startDate: string
  endDate: string
  description: string | null
  status: PlanStatus
  parentPlanId: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

interface PlanItem {
  id: string
  planId: string
  content: string
  objective: string | null
  notes: string | null
  dueDate: string | null
  studentId: string | null
  parentItemId: string | null
  completed: boolean
  sortOrder: number
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

const PLAN_TYPE_LABELS: Record<PlanType, string> = {
  monthly: '月计划',
  weekly: '周计划',
}

const PLAN_STATUS_VARIANTS: Record<PlanStatus, string> = {
  draft: 'bg-gray-200 text-gray-700 border-gray-300',
  active: 'bg-blue-100 text-blue-700 border-blue-300',
  completed: 'bg-green-100 text-green-700 border-green-300',
  archived: 'bg-gray-100 text-gray-500 border-gray-200',
}

/* ─── Helpers ─── */

function formatDateDisplay(dateStr: string): string {
  return dateStr.split('-').slice(0, 2).join('-')
}

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

/* ─── Types for form data ─── */

interface StudyPlanFormData {
  title: string
  planType: PlanType
  classId: string
  termId: string
  startDate: string
  endDate: string
  description: string
}

const emptyPlanForm: StudyPlanFormData = {
  title: '',
  planType: 'monthly',
  classId: '',
  termId: '',
  startDate: '',
  endDate: '',
  description: '',
}

interface PlanItemFormData {
  content: string
  objective: string
  dueDate: string
  notes: string
  completed: boolean
}

const emptyItemForm: PlanItemFormData = {
  content: '',
  objective: '',
  dueDate: '',
  notes: '',
  completed: false,
}

/* ─── Study Plan Edit Dialog ─── */

function StudyPlanEditDialog({
  open,
  onOpenChange,
  initial,
  selectedTermId,
  selectedClassId,
  terms,
  classes,
  onSave,
  onDelete,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial: StudyPlan | null
  selectedTermId: string
  selectedClassId: string
  terms: Term[]
  classes: EduClass[]
  onSave: (data: StudyPlanFormData) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [form, setForm] = React.useState<StudyPlanFormData>(emptyPlanForm)
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  React.useEffect(() => {
    if (initial) {
      setForm({
        title: initial.title,
        planType: initial.planType,
        classId: initial.classId,
        termId: initial.termId,
        startDate: initial.startDate,
        endDate: initial.endDate,
        description: initial.description ?? '',
      })
    } else {
      setForm({
        ...emptyPlanForm,
        termId: selectedTermId,
        classId: selectedClassId,
      })
    }
  }, [initial, selectedTermId, selectedClassId, open])

  const update = (key: keyof StudyPlanFormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!form.title.trim() || !form.planType || !form.classId || !form.termId || !form.startDate || !form.endDate) return
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
          <DialogTitle>{initial ? '编辑学习计划' : '创建学习计划'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>计划标题</Label>
            <Input
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="例如：2025年3月学习计划"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>计划类型</Label>
            <Select
              value={form.planType}
              onValueChange={(v: PlanType) => update('planType', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">月计划</SelectItem>
                <SelectItem value="weekly">周计划</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!initial && (
            <>
              <div className="grid gap-1.5">
                <Label>所属学期</Label>
                <Select
                  value={form.termId}
                  onValueChange={(v) => update('termId', v)}
                >
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
              <div className="grid gap-1.5">
                <Label>所属班级</Label>
                <Select
                  value={form.classId}
                  onValueChange={(v) => update('classId', v)}
                >
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
            </>
          )}
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
            <Label>描述</Label>
            <Input
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="计划描述（可选）"
            />
          </div>
        </div>
        <DialogFooter>
          {initial && onDelete && (
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              删除
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving || !form.title.trim() || !form.startDate || !form.endDate}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {initial ? '保存' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Plan Item Edit Dialog ─── */

function PlanItemEditDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  onDelete,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial: PlanItem | null
  onSave: (data: PlanItemFormData) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [form, setForm] = React.useState<PlanItemFormData>(emptyItemForm)
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  React.useEffect(() => {
    if (initial) {
      setForm({
        content: initial.content,
        objective: initial.objective ?? '',
        dueDate: initial.dueDate ?? '',
        notes: initial.notes ?? '',
        completed: initial.completed,
      })
    } else {
      setForm(emptyItemForm)
    }
  }, [initial, open])

  const update = (key: keyof PlanItemFormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!form.content.trim()) return
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
          <DialogTitle>{initial ? '编辑计划条目' : '添加计划条目'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>内容</Label>
            <Input
              value={form.content}
              onChange={(e) => update('content', e.target.value)}
              placeholder="例如：完成第一章练习题"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>学习目标</Label>
            <Input
              value={form.objective}
              onChange={(e) => update('objective', e.target.value)}
              placeholder="目标描述（可选）"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>截止日期</Label>
            <Input
              type="date"
              value={form.dueDate}
              onChange={(e) => update('dueDate', e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>备注</Label>
            <Input
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="备注信息（可选）"
            />
          </div>
          {initial && (
            <label htmlFor="item-completed" className="flex items-center gap-2 text-sm">
              <Checkbox
                id="item-completed"
                checked={form.completed}
                onCheckedChange={(checked) => update('completed', checked as boolean)}
              />
              已完成
            </label>
          )}
        </div>
        <DialogFooter>
          {initial && onDelete && (
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              删除
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving || !form.content.trim()}>
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

export default function StudyPlanPage() {
  const queryClient = useQueryClient()

  /* ── State ── */
  const [selectedTermId, setSelectedTermId] = React.useState('')
  const [selectedClassId, setSelectedClassId] = React.useState('')
  const [planFilter, setPlanFilter] = React.useState<PlanType | 'all'>('all')
  const [selectedPlan, setSelectedPlan] = React.useState<StudyPlan | null>(null)
  const [planEditOpen, setPlanEditOpen] = React.useState(false)
  const [editingPlan, setEditingPlan] = React.useState<StudyPlan | null>(null)
  const [itemEditOpen, setItemEditOpen] = React.useState(false)
  const [editingItem, setEditingItem] = React.useState<PlanItem | null>(null)
  const [termDialogOpen, setTermDialogOpen] = React.useState(false)
  const [classDialogOpen, setClassDialogOpen] = React.useState(false)
  const [weekOffset, setWeekOffset] = React.useState(0)

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
    data: plansData,
    isLoading: plansLoading,
  } = useQuery({
    queryKey: ['edu-ai-management', 'study-plan', selectedTermId, selectedClassId, planFilter],
    queryFn: () => {
      let url = `/api/edu-ai-management/study-plan?termId=${selectedTermId}&classId=${selectedClassId}`
      if (planFilter !== 'all') {
        url += `&planType=${planFilter}`
      }
      return api<{ list: StudyPlan[] }>(url)
    },
    enabled: !!selectedTermId && !!selectedClassId,
  })

  const plans = (plansData?.list ?? []).filter((p) => !p.deletedAt).sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  const {
    data: itemsData,
    isLoading: itemsLoading,
  } = useQuery({
    queryKey: ['edu-ai-management', 'study-plan', selectedPlan?.id, 'items'],
    queryFn: () => api<{ list: PlanItem[] }>(`/api/edu-ai-management/study-plan/${selectedPlan!.id}/items`),
    enabled: !!selectedPlan,
  })

  const items = (itemsData?.list ?? []).filter((item) => !item.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder)

  // Calculate week view for weekly plans
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

  const itemsByDay = React.useMemo(() => {
    const map = new Map<string, PlanItem[]>()
    for (const item of items) {
      if (!item.dueDate) {
        const key = 'undated'
        const list = map.get(key) ?? []
        list.push(item)
        map.set(key, list)
        continue
      }
      const key = item.dueDate
      const list = map.get(key) ?? []
      list.push(item)
      map.set(key, list)
    }
    // Sort each list by sortOrder
    for (const [, list] of map) {
      list.sort((a, b) => a.sortOrder - b.sortOrder)
    }
    return map
  }, [items])

  /* ── Mutations ── */
  const invalidate = React.useCallback(
    () => {
      queryClient.invalidateQueries({ queryKey: ['edu-ai-management'] })
    },
    [queryClient],
  )

  const createPlan = useMutation({
    mutationFn: (data: StudyPlanFormData) =>
      api('/api/edu-ai-management/study-plan', {
        method: 'POST',
        body: JSON.stringify({
          title: data.title,
          planType: data.planType,
          classId: data.classId,
          termId: data.termId,
          startDate: data.startDate,
          endDate: data.endDate,
          description: data.description || null,
        }),
      }),
    onSuccess: invalidate,
  })

  const updatePlan = useMutation({
    mutationFn: ({ id, data }: { id: string; data: StudyPlanFormData }) =>
      api(`/api/edu-ai-management/study-plan/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: data.title,
          startDate: data.startDate,
          endDate: data.endDate,
          description: data.description || null,
          status: editingPlan?.status,
        }),
      }),
    onSuccess: (_, vars) => {
      invalidate()
      if (selectedPlan?.id === vars.id) {
        queryClient.invalidateQueries({ queryKey: ['edu-ai-management', 'study-plan', vars.id, 'items'] })
      }
    },
  })

  const deletePlan = useMutation({
    mutationFn: (id: string) =>
      api(`/api/edu-ai-management/study-plan/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate()
      if (selectedPlan && editingPlan?.id === selectedPlan.id) {
        setSelectedPlan(null)
      }
    },
  })

  const autoSplitPlan = useMutation({
    mutationFn: (id: string) =>
      api(`/api/edu-ai-management/study-plan/${id}/auto-split`, { method: 'POST' }),
    onSuccess: invalidate,
  })

  const updatePlanStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PlanStatus }) =>
      api(`/api/edu-ai-management/study-plan/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),
    onSuccess: invalidate,
  })

  const createItem = useMutation({
    mutationFn: (data: PlanItemFormData) =>
      api(`/api/edu-ai-management/study-plan/${selectedPlan!.id}/items`, {
        method: 'POST',
        body: JSON.stringify({
          content: data.content,
          objective: data.objective || null,
          dueDate: data.dueDate || null,
          notes: data.notes || null,
          completed: data.completed,
          sortOrder: items.length,
        }),
      }),
    onSuccess: () => {
      invalidate()
      queryClient.invalidateQueries({ queryKey: ['edu-ai-management', 'study-plan', selectedPlan!.id, 'items'] })
    },
  })

  const updateItem = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PlanItemFormData }) =>
      api(`/api/edu-ai-management/plan-item/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          content: data.content,
          objective: data.objective || null,
          notes: data.notes || null,
          dueDate: data.dueDate || null,
          completed: data.completed,
        }),
      }),
    onSuccess: () => {
      invalidate()
      queryClient.invalidateQueries({ queryKey: ['edu-ai-management', 'study-plan', selectedPlan!.id, 'items'] })
    },
  })

  const deleteItem = useMutation({
    mutationFn: (id: string) =>
      api(`/api/edu-ai-management/plan-item/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate()
      queryClient.invalidateQueries({ queryKey: ['edu-ai-management', 'study-plan', selectedPlan!.id, 'items'] })
    },
  })

  const toggleItemCompleted = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      api(`/api/edu-ai-management/plan-item/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ completed }),
      }),
    onSuccess: () => {
      invalidate()
      queryClient.invalidateQueries({ queryKey: ['edu-ai-management', 'study-plan', selectedPlan!.id, 'items'] })
    },
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

  /* ── Handlers ── */
  const handleAddPlan = () => {
    setEditingPlan(null)
    setPlanEditOpen(true)
  }

  const handleEditPlan = (plan: StudyPlan) => {
    setEditingPlan(plan)
    setPlanEditOpen(true)
  }

  const handleSavePlan = async (data: StudyPlanFormData) => {
    if (editingPlan) {
      await updatePlan.mutateAsync({ id: editingPlan.id, data })
      if (selectedPlan?.id === editingPlan.id) {
        setSelectedPlan({ ...selectedPlan, ...data })
      }
    } else {
      await createPlan.mutateAsync(data)
      // Auto-split if monthly
      if (data.planType === 'monthly') {
        const newPlans = plansData?.list ?? []
        const newPlan = newPlans.find(p => p.title === data.title && !p.deletedAt)
        if (newPlan) {
          await autoSplitPlan.mutateAsync(newPlan.id)
        }
      }
    }
  }

  const handleDeletePlan = async () => {
    if (editingPlan) {
      await deletePlan.mutateAsync(editingPlan.id)
      if (selectedPlan?.id === editingPlan.id) {
        setSelectedPlan(null)
      }
    }
  }

  const handleSelectPlan = (plan: StudyPlan) => {
    setSelectedPlan(plan)
  }

  const handleAutoSplit = async (planId: string) => {
    await autoSplitPlan.mutateAsync(planId)
  }

  const handleCycleStatus = async (plan: StudyPlan) => {
    const statusOrder: PlanStatus[] = ['draft', 'active', 'completed', 'archived']
    const currentIndex = statusOrder.indexOf(plan.status)
    const nextIndex = (currentIndex + 1) % statusOrder.length
    await updatePlanStatus.mutateAsync({ id: plan.id, status: statusOrder[nextIndex]! })
  }

  const handleAddItem = () => {
    setEditingItem(null)
    setItemEditOpen(true)
  }

  const handleEditItem = (item: PlanItem) => {
    setEditingItem(item)
    setItemEditOpen(true)
  }

  const handleSaveItem = async (data: PlanItemFormData) => {
    if (editingItem) {
      await updateItem.mutateAsync({ id: editingItem.id, data })
    } else {
      await createItem.mutateAsync(data)
    }
  }

  const handleDeleteItem = async () => {
    if (editingItem) {
      await deleteItem.mutateAsync(editingItem.id)
    }
  }

  const handleToggleCompleted = async (item: PlanItem) => {
    await toggleItemCompleted.mutateAsync({ id: item.id, completed: !item.completed })
  }

  /* ── Render helpers ─── */
  const formatDate = (d: Date): string => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const isToday = (d: Date): boolean => {
    return formatDate(d) === formatDate(today)
  }

  const completedCount = items.filter(i => i.completed).length
  const totalCount = items.length
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

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
        <h1 className="text-2xl font-bold tracking-tight">学习计划管理</h1>
        <p className="text-xs text-muted-foreground">管理班级的学习计划，支持月计划自动拆解为周计划</p>
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
                setSelectedPlan(null)
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
              onValueChange={(v) => {
                setSelectedClassId(v)
                setSelectedPlan(null)
              }}
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
            <Button variant="outline" size="sm" onClick={() => setClassDialogOpen(true)} disabled={!selectedTermId}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Plan type filter */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select
              value={planFilter}
              onValueChange={(v: PlanType | 'all') => setPlanFilter(v)}
              disabled={!selectedTermId || !selectedClassId}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="筛选类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="monthly">月计划</SelectItem>
                <SelectItem value="weekly">周计划</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Add button */}
          <div className="ml-auto">
            <Button size="sm" onClick={handleAddPlan} disabled={!selectedTermId || !selectedClassId}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              创建计划
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Two-column layout: Plan list on left, Plan detail on right */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Plan List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              计划列表
              {plans.length > 0 && <span className="ml-2 text-xs text-muted-foreground">({plans.length})</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {plansLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                加载中...
              </div>
            ) : plans.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <AlertCircle className="mb-2 h-8 w-8" />
                <p className="text-sm">暂无学习计划</p>
              </div>
            ) : (
              <div className="divide-y">
                {plans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    className={cn(
                      'w-full px-4 py-3 text-left transition-colors hover:bg-accent/50',
                      selectedPlan?.id === plan.id && 'bg-accent',
                    )}
                    onClick={() => handleSelectPlan(plan)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className={cn(
                            'text-sm font-medium truncate',
                            plan.status === 'completed' && 'line-through text-muted-foreground',
                          )}>
                            {plan.title}
                          </p>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge className={cn('px-1.5', PLAN_STATUS_VARIANTS[plan.status])}>
                            {plan.status === 'draft' && '草稿'}
                            {plan.status === 'active' && '进行中'}
                            {plan.status === 'completed' && '已完成'}
                            {plan.status === 'archived' && '已归档'}
                          </Badge>
                          <Badge variant="outline">
                            {PLAN_TYPE_LABELS[plan.planType]}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDateDisplay(plan.startDate)} ~ {formatDateDisplay(plan.endDate)}
                        </p>
                      </div>
                      <ChevronRight className={cn(
                        'h-4 w-4 text-muted-foreground transition-transform',
                        selectedPlan?.id === plan.id && 'rotate-90',
                      )} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plan Detail */}
        <Card className="lg:col-span-2">
          {!selectedPlan ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <AlertCircle className="mb-2 h-8 w-8" />
              <p className="text-sm">请从左侧选择一个学习计划查看详情</p>
            </div>
          ) : (
            <>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base font-medium">{selectedPlan.title}</CardTitle>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge className={cn('px-1.5', PLAN_STATUS_VARIANTS[selectedPlan.status])}>
                        {selectedPlan.status === 'draft' && '草稿'}
                        {selectedPlan.status === 'active' && '进行中'}
                        {selectedPlan.status === 'completed' && '已完成'}
                        {selectedPlan.status === 'archived' && '已归档'}
                      </Badge>
                      <Badge variant="outline">
                        {PLAN_TYPE_LABELS[selectedPlan.planType]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {selectedPlan.startDate} ~ {selectedPlan.endDate}
                      </span>
                    </div>
                    {selectedPlan.description && (
                      <p className="mt-2 text-sm text-muted-foreground">{selectedPlan.description}</p>
                    )}
                    {totalCount > 0 && (
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                        <span className="text-muted-foreground">
                          完成进度: {completedCount}/{totalCount} ({completionRate}%)
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {selectedPlan.planType === 'monthly' && !plans.some(p => p.parentPlanId === selectedPlan.id) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAutoSplit(selectedPlan.id)}
                      >
                        自动拆解周计划
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => handleEditPlan(selectedPlan)}>
                      编辑
                    </Button>
                    <Button size="sm" variant="default" onClick={() => handleCycleStatus(selectedPlan)}>
                      切换状态
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Add item button */}
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">计划条目</h3>
                  <Button size="sm" onClick={handleAddItem}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    添加条目
                  </Button>
                </div>

                {/* Week view for weekly plans */}
                {selectedPlan.planType === 'weekly' && (
                  <div>
                    {/* Week navigation */}
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm font-medium">
                        {weekDays[0] && weekDays[6]
                          ? `${formatDate(weekDays[0])} ~ ${formatDate(weekDays[6])}`
                          : ''}
                      </div>
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
                    </div>

                    {/* Week grid */}
                    {itemsLoading ? (
                      <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        加载中...
                      </div>
                    ) : (
                      <div className="grid grid-cols-7 gap-2">
                        {weekDays.map((day) => {
                          const dateStr = formatDate(day)
                          const dayItems = itemsByDay.get(dateStr) ?? []
                          const dayCompleted = dayItems.filter(i => i.completed).length
                          return (
                            <div
                              key={dateStr}
                              className={cn(
                                'min-h-[120px] rounded-md border p-2',
                                isToday(day) && 'bg-primary/5 border-primary/30',
                              )}
                            >
                              <div className={cn(
                                'mb-2 text-xs font-medium',
                                isToday(day) ? 'text-primary' : 'text-muted-foreground',
                              )}>
                                {['日', '一', '二', '三', '四', '五', '六'][day.getDay()]} {day.getDate()}
                                {dayCompleted > 0 && dayCompleted === dayItems.length && (
                                  <CheckCircle2 className="inline-block ml-1 h-3 w-3 text-green-600" />
                                )}
                              </div>
                              <div className="space-y-1">
                                {dayItems.map((item) => (
                                  <div
                                    key={item.id}
                                    role="button"
                                    tabIndex={0}
                                    className={cn(
                                      'group flex cursor-pointer items-start gap-1 rounded-sm px-2 py-1 text-xs transition-colors hover:bg-accent',
                                      item.completed && 'opacity-50',
                                    )}
                                    onClick={() => handleEditItem(item)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleEditItem(item) }}
                                  >
                                    <GripVertical className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-50" />
                                    <div className="flex-1 min-w-0">
                                      <p className={cn(
                                        'truncate',
                                        item.completed && 'line-through',
                                      )}>
                                        {item.content}
                                      </p>
                                    </div>
                                    <Checkbox
                                      checked={item.completed}
                                      onCheckedChange={() => handleToggleCompleted(item)}
                                      className="h-3 w-3"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* List view for monthly plans / when no weekly view */}
                {(selectedPlan.planType === 'monthly' || items.length > 0) && (
                  <div className="space-y-2">
                    {itemsLoading ? (
                      <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        加载中...
                      </div>
                    ) : items.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <p className="text-sm">暂无计划条目</p>
                      </div>
                    ) : (
                      items.map((item) => (
                        <div
                          key={item.id}
                          className={cn(
                            'flex items-start gap-3 rounded-md border p-3 transition-colors hover:border-accent-foreground/20',
                            item.completed && 'bg-muted/30',
                          )}
                        >
                          <Checkbox
                            checked={item.completed}
                            onCheckedChange={() => handleToggleCompleted(item)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0" role="button" tabIndex={0} onClick={() => handleEditItem(item)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleEditItem(item) }}>
                            <div className="flex items-start justify-between gap-2">
                              <p className={cn(
                                'text-sm font-medium',
                                item.completed && 'line-through text-muted-foreground',
                              )}>
                                {item.content}
                              </p>
                              {item.dueDate && (
                                <Badge variant="outline" className="shrink-0 text-xs">
                                  {formatDateDisplay(item.dueDate)}
                                </Badge>
                              )}
                            </div>
                            {item.objective && (
                              <p className="mt-1 text-sm text-muted-foreground">
                                目标: {item.objective}
                              </p>
                            )}
                            {item.notes && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {item.notes}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleEditItem(item)}
                          >
                            <GripVertical className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </CardContent>
            </>
          )}
        </Card>
      </div>

      {/* Dialogs */}
      <StudyPlanEditDialog
        open={planEditOpen}
        onOpenChange={setPlanEditOpen}
        initial={editingPlan}
        selectedTermId={selectedTermId}
        selectedClassId={selectedClassId}
        terms={terms}
        classes={classes}
        onSave={handleSavePlan}
        onDelete={editingPlan ? handleDeletePlan : undefined}
      />

      <PlanItemEditDialog
        open={itemEditOpen}
        onOpenChange={setItemEditOpen}
        initial={editingItem}
        onSave={handleSaveItem}
        onDelete={editingItem ? handleDeleteItem : undefined}
      />

      <TermDialog
        open={termDialogOpen}
        onOpenChange={setTermDialogOpen}
        terms={terms}
        onSave={async (data) => {
          await saveTerm.mutateAsync(data)
        }}
      />

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
