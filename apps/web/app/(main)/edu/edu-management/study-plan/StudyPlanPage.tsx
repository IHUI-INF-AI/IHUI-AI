'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

import { BackButton } from '@/components/common'
import { Alert } from '@/components/feedback'
import {
  api,
  type Term,
  type EduClass,
  type StudyPlan,
  type PlanItem,
  type PlanType,
  type PlanStatus,
  type CompletionStatsResponse,
  type ProgressTimelineResponse,
  type StudyPlanFormData,
  getMonday,
} from './types'
import { StudyPlanToolbar } from './StudyPlanToolbar'
import { StudyPlanList } from './StudyPlanList'
import { StudyPlanDetail } from './StudyPlanDetail'
import { StudyPlanStatsDialog } from './StudyPlanStatsDialog'
import { StudyPlanTimelineDialog } from './StudyPlanTimelineDialog'
import { StudyPlanEditDialog } from './StudyPlanEditDialog'
import { PlanItemEditDialog } from './PlanItemEditDialog'
import { TermDialog } from './TermDialog'
import { ClassDialog } from './ClassDialog'

export default function StudyPlanPage() {
  const queryClient = useQueryClient()

  /* ── State ── */
  const [selectedTermId, setSelectedTermId] = React.useState('')
  const [selectedClassId, setSelectedClassId] = React.useState('')
  const [planFilter, setPlanFilter] = React.useState<PlanType | 'all'>('all')
  const [statusFilter, setStatusFilter] = React.useState<PlanStatus | 'all'>('all')
  const [selectedPlan, setSelectedPlan] = React.useState<StudyPlan | null>(null)
  const [planEditOpen, setPlanEditOpen] = React.useState(false)
  const [editingPlan, setEditingPlan] = React.useState<StudyPlan | null>(null)
  const [itemEditOpen, setItemEditOpen] = React.useState(false)
  const [editingItem, setEditingItem] = React.useState<PlanItem | null>(null)
  const [editingItemParentId, setEditingItemParentId] = React.useState<string | null>(null)
  const [termDialogOpen, setTermDialogOpen] = React.useState(false)
  const [classDialogOpen, setClassDialogOpen] = React.useState(false)
  const [weekOffset, setWeekOffset] = React.useState(0)
  const [isStudentMode, setIsStudentMode] = React.useState(false)

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

  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: ['edu-ai-management', 'class', selectedTermId],
    queryFn: () =>
      api<{ list: EduClass[] }>(`/api/edu-ai-management/class?termId=${selectedTermId}`),
    enabled: !!selectedTermId,
  })

  const classes = React.useMemo(() => classesData?.list ?? [], [classesData])

  // Auto-select first class
  React.useEffect(() => {
    if (classes.length > 0 && !selectedClassId) {
      setSelectedClassId(classes[0]!.id)
    }
  }, [classes, selectedClassId])

  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: [
      'edu-ai-management',
      'study-plan',
      selectedTermId,
      selectedClassId,
      planFilter,
      statusFilter,
    ],
    queryFn: () => {
      let url = `/api/edu-ai-management/study-plan?termId=${selectedTermId}&classId=${selectedClassId}`
      if (planFilter !== 'all') {
        url += `&planType=${planFilter}`
      }
      if (statusFilter !== 'all') {
        url += `&status=${statusFilter}`
      }
      return api<{ list: StudyPlan[] }>(url)
    },
    enabled: !!selectedTermId && !!selectedClassId,
  })

  const allPlans = (plansData?.list ?? []).filter((p) => !p.deletedAt)

  // Parent plans (non-child plans) sorted by creation date desc
  const parentPlans = React.useMemo(
    () =>
      allPlans
        .filter((p) => !p.parentPlanId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [allPlans],
  )

  // Child plans keyed by parentPlanId
  const childPlansByParent = React.useMemo(() => {
    const map = new Map<string, StudyPlan[]>()
    for (const p of allPlans) {
      if (p.parentPlanId) {
        const list = map.get(p.parentPlanId) ?? []
        list.push(p)
        map.set(p.parentPlanId, list)
      }
    }
    // Sort child plans by startDate
    for (const [, list] of map) {
      list.sort((a, b) => a.startDate.localeCompare(b.startDate))
    }
    return map
  }, [allPlans])

  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ['edu-ai-management', 'study-plan', selectedPlan?.id, 'items'],
    queryFn: () =>
      api<{ list: PlanItem[] }>(`/api/edu-ai-management/study-plan/${selectedPlan!.id}/items`),
    enabled: !!selectedPlan,
  })

  const allItems = (itemsData?.list ?? []).filter((item) => !item.deletedAt)

  // Parent items (no parentItemId) sorted by sortOrder
  const parentItems = React.useMemo(
    () => allItems.filter((item) => !item.parentItemId).sort((a, b) => a.sortOrder - b.sortOrder),
    [allItems],
  )

  // Child items keyed by parentItemId
  const childItemsByParent = React.useMemo(() => {
    const map = new Map<string, PlanItem[]>()
    for (const item of allItems) {
      if (item.parentItemId) {
        const list = map.get(item.parentItemId) ?? []
        list.push(item)
        map.set(item.parentItemId, list)
      }
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.sortOrder - b.sortOrder)
    }
    return map
  }, [allItems])

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
    for (const item of allItems) {
      const key = item.dueDate ?? 'undated'
      const list = map.get(key) ?? []
      list.push(item)
      map.set(key, list)
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.sortOrder - b.sortOrder)
    }
    return map
  }, [allItems])

  /* ── Mutations ── */
  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['edu-ai-management'] })
  }, [queryClient])

  const createPlan = useMutation({
    mutationFn: (data: {
      title: string
      planType: PlanType
      classId: string
      termId: string
      startDate: string
      endDate: string
      description: string
    }) =>
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
    mutationFn: ({ id, data }: { id: string; data: Partial<StudyPlanFormData> }) =>
      api(`/api/edu-ai-management/study-plan/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, vars) => {
      invalidate()
      if (selectedPlan?.id === vars.id) {
        queryClient.invalidateQueries({
          queryKey: ['edu-ai-management', 'study-plan', vars.id, 'items'],
        })
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
      api<{ count: number; plans: StudyPlan[] }>(
        `/api/edu-ai-management/study-plan/${id}/auto-split`,
        { method: 'POST' },
      ),
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
    mutationFn: (data: {
      content: string
      objective?: string | null
      dueDate?: string | null
      notes?: string | null
      parentItemId?: string | null
    }) =>
      api(`/api/edu-ai-management/study-plan/${selectedPlan!.id}/items`, {
        method: 'POST',
        body: JSON.stringify({
          content: data.content,
          objective: data.objective ?? null,
          dueDate: data.dueDate ?? null,
          notes: data.notes ?? null,
          parentItemId: data.parentItemId ?? null,
          sortOrder: allItems.length,
        }),
      }),
    onSuccess: () => {
      invalidate()
      queryClient.invalidateQueries({
        queryKey: ['edu-ai-management', 'study-plan', selectedPlan!.id, 'items'],
      })
    },
  })

  const updateItem = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api(`/api/edu-ai-management/plan-item/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      invalidate()
      queryClient.invalidateQueries({
        queryKey: ['edu-ai-management', 'study-plan', selectedPlan!.id, 'items'],
      })
    },
  })

  const deleteItem = useMutation({
    mutationFn: (id: string) => api(`/api/edu-ai-management/plan-item/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate()
      queryClient.invalidateQueries({
        queryKey: ['edu-ai-management', 'study-plan', selectedPlan!.id, 'items'],
      })
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
      queryClient.invalidateQueries({
        queryKey: ['edu-ai-management', 'study-plan', selectedPlan!.id, 'items'],
      })
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

  const handleSavePlan = async (data: {
    title: string
    planType: PlanType
    classId: string
    termId: string
    startDate: string
    endDate: string
    description: string
  }) => {
    if (editingPlan) {
      await updatePlan.mutateAsync({
        id: editingPlan.id,
        data: {
          title: data.title,
          startDate: data.startDate,
          endDate: data.endDate,
          description: data.description ?? undefined,
        },
      })
      if (selectedPlan?.id === editingPlan.id) {
        setSelectedPlan({ ...selectedPlan, ...data })
      }
    } else {
      await createPlan.mutateAsync(data)
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
    setWeekOffset(0)
  }

  const handleAutoSplit = async (planId: string) => {
    await autoSplitPlan.mutateAsync(planId)
  }

  const handleAddItem = () => {
    setEditingItem(null)
    setEditingItemParentId(null)
    setItemEditOpen(true)
  }

  const handleEditItem = (item: PlanItem) => {
    setEditingItem(item)
    setEditingItemParentId(null)
    setItemEditOpen(true)
  }

  const handleAddSubItem = (parentItemId: string) => {
    setEditingItem(null)
    setEditingItemParentId(parentItemId)
    setItemEditOpen(true)
  }

  const handleSaveItem = async (data: {
    content: string
    objective: string
    dueDate: string
    notes: string
    completed: boolean
  }) => {
    if (editingItem) {
      const updateData: Record<string, unknown> = {}
      // In student mode, only allow editing notes and completion
      if (isStudentMode) {
        updateData.notes = data.notes
        updateData.completed = data.completed
      } else {
        updateData.content = data.content
        updateData.objective = data.objective || null
        updateData.notes = data.notes || null
        updateData.dueDate = data.dueDate || null
        updateData.completed = data.completed
      }
      await updateItem.mutateAsync({ id: editingItem.id, data: updateData })
    } else {
      await createItem.mutateAsync({
        content: data.content,
        objective: data.objective || null,
        dueDate: data.dueDate || null,
        notes: data.notes || null,
        parentItemId: editingItemParentId,
      })
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

  const handleDeleteParentItem = (item: PlanItem) => {
    setEditingItem(item)
    setEditingItemParentId(null)
    void deleteItem.mutateAsync(item.id)
  }

  const handleDeleteChildItem = (id: string) => {
    void deleteItem.mutateAsync(id)
  }

  const handleEditChildItem = (child: PlanItem) => {
    setEditingItem(child)
    setEditingItemParentId(child.parentItemId)
    setItemEditOpen(true)
  }

  /* ── Completion stats & Progress timeline ── */
  const [statsOpen, setStatsOpen] = React.useState(false)
  const [timelineOpen, setTimelineOpen] = React.useState(false)

  const completionStatsQuery = useQuery({
    queryKey: [
      'edu-ai-management',
      'study-plan',
      'completion-stats',
      selectedClassId,
      selectedTermId,
    ],
    queryFn: () =>
      api<CompletionStatsResponse>(
        `/api/edu-ai-management/study-plan/completion-stats?classId=${selectedClassId}&termId=${selectedTermId}`,
      ),
    enabled: !!selectedClassId && !!selectedTermId,
  })

  const progressTimelineQuery = useQuery({
    queryKey: ['edu-ai-management', 'study-plan', 'progress-timeline', selectedPlan?.id],
    queryFn: () =>
      api<ProgressTimelineResponse>(
        `/api/edu-ai-management/study-plan/progress-timeline?planId=${selectedPlan!.id}`,
      ),
    enabled: false,
  })

  /* ── Computed values ── */
  const completedCount = parentItems.filter((i) => i.completed).length
  const totalCount = parentItems.length
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
        <p className="text-xs text-muted-foreground">
          管理班级的学习计划，支持月计划自动拆解为周计划
        </p>
      </header>

      <StudyPlanToolbar
        terms={terms}
        classes={classes}
        classesLoading={classesLoading}
        selectedTermId={selectedTermId}
        selectedClassId={selectedClassId}
        planFilter={planFilter}
        statusFilter={statusFilter}
        onTermChange={(v) => {
          setSelectedTermId(v)
          setSelectedClassId('')
          setSelectedPlan(null)
        }}
        onClassChange={(v) => {
          setSelectedClassId(v)
          setSelectedPlan(null)
        }}
        onPlanFilterChange={setPlanFilter}
        onStatusFilterChange={setStatusFilter}
        onAddPlan={handleAddPlan}
        onOpenTermDialog={() => setTermDialogOpen(true)}
        onOpenClassDialog={() => setClassDialogOpen(true)}
      />

      {/* Two-column layout: Plan list on left, Plan detail on right */}
      <div className="grid gap-4 lg:grid-cols-3">
        <StudyPlanList
          parentPlans={parentPlans}
          childPlansByParent={childPlansByParent}
          selectedPlan={selectedPlan}
          plansLoading={plansLoading}
          onSelectPlan={handleSelectPlan}
          onAutoSplit={handleAutoSplit}
          onEditPlan={handleEditPlan}
        />
        <StudyPlanDetail
          selectedPlan={selectedPlan}
          isStudentMode={isStudentMode}
          childPlansByParent={childPlansByParent}
          completedCount={completedCount}
          totalCount={totalCount}
          completionRate={completionRate}
          itemsLoading={itemsLoading}
          parentItems={parentItems}
          childItemsByParent={childItemsByParent}
          weekDays={weekDays}
          today={today}
          itemsByDay={itemsByDay}
          weekOffset={weekOffset}
          onWeekOffset={setWeekOffset}
          onSetStudentMode={setIsStudentMode}
          onAutoSplit={handleAutoSplit}
          onEditPlan={handleEditPlan}
          onOpenStats={() => {
            void completionStatsQuery.refetch()
            setStatsOpen(true)
          }}
          onOpenTimeline={() => {
            void progressTimelineQuery.refetch()
            setTimelineOpen(true)
          }}
          onUpdateStatus={(id, status) => {
            void updatePlanStatus.mutateAsync({ id, status })
          }}
          onAddItem={handleAddItem}
          onEditItem={handleEditItem}
          onAddSubItem={handleAddSubItem}
          onToggleCompleted={handleToggleCompleted}
          onDeleteParentItem={handleDeleteParentItem}
          onDeleteChildItem={handleDeleteChildItem}
          onEditChildItem={handleEditChildItem}
        />
      </div>

      {/* ─── Completion Stats Dialog ─── */}
      <StudyPlanStatsDialog
        open={statsOpen}
        onOpenChange={setStatsOpen}
        query={completionStatsQuery}
      />

      {/* ─── Progress Timeline Dialog ─── */}
      <StudyPlanTimelineDialog
        open={timelineOpen}
        onOpenChange={setTimelineOpen}
        query={progressTimelineQuery}
      />

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
        isStudentMode={isStudentMode}
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
