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
  List,
  ClipboardList,
  Check,
  Sun,
  SunMoon,
  Moon,
  Apple,
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

interface MealRecipe {
  id: string
  date: string
  mealType: string
  dishName: string
  ingredients: string | null
  nutrition: string | null
  imageUrl: string | null
  notes: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

interface MealTemplate {
  id: string
  name: string
  weekday: number
  mealType: string
  dishName: string
  ingredients: string | null
  nutrition: string | null
  notes: string | null
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

const MEAL_TYPES = [
  { value: 'breakfast', label: '早餐' },
  { value: 'lunch', label: '午餐' },
  { value: 'dinner', label: '晚餐' },
  { value: 'snack', label: '加餐' },
] as const

const MEAL_TYPE_MAP = new Map(MEAL_TYPES.map((m) => [m.value, m.label]))

const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

const MEAL_COLORS = {
  breakfast: 'bg-blue-500',
  lunch: 'bg-green-500',
  dinner: 'bg-purple-500',
  snack: 'bg-orange-500',
} as const

const MEAL_ICONS = {
  breakfast: Sun,
  lunch: SunMoon,
  dinner: Moon,
  snack: Apple,
} as const

/* ─── Helpers ─── */

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getMonthFirstWeekday(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

/* ─── Meal Edit Dialog ─── */

interface MealFormData {
  date: string
  mealType: string
  dishName: string
  ingredients: string
  nutrition: string
  imageUrl: string
  notes: string
}

const emptyMealForm: MealFormData = {
  date: '',
  mealType: 'breakfast',
  dishName: '',
  ingredients: '',
  nutrition: '',
  imageUrl: '',
  notes: '',
}

function MealEditDialog({
  open,
  onOpenChange,
  initial,
  defaultDate,
  defaultMealType,
  onSave,
  onDelete,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial: MealRecipe | null
  defaultDate?: string
  defaultMealType?: string
  onSave: (data: MealFormData) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [form, setForm] = React.useState<MealFormData>(emptyMealForm)
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  React.useEffect(() => {
    if (initial) {
      setForm({
        date: initial.date,
        mealType: initial.mealType,
        dishName: initial.dishName,
        ingredients: initial.ingredients ?? '',
        nutrition: initial.nutrition ?? '',
        imageUrl: initial.imageUrl ?? '',
        notes: initial.notes ?? '',
      })
    } else {
      setForm({
        ...emptyMealForm,
        date: defaultDate ?? '',
        mealType: defaultMealType ?? 'breakfast',
      })
    }
  }, [initial, defaultDate, defaultMealType, open])

  const update = (key: keyof MealFormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!form.dishName.trim() || !form.date) return
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
          <DialogTitle>{initial ? '编辑菜谱' : '添加菜谱'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>日期</Label>
              <Input type="date" value={form.date} onChange={(e) => update('date', e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>餐类型</Label>
              <Select value={form.mealType} onValueChange={(v) => update('mealType', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEAL_TYPES.map((mt) => (
                    <SelectItem key={mt.value} value={mt.value}>
                      {mt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>菜品名</Label>
            <Input
              value={form.dishName}
              onChange={(e) => update('dishName', e.target.value)}
              placeholder="例如：红烧排骨"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>配料</Label>
            <Input
              value={form.ingredients}
              onChange={(e) => update('ingredients', e.target.value)}
              placeholder="例如：排骨500g, 姜, 蒜"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>营养信息</Label>
            <Input
              value={form.nutrition}
              onChange={(e) => update('nutrition', e.target.value)}
              placeholder="例如：热量450kcal, 蛋白质25g"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>图片URL</Label>
            <Input
              value={form.imageUrl}
              onChange={(e) => update('imageUrl', e.target.value)}
              placeholder="可选，图片链接"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>备注</Label>
            <Input
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="可选，备注信息"
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
          <Button onClick={handleSave} disabled={saving || !form.dishName.trim() || !form.date}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {initial ? '保存' : '添加'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Template Dialog ─── */

interface TemplateEntryForm {
  weekday: number
  mealType: string
  dishName: string
  ingredients: string
  nutrition: string
  notes: string
}

function TemplateDialog({
  open,
  onOpenChange,
  templates,
  templateNames,
  onSaveTemplate,
  onDeleteTemplate,
  onApplyTemplate,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  templates: MealTemplate[]
  templateNames: string[]
  onSaveTemplate: (name: string, entries: TemplateEntryForm[]) => Promise<void>
  onDeleteTemplate: (name: string) => Promise<void>
  onApplyTemplate: (name: string, startDate: string) => Promise<void>
}) {
  const [mode, setMode] = React.useState<'list' | 'create' | 'apply'>('list')
  const [templateName, setTemplateName] = React.useState('')
  const [selectedTemplate, setSelectedTemplate] = React.useState('')
  const [applyStartDate, setApplyStartDate] = React.useState('')
  const [templateEntries, setTemplateEntries] = React.useState<TemplateEntryForm[]>([])
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState('')
  const [applying, setApplying] = React.useState(false)

  const today = React.useMemo(() => new Date(), [])
  const defaultStartDate = formatDate(getMonday(today))

  React.useEffect(() => {
    if (open) {
      setMode('list')
      setTemplateName('')
      setSelectedTemplate('')
      setApplyStartDate(defaultStartDate)
    }
  }, [open, defaultStartDate])

  // Initialize template entries (7 days × 4 meals)
  const initEntries = React.useCallback(() => {
    const entries: TemplateEntryForm[] = []
    for (let w = 1; w <= 7; w++) {
      for (const mt of MEAL_TYPES) {
        entries.push({
          weekday: w,
          mealType: mt.value,
          dishName: '',
          ingredients: '',
          nutrition: '',
          notes: '',
        })
      }
    }
    return entries
  }, [])

  const handleStartCreate = () => {
    setTemplateName('')
    setTemplateEntries(initEntries())
    setMode('create')
  }

  const handleEditTemplate = (name: string) => {
    const nameEntries = templates.filter((t) => t.name === name)
    const entries = initEntries()
    for (const ne of nameEntries) {
      const idx = entries.findIndex(
        (e) => e.weekday === ne.weekday && e.mealType === ne.mealType,
      )
      if (idx >= 0) {
        entries[idx] = {
          weekday: ne.weekday,
          mealType: ne.mealType,
          dishName: ne.dishName,
          ingredients: ne.ingredients ?? '',
          nutrition: ne.nutrition ?? '',
          notes: ne.notes ?? '',
        }
      }
    }
    setTemplateName(name)
    setTemplateEntries(entries)
    setMode('create')
  }

  const updateEntry = (weekday: number, mealType: string, key: keyof TemplateEntryForm, value: string) => {
    setTemplateEntries((prev) =>
      prev.map((e) => (e.weekday === weekday && e.mealType === mealType ? { ...e, [key]: value } : e)),
    )
  }

  const handleSave = async () => {
    if (!templateName.trim()) return
    setSaving(true)
    try {
      await onSaveTemplate(templateName.trim(), templateEntries)
      setMode('list')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (name: string) => {
    setDeleting(name)
    try {
      await onDeleteTemplate(name)
    } finally {
      setDeleting('')
    }
  }

  const handleApply = async () => {
    if (!selectedTemplate || !applyStartDate) return
    setApplying(true)
    try {
      await onApplyTemplate(selectedTemplate, applyStartDate)
      setMode('list')
    } finally {
      setApplying(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create'
              ? templateName
                ? `编辑模板：${templateName}`
                : '新建模板'
              : mode === 'apply'
                ? '应用模板'
                : '模板管理'}
          </DialogTitle>
        </DialogHeader>

        {mode === 'list' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleStartCreate}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                新建模板
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedTemplate('')
                  setApplyStartDate(defaultStartDate)
                  setMode('apply')
                }}
                disabled={templateNames.length === 0}
              >
                <ClipboardList className="mr-1 h-3.5 w-3.5" />
                应用模板
              </Button>
            </div>

            {templateNames.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">暂无模板</p>
            ) : (
              <div className="space-y-1">
                {templateNames.map((name) => {
                  const count = templates.filter((t) => t.name === name).length
                  return (
                    <div
                      key={name}
                      className="flex items-center justify-between rounded-md border px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{name}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {count} 项
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditTemplate(name)}
                        >
                          编辑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(name)}
                          disabled={deleting === name}
                        >
                          {deleting === name ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {mode === 'create' && (
          <div className="space-y-4">
            <div className="grid gap-1.5">
              <Label>模板名称</Label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="例如：一周健康食谱"
              />
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                {/* Header row */}
                <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-0">
                  <div className="p-1.5 text-xs font-medium text-muted-foreground" />
                  {WEEKDAY_LABELS.map((label) => (
                    <div
                      key={label}
                      className="border-b p-1.5 text-center text-xs font-medium"
                    >
                      {label}
                    </div>
                  ))}
                </div>

                {/* Meal type rows */}
                {MEAL_TYPES.map((mt) => (
                  <div key={mt.value} className="grid grid-cols-[60px_repeat(7,1fr)] gap-0">
                    <div className="flex items-center gap-1 border-b p-1.5 text-xs font-medium text-muted-foreground">
                      {mt.label}
                    </div>
                    {Array.from({ length: 7 }, (_, i) => {
                      const weekday = i + 1
                      const entry = templateEntries.find(
                        (e) => e.weekday === weekday && e.mealType === mt.value,
                      )
                      return (
                        <div
                          key={`${weekday}-${mt.value}`}
                          className="min-h-[60px] border-b border-r p-1"
                        >
                          <Input
                            className="h-7 text-xs"
                            placeholder="菜品名"
                            value={entry?.dishName ?? ''}
                            onChange={(e) =>
                              updateEntry(weekday, mt.value, 'dishName', e.target.value)
                            }
                          />
                          {entry?.dishName && (
                            <div className="mt-0.5 space-y-0.5">
                              <Input
                                className="h-6 text-[10px]"
                                placeholder="配料"
                                value={entry.ingredients}
                                onChange={(e) =>
                                  updateEntry(weekday, mt.value, 'ingredients', e.target.value)
                                }
                              />
                              <Input
                                className="h-6 text-[10px]"
                                placeholder="营养"
                                value={entry.nutrition}
                                onChange={(e) =>
                                  updateEntry(weekday, mt.value, 'nutrition', e.target.value)
                                }
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setMode('list')}>
                取消
              </Button>
              <Button onClick={handleSave} disabled={saving || !templateName.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                保存模板
              </Button>
            </DialogFooter>
          </div>
        )}

        {mode === 'apply' && (
          <div className="space-y-4">
            <div className="grid gap-1.5">
              <Label>选择模板</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="选择模板" />
                </SelectTrigger>
                <SelectContent>
                  {templateNames.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>起始日期（周一）</Label>
              <Input
                type="date"
                value={applyStartDate}
                onChange={(e) => setApplyStartDate(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMode('list')}>
                取消
              </Button>
              <Button
                onClick={handleApply}
                disabled={applying || !selectedTemplate || !applyStartDate}
              >
                {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
                应用
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ─── Main Page ─── */

export default function MealPage() {
  const queryClient = useQueryClient()

  /* ── State ── */
  const [viewMode, setViewMode] = React.useState<'day' | 'week' | 'month'>('week')
  const [dayOffset, setDayOffset] = React.useState(0)
  const [weekOffset, setWeekOffset] = React.useState(0)
  const [monthOffset, setMonthOffset] = React.useState(0)
  const [mealEditOpen, setMealEditOpen] = React.useState(false)
  const [editingMeal, setEditingMeal] = React.useState<MealRecipe | null>(null)
  const [editDefaultDate, setEditDefaultDate] = React.useState('')
  const [editDefaultMealType, setEditDefaultMealType] = React.useState('')
  const [templateDialogOpen, setTemplateDialogOpen] = React.useState(false)

  /* ── Date helpers ── */
  const today = React.useMemo(() => new Date(), [])

  const currentDay = React.useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + dayOffset)
    return d
  }, [today, dayOffset])

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
    for (let i = 0; i < firstWeekday; i++) {
      cells.push({ day: null, date: null })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d)
      cells.push({ day: d, date })
    }
    return cells
  }, [currentMonth])

  /* ── Date range for API ── */
  const dateRange = React.useMemo(() => {
    if (viewMode === 'day') {
      const d = formatDate(currentDay)
      return { startDate: d, endDate: d }
    }
    if (viewMode === 'week') {
      return {
        startDate: formatDate(weekDays[0]!),
        endDate: formatDate(weekDays[6]!),
      }
    }
    // month
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const lastDay = getDaysInMonth(year, month)
    return {
      startDate: `${year}-${String(month + 1).padStart(2, '0')}-01`,
      endDate: `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    }
  }, [viewMode, currentDay, weekDays, currentMonth])

  /* ── Queries ── */
  const {
    data: mealsData,
    isLoading: mealsLoading,
    error: mealsError,
  } = useQuery({
    queryKey: ['edu-ai-management', 'meal', dateRange.startDate, dateRange.endDate],
    queryFn: () =>
      api<{ list: MealRecipe[] }>(
        `/api/edu-ai-management/meal?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
      ),
  })

  const meals = (mealsData?.list ?? []).filter((m) => !m.deletedAt)

  const {
    data: templatesData,
  } = useQuery({
    queryKey: ['edu-ai-management', 'meal', 'template'],
    queryFn: () => api<{ list: MealTemplate[] }>('/api/edu-ai-management/meal/template'),
  })

  const templates = templatesData?.list ?? []

  const {
    data: templateNamesData,
  } = useQuery({
    queryKey: ['edu-ai-management', 'meal', 'template-names'],
    queryFn: () => api<{ list: string[] }>('/api/edu-ai-management/meal/template-names'),
  })

  const templateNames = templateNamesData?.list ?? []

  /* ── Mutations ── */
  const invalidate = React.useCallback(
    () => {
      queryClient.invalidateQueries({ queryKey: ['edu-ai-management', 'meal'] })
    },
    [queryClient],
  )

  const createMeal = useMutation({
    mutationFn: (data: MealFormData) =>
      api('/api/edu-ai-management/meal', {
        method: 'POST',
        body: JSON.stringify({
          date: data.date,
          mealType: data.mealType,
          dishName: data.dishName,
          ingredients: data.ingredients || null,
          nutrition: data.nutrition || null,
          imageUrl: data.imageUrl || null,
          notes: data.notes || null,
        }),
      }),
    onSuccess: invalidate,
  })

  const updateMeal = useMutation({
    mutationFn: ({ id, data }: { id: string; data: MealFormData }) =>
      api(`/api/edu-ai-management/meal/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          date: data.date,
          mealType: data.mealType,
          dishName: data.dishName,
          ingredients: data.ingredients || null,
          nutrition: data.nutrition || null,
          imageUrl: data.imageUrl || null,
          notes: data.notes || null,
        }),
      }),
    onSuccess: invalidate,
  })

  const deleteMeal = useMutation({
    mutationFn: (id: string) =>
      api(`/api/edu-ai-management/meal/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })

  const saveTemplate = useMutation({
    mutationFn: ({ name, entries }: { name: string; entries: TemplateEntryForm[] }) => {
      // Delete existing entries with same name, then create new ones
      const existingIds = templates.filter((t) => t.name === name).map((t) => t.id)
      const deletePromises = existingIds.map((id) =>
        api(`/api/edu-ai-management/meal/template/${id}`, { method: 'DELETE' }),
      )
      const filledEntries = entries.filter((e) => e.dishName.trim())
      const createPromises = filledEntries.map((e) =>
        api('/api/edu-ai-management/meal/template', {
          method: 'POST',
          body: JSON.stringify({
            name,
            weekday: e.weekday,
            mealType: e.mealType,
            dishName: e.dishName,
            ingredients: e.ingredients || null,
            nutrition: e.nutrition || null,
          }),
        }),
      )
      return Promise.all([...deletePromises, ...createPromises])
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['edu-ai-management', 'meal', 'template'] })
      queryClient.invalidateQueries({ queryKey: ['edu-ai-management', 'meal', 'template-names'] })
    },
  })

  const deleteTemplateMutation = useMutation({
    mutationFn: (name: string) => {
      const ids = templates.filter((t) => t.name === name).map((t) => t.id)
      return Promise.all(
        ids.map((id) =>
          api(`/api/edu-ai-management/meal/template/${id}`, { method: 'DELETE' }),
        ),
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['edu-ai-management', 'meal', 'template'] })
      queryClient.invalidateQueries({ queryKey: ['edu-ai-management', 'meal', 'template-names'] })
    },
  })

  const applyTemplateMutation = useMutation({
    mutationFn: ({ name, startDate }: { name: string; startDate: string }) =>
      api('/api/edu-ai-management/meal/apply-template', {
        method: 'POST',
        body: JSON.stringify({ name, startDate }),
      }),
    onSuccess: invalidate,
  })

  /* ── Group meals by date for day view ── */
  const mealsByDateAndType = React.useMemo(() => {
    const map = new Map<string, Map<string, MealRecipe[]>>()
    for (const meal of meals) {
      const byDate = map.get(meal.date) ?? new Map()
      const byType = byDate.get(meal.mealType) ?? []
      byType.push(meal)
      byDate.set(meal.mealType, byType)
      map.set(meal.date, byDate)
    }
    return map
  }, [meals])

  /* ── Edit handlers ── */
  const handleAddMeal = (date: string, mealType: string) => {
    setEditingMeal(null)
    setEditDefaultDate(date)
    setEditDefaultMealType(mealType)
    setMealEditOpen(true)
  }

  const handleEditMeal = (meal: MealRecipe) => {
    setEditingMeal(meal)
    setEditDefaultDate(meal.date)
    setEditDefaultMealType(meal.mealType)
    setMealEditOpen(true)
  }

  const handleSaveMeal = async (data: MealFormData) => {
    if (editingMeal) {
      await updateMeal.mutateAsync({ id: editingMeal.id, data })
    } else {
      await createMeal.mutateAsync(data)
    }
  }

  const handleDeleteMeal = async () => {
    if (editingMeal) {
      await deleteMeal.mutateAsync(editingMeal.id)
    }
  }

  /* ── Render helpers ── */
  const renderMealCard = (meal: MealRecipe) => {
    const color = MEAL_COLORS[meal.mealType as keyof typeof MEAL_COLORS] ?? 'bg-gray-500'
    return (
      <button
        key={meal.id}
        type="button"
        className={cn(
          'w-full rounded-md px-2 py-1 text-left text-xs text-white transition-opacity hover:opacity-90',
          color,
        )}
        onClick={() => handleEditMeal(meal)}
      >
        <div className="truncate font-medium">{meal.dishName}</div>
        {meal.ingredients && (
          <div className="truncate opacity-80">{meal.ingredients}</div>
        )}
      </button>
    )
  }

  const renderMealTypeSection = (date: string, mealType: string) => {
    const mealsForType = mealsByDateAndType.get(date)?.get(mealType) ?? []
    const mtLabel = MEAL_TYPE_MAP.get(mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack') ?? mealType
    const Icon = MEAL_ICONS[mealType as keyof typeof MEAL_ICONS]

    return (
      <div key={mealType} className="rounded-md border p-2">
        <div className="mb-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
            <span className="text-xs font-medium">{mtLabel}</span>
          </div>
          <button
            type="button"
            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent"
            onClick={() => handleAddMeal(date, mealType)}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        {mealsForType.length === 0 ? (
          <p className="py-2 text-center text-[10px] text-muted-foreground">暂无菜谱</p>
        ) : (
          <div className="space-y-1">
            {mealsForType.map((m) => renderMealCard(m))}
          </div>
        )}
      </div>
    )
  }

  const renderMealDots = (date: string) => {
    const byDate = mealsByDateAndType.get(date)
    if (!byDate) return null
    const types = Array.from(byDate.keys())
    return (
      <div className="mt-1 flex flex-wrap gap-1">
        {types.map((t) => (
          <span
            key={t}
            className={cn('inline-block h-2 w-2 rounded-sm', MEAL_COLORS[t as keyof typeof MEAL_COLORS] ?? 'bg-gray-500')}
            title={MEAL_TYPE_MAP.get(t as 'breakfast' | 'lunch' | 'dinner' | 'snack') ?? t}
          />
        ))}
      </div>
    )
  }

  /* ── Loading / Error states ── */
  if (mealsError) {
    return (
      <div className="space-y-4 px-4 py-6">
        <BackButton />
        <Alert variant="danger" description="加载菜谱数据失败，请稍后重试" />
      </div>
    )
  }

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />

      {/* Header */}
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">菜谱管理</h1>
        <p className="text-xs text-muted-foreground">管理每日菜谱，支持日/周/月视图</p>
      </header>

      {/* Toolbar */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          {/* View toggle */}
          <div className="flex items-center gap-1 rounded-md border p-0.5">
            <Button
              variant={viewMode === 'day' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('day')}
            >
              <Calendar className="mr-1 h-3.5 w-3.5" />
              日
            </Button>
            <Button
              variant={viewMode === 'week' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('week')}
            >
              <CalendarDays className="mr-1 h-3.5 w-3.5" />
              周
            </Button>
            <Button
              variant={viewMode === 'month' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('month')}
            >
              <List className="mr-1 h-3.5 w-3.5" />
              月
            </Button>
          </div>

          {/* Template button */}
          <Button variant="outline" size="sm" onClick={() => setTemplateDialogOpen(true)}>
            <ClipboardList className="mr-1 h-3.5 w-3.5" />
            模板管理
          </Button>

          {/* Loading indicator */}
          {mealsLoading && (
            <div className="ml-auto flex items-center text-xs text-muted-foreground">
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              加载中...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Meal content */}
      <Card>
        {viewMode === 'day' ? (
          <>
            {/* Day navigation */}
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {formatDate(currentDay)}
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setDayOffset((o) => o - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDayOffset(0)}
                  disabled={dayOffset === 0}
                >
                  今天
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDayOffset((o) => o + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              {mealsLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  加载菜谱...
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {MEAL_TYPES.map((mt) =>
                    renderMealTypeSection(formatDate(currentDay), mt.value),
                  )}
                </div>
              )}
            </CardContent>
          </>
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
              {mealsLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  加载菜谱...
                </div>
              ) : (
                <div className="min-w-[600px]">
                  {/* Header row */}
                  <div className="grid grid-cols-[60px_repeat(7,1fr)]">
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
                  </div>

                  {/* Meal type rows */}
                  {MEAL_TYPES.map((mt) => {
                    const Icon = MEAL_ICONS[mt.value]
                    return (
                      <div key={mt.value} className="grid grid-cols-[60px_repeat(7,1fr)]">
                        <div className="flex items-center gap-1 border-b bg-background p-2 text-xs font-medium text-muted-foreground">
                          {Icon && <Icon className="h-3 w-3" />}
                          <span>{mt.label}</span>
                        </div>
                        {Array.from({ length: 7 }, (_, i) => {
                          const weekday = i + 1
                          const d = weekDays[i]
                          const dateStr = d ? formatDate(d) : ''
                          const mealsForCell = mealsByDateAndType.get(dateStr)?.get(mt.value) ?? []
                          return (
                            <div
                              key={`${weekday}-${mt.value}`}
                              className={cn(
                                'min-h-[70px] border-b border-r p-1 transition-colors hover:bg-accent/30',
                              )}
                            >
                              <div className="flex items-center justify-end">
                                <button
                                  type="button"
                                  className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100 hover:opacity-100"
                                  onClick={() => handleAddMeal(dateStr, mt.value)}
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                              {mealsForCell.length > 0 && (
                                <div className="space-y-1">
                                  {mealsForCell.map((m) => renderMealCard(m))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )}
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
              {mealsLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  加载菜谱...
                </div>
              ) : (
                <div className="min-w-[600px]">
                  <div className="grid grid-cols-7">
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
                        return (
                          <div
                            key={`empty-${i}`}
                            className="border-b border-r bg-muted/20"
                          />
                        )
                      }
                      const isToday = formatDate(cell.date) === formatDate(today)
                      const dateStr = formatDate(cell.date)
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
                          {renderMealDots(dateStr)}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </>
        )}
      </Card>

      {/* Meal Edit Dialog */}
      <MealEditDialog
        open={mealEditOpen}
        onOpenChange={setMealEditOpen}
        initial={editingMeal}
        defaultDate={editDefaultDate}
        defaultMealType={editDefaultMealType}
        onSave={handleSaveMeal}
        onDelete={editingMeal ? handleDeleteMeal : undefined}
      />

      {/* Template Dialog */}
      <TemplateDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        templates={templates}
        templateNames={templateNames}
        onSaveTemplate={async (name, entries) => {
          await saveTemplate.mutateAsync({ name, entries })
        }}
        onDeleteTemplate={async (name) => {
          await deleteTemplateMutation.mutateAsync(name)
        }}
        onApplyTemplate={async (name, startDate) => {
          await applyTemplateMutation.mutateAsync({ name, startDate })
        }}
      />
    </div>
  )
}