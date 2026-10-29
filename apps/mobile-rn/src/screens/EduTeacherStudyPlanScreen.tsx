// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 教师侧学习计划编排页(mobile-rn 宿主壳)—— 对齐 web `/edu/edu-management/study-plan`。
 *
 * 与 `EduChildStudyPlansScreen`(家长视角、只读 `parent/children/:childId/study-plans`)**非同物**,
 * 本屏取数 + 提交全部在宿主,渲染在共享屏 `@ihui/rn-app` 的 EduTeacherStudyPlanScreen。
 *
 * 端点(逐条读 `apps/api/src/routes/edu-ai-management.ts` 确认):
 *  - GET    /api/edu-ai-management/term                            ⇒ { list, total, … }
 *  - GET    /api/edu-ai-management/class?termId=                   ⇒ { list }
 *  - GET    /api/edu-ai-management/study-plan?termId=&classId=     ⇒ { list, total, … }
 *  - GET    /api/edu-ai-management/study-plan/:id/items            ⇒ { items }(web 读 { list },两种都认)
 *  - POST   /api/edu-ai-management/study-plan                      ⇒ 201 { plan }
 *  - PUT    /api/edu-ai-management/study-plan/:id                  ⇒ { plan }(改字段 / 改状态共用)
 *  - DELETE /api/edu-ai-management/study-plan/:id                  ⇒ { deleted }(软删)
 *  - POST   /api/edu-ai-management/study-plan/:id/auto-split       ⇒ 201 { count, plans }
 *  - PUT    /api/edu-ai-management/plan-item/:id                   ⇒ { item }(条目勾选)
 *  取数串带 pageSize=100:后端 `paginate` 默认页长会截断班级/计划列表。
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import type {
  EduTeacherClass,
  EduTeacherPlanForm,
  EduTeacherPlanItem,
  EduTeacherStudyPlan,
  EduTeacherTerm,
} from '@ihui/types'
import {
  EduTeacherStudyPlanScreen as SharedEduTeacherStudyPlanScreen,
  type EduTeacherStudyPlanScreenProps,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 后端裸行:列表项额外带 deletedAt(软删),渲染前滤掉 */
type PlanRow = EduTeacherStudyPlan & { deletedAt?: string | null }

/** `YYYY-MM-DD`(本地时区;服务端只存字符串,不做时区换算) */
function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 新建表单的日期默认值:今天起、默认 4 周(月计划拆成 4 个周计划的常见跨度) */
function defaultRange(): { startDate: string; endDate: string } {
  const start = new Date()
  const end = new Date(start)
  end.setDate(end.getDate() + 27)
  return { startDate: isoDay(start), endDate: isoDay(end) }
}

export function EduTeacherStudyPlanScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

  const [terms, setTerms] = useState<EduTeacherTerm[]>([])
  const [classes, setClasses] = useState<EduTeacherClass[]>([])
  const [termId, setTermId] = useState('')
  const [classId, setClassId] = useState('')
  const [plans, setPlans] = useState<EduTeacherStudyPlan[]>([])
  const [items, setItems] = useState<EduTeacherPlanItem[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [form, setForm] = useState<EduTeacherPlanForm | null>(null)
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [classesLoading, setClassesLoading] = useState(false)
  const [itemsLoading, setItemsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null)
  const [splittingPlanId, setSplittingPlanId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  /* ── 学期:首屏拉取,优先落 isCurrent ── */
  const loadTerms = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchApi<{ list?: EduTeacherTerm[] }>(
        '/api/edu-ai-management/term?page=1&pageSize=100',
      )
      if (!res.success) {
        setTerms([])
        setError(apiFailureToText(res, t('eduTeacherStudyPlan.loadTermsFailed')))
        return
      }
      const list = res.data?.list ?? []
      setTerms(list)
      const current = list.find((term) => term.isCurrent) ?? list[0] ?? null
      setTermId(current ? current.id : '')
    } catch {
      setTerms([])
      setError(t('eduTeacherStudyPlan.loadTermsFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadTerms()
  }, [loadTerms])

  /* ── 班级:随学期切换;原班级不在新列表里就落第一个 ── */
  useEffect(() => {
    if (!termId) {
      setClasses([])
      setClassId('')
      return
    }
    let cancelled = false
    void (async () => {
      setClassesLoading(true)
      try {
        const res = await fetchApi<{ list?: EduTeacherClass[] }>(
          `/api/edu-ai-management/class?termId=${encodeURIComponent(termId)}`,
        )
        if (cancelled) return
        if (!res.success) {
          setClasses([])
          setClassId('')
          setError(apiFailureToText(res, t('eduTeacherStudyPlan.loadClassesFailed')))
          return
        }
        const list = res.data?.list ?? []
        setClasses(list)
        setClassId((prev) =>
          prev && list.some((item) => item.id === prev) ? prev : (list[0]?.id ?? ''),
        )
      } catch {
        if (cancelled) return
        setClasses([])
        setClassId('')
        setError(t('eduTeacherStudyPlan.loadClassesFailed'))
      } finally {
        if (!cancelled) setClassesLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [termId, t])

  /* ── 计划:随学期+班级;选中项失效时落第一个父计划 ── */
  const loadPlans = useCallback(async () => {
    if (!termId || !classId) {
      setPlans([])
      setItems([])
      setSelectedPlanId(null)
      return
    }
    setLoading(true)
    setError('')
    try {
      const query = `termId=${encodeURIComponent(termId)}&classId=${encodeURIComponent(classId)}&page=1&pageSize=100`
      const res = await fetchApi<{ list?: PlanRow[] }>(`/api/edu-ai-management/study-plan?${query}`)
      if (!res.success) {
        setPlans([])
        setError(apiFailureToText(res, t('eduTeacherStudyPlan.loadPlansFailed')))
        return
      }
      const list = (res.data?.list ?? []).filter((plan) => !plan.deletedAt)
      setPlans(list)
      setSelectedPlanId((prev) => {
        if (prev && list.some((plan) => plan.id === prev)) return prev
        const firstParent = list.find((plan) => !plan.parentPlanId)
        return firstParent ? firstParent.id : null
      })
    } catch {
      setPlans([])
      setError(t('eduTeacherStudyPlan.loadPlansFailed'))
    } finally {
      setLoading(false)
    }
  }, [classId, termId, t])

  useEffect(() => {
    void loadPlans()
  }, [loadPlans])

  /* ── 条目:实回 { items }(web 读 { list } 是既有假字段),两种都认 ── */
  const loadItems = useCallback(
    async (planId: string) => {
      if (!planId) {
        setItems([])
        return
      }
      setItemsLoading(true)
      try {
        const res = await fetchApi<{
          items?: EduTeacherPlanItem[]
          list?: EduTeacherPlanItem[]
        }>(`/api/edu-ai-management/study-plan/${encodeURIComponent(planId)}/items`)
        if (!res.success) {
          setItems([])
          setError(apiFailureToText(res, t('eduTeacherStudyPlan.loadItemsFailed')))
          return
        }
        const list = res.data?.items ?? res.data?.list ?? []
        setItems([...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)))
      } catch {
        setItems([])
        setError(t('eduTeacherStudyPlan.loadItemsFailed'))
      } finally {
        setItemsLoading(false)
      }
    },
    [t],
  )

  useEffect(() => {
    void loadItems(selectedPlanId ?? '')
  }, [loadItems, selectedPlanId])

  /* ── 交互 ── */
  const handleSelectTerm = (next: string) => {
    if (next === termId) return
    setTermId(next)
    setClassId('')
    setPlans([])
    setItems([])
    setSelectedPlanId(null)
    setNotice('')
    setError('')
  }

  const handleSelectClass = (next: string) => {
    if (next === classId) return
    setClassId(next)
    setPlans([])
    setItems([])
    setSelectedPlanId(null)
    setNotice('')
    setError('')
  }

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId)
    setNotice('')
  }

  const handleOpenCreate = () => {
    if (!termId || !classId) {
      setError(t('eduTeacherStudyPlan.selectClassFirst'))
      return
    }
    setError('')
    setNotice('')
    setEditingPlanId(null)
    setForm({ title: '', planType: 'monthly', ...defaultRange(), description: '' })
  }

  const handleOpenEdit = (plan: EduTeacherStudyPlan) => {
    setError('')
    setNotice('')
    setEditingPlanId(plan.id)
    setForm({
      title: plan.title,
      planType: plan.planType,
      startDate: plan.startDate.slice(0, 10),
      endDate: plan.endDate.slice(0, 10),
      description: plan.description ?? '',
    })
  }

  const handleCloseForm = () => {
    setForm(null)
    setEditingPlanId(null)
  }

  const handleFormChange = (key: keyof EduTeacherPlanForm, value: string) => {
    setForm((prev) => {
      if (!prev) return prev
      switch (key) {
        case 'title':
          return { ...prev, title: value }
        case 'planType':
          return { ...prev, planType: value === 'weekly' ? 'weekly' : 'monthly' }
        case 'startDate':
          return { ...prev, startDate: value }
        case 'endDate':
          return { ...prev, endDate: value }
        case 'description':
          return { ...prev, description: value }
        default:
          return prev
      }
    })
  }

  const handleSubmitForm = async () => {
    if (!form) return
    const title = form.title.trim()
    const startDate = form.startDate.trim()
    const endDate = form.endDate.trim()
    if (!title || !startDate || !endDate) {
      setError(t('eduTeacherStudyPlan.requiredFields'))
      return
    }
    if (!editingPlanId && (!termId || !classId)) {
      setError(t('eduTeacherStudyPlan.selectClassFirst'))
      return
    }

    setSaving(true)
    setError('')
    setNotice('')
    try {
      const editingId = editingPlanId
      const body = editingId
        ? {
            title,
            planType: form.planType,
            startDate,
            endDate,
            description: form.description.trim() || undefined,
          }
        : {
            title,
            planType: form.planType,
            classId,
            termId,
            startDate,
            endDate,
            description: form.description.trim() || undefined,
          }
      const res = editingId
        ? await fetchApi<{ plan?: EduTeacherStudyPlan }>(
            `/api/edu-ai-management/study-plan/${encodeURIComponent(editingId)}`,
            { method: 'PUT', body: JSON.stringify(body) },
          )
        : await fetchApi<{ plan?: EduTeacherStudyPlan }>('/api/edu-ai-management/study-plan', {
            method: 'POST',
            body: JSON.stringify(body),
          })
      if (!res.success) {
        setError(apiFailureToText(res, t('eduTeacherStudyPlan.saveFailed')))
        return
      }
      const savedId = res.data?.plan?.id
      handleCloseForm()
      await loadPlans()
      if (!editingId && savedId) setSelectedPlanId(savedId)
    } catch {
      setError(t('eduTeacherStudyPlan.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePlan = async (plan: EduTeacherStudyPlan) => {
    setDeletingPlanId(plan.id)
    setError('')
    setNotice('')
    try {
      const res = await fetchApi<{ deleted?: boolean }>(
        `/api/edu-ai-management/study-plan/${encodeURIComponent(plan.id)}`,
        { method: 'DELETE' },
      )
      if (!res.success) {
        setError(apiFailureToText(res, t('eduTeacherStudyPlan.deleteFailed')))
        return
      }
      if (selectedPlanId === plan.id) {
        setSelectedPlanId(null)
        setItems([])
      }
      await loadPlans()
    } catch {
      setError(t('eduTeacherStudyPlan.deleteFailed'))
    } finally {
      setDeletingPlanId(null)
    }
  }

  const handleAutoSplit = async (plan: EduTeacherStudyPlan) => {
    setSplittingPlanId(plan.id)
    setError('')
    setNotice('')
    try {
      const res = await fetchApi<{ count?: number }>(
        `/api/edu-ai-management/study-plan/${encodeURIComponent(plan.id)}/auto-split`,
        { method: 'POST' },
      )
      if (!res.success) {
        setError(apiFailureToText(res, t('eduTeacherStudyPlan.splitFailed')))
        return
      }
      const count = typeof res.data?.count === 'number' ? res.data.count : 0
      setNotice(
        count > 0
          ? t('eduTeacherStudyPlan.splitDone', { count })
          : t('eduTeacherStudyPlan.splitEmpty'),
      )
      await loadPlans()
    } catch {
      setError(t('eduTeacherStudyPlan.splitFailed'))
    } finally {
      setSplittingPlanId(null)
    }
  }

  const handleUpdateStatus = async (plan: EduTeacherStudyPlan, status: string) => {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const res = await fetchApi<{ plan?: EduTeacherStudyPlan }>(
        `/api/edu-ai-management/study-plan/${encodeURIComponent(plan.id)}`,
        { method: 'PUT', body: JSON.stringify({ status }) },
      )
      if (!res.success) {
        setError(apiFailureToText(res, t('eduTeacherStudyPlan.saveFailed')))
        return
      }
      setPlans((prev) =>
        prev.map((row) =>
          row.id === plan.id ? { ...row, status: res.data?.plan?.status ?? status } : row,
        ),
      )
    } catch {
      setError(t('eduTeacherStudyPlan.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleToggleItem = async (item: EduTeacherPlanItem) => {
    const next = !item.completed
    // 乐观勾选:条目勾选是高频轻操作,失败再回滚
    setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, completed: next } : row)))
    try {
      const res = await fetchApi<{ item?: EduTeacherPlanItem }>(
        `/api/edu-ai-management/plan-item/${encodeURIComponent(item.id)}`,
        { method: 'PUT', body: JSON.stringify({ completed: next }) },
      )
      if (!res.success) {
        setItems((prev) =>
          prev.map((row) => (row.id === item.id ? { ...row, completed: item.completed } : row)),
        )
        setError(apiFailureToText(res, t('eduTeacherStudyPlan.saveFailed')))
      }
    } catch {
      setItems((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, completed: item.completed } : row)),
      )
      setError(t('eduTeacherStudyPlan.saveFailed'))
    }
  }

  const props: EduTeacherStudyPlanScreenProps = {
    t,
    terms,
    classes,
    plans,
    items,
    selectedTermId: termId,
    selectedClassId: classId,
    selectedPlanId,
    form,
    editingPlanId,
    loading,
    classesLoading,
    itemsLoading,
    saving,
    deletingPlanId,
    splittingPlanId,
    error,
    notice,
    onBack: () => navigation.goBack(),
    onRetry: () => void loadTerms(),
    onSelectTerm: handleSelectTerm,
    onSelectClass: handleSelectClass,
    onSelectPlan: handleSelectPlan,
    onOpenCreate: handleOpenCreate,
    onOpenEdit: handleOpenEdit,
    onCloseForm: handleCloseForm,
    onFormChange: handleFormChange,
    onSubmitForm: () => void handleSubmitForm(),
    onDeletePlan: (plan) => void handleDeletePlan(plan),
    onAutoSplit: (plan) => void handleAutoSplit(plan),
    onUpdateStatus: (plan, status) => void handleUpdateStatus(plan, status),
    onToggleItem: (item) => void handleToggleItem(item),
    colorScheme: resolvedTheme,
  }

  return <SharedEduTeacherStudyPlanScreen {...props} />
}

export default EduTeacherStudyPlanScreen
