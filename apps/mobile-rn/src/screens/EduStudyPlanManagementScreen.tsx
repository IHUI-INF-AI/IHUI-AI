// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  getEduPlanCompletionStats,
  listEduClasses,
  listEduPlanItems,
  listEduStudyPlans,
  listEduTerms,
  type EduClassItem,
  type EduPlanCompletionStats,
  type EduPlanItemRow,
  type EduStudyPlanItem,
  type EduTermItem,
} from '@ihui/api-client'
import {
  EduStudyPlanManagementScreen as SharedEduStudyPlanManagementScreen,
  type EduClassView,
  type EduPlanItemView,
  type EduPlanStatsView,
  type EduStudyPlanRowView,
  type EduTermView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const NS = 'eduStudyPlanPage'

/** 与 web 同页默认页长(apps/web/.../study-plan/StudyPlanList.tsx 走后端默认 20;此处显式取 100 上限) */
const PLAN_PAGE_SIZE = 100

/**
 * RN 端「学习计划管理」薄壳 —— 承载 web /edu/edu-management/study-plan。
 * 渲染全部委托共享屏,本文件只管取数与选中态编排,端点契约见
 * packages/api-client/src/endpoints/edu-management-study-plan.ts 头注:
 *  - 学期 GET /api/edu-ai-management/term(edu-ai-management.ts:859)
 *  - 班级 GET /api/edu-ai-management/class?termId=(947)
 *  - 计划 GET /api/edu-ai-management/study-plan?termId&classId&page&pageSize(1619)
 *  - 条目 GET /api/edu-ai-management/study-plan/:id/items(1776)
 *  - 统计 GET /api/edu-ai-management/study-plan/completion-stats?classId&termId(1864)
 * 只读端点挂 requireEduView(edu:view / edu:manage,102-104):无该权限的普通学生账号会 403,
 * 这里按错误态如实展示,不伪造成空列表。写操作与弹窗子面板未承载,已登记 manifest note。
 */
export function EduStudyPlanManagementScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const [terms, setTerms] = useState<EduTermView[]>([])
  const [termsLoading, setTermsLoading] = useState(false)
  const [termsError, setTermsError] = useState<string | null>(null)
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null)

  const [classes, setClasses] = useState<EduClassView[]>([])
  const [classesLoading, setClassesLoading] = useState(false)
  const [classesError, setClassesError] = useState<string | null>(null)
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)

  const [plans, setPlans] = useState<EduStudyPlanRowView[]>([])
  const [plansLoading, setPlansLoading] = useState(false)
  const [plansError, setPlansError] = useState<string | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)

  const [planItems, setPlanItems] = useState<EduPlanItemView[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const [stats, setStats] = useState<EduPlanStatsView | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState<string | null>(null)

  const dateTimeFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [locale],
  )

  const loadTerms = useCallback(async () => {
    if (!user) return
    setTermsLoading(true)
    try {
      const res = await listEduTerms(1, 100)
      if (!res.success || !res.data) {
        setTermsError(res.error ?? t(`${NS}.loadTermsFailed`))
        return
      }
      setTermsError(null)
      const list: EduTermItem[] = res.data.list ?? []
      setTerms(
        list.map((term) => ({
          id: term.id,
          nameText: term.isCurrent
            ? `${term.name}${t(`${NS}.currentTermSuffix`)}`
            : term.name,
          isCurrent: term.isCurrent,
        })),
      )
      setSelectedTermId((prev) => {
        if (prev && list.some((x) => x.id === prev)) return prev
        return list.find((x) => x.isCurrent)?.id ?? list[0]?.id ?? null
      })
    } catch {
      setTermsError(t(`${NS}.loadTermsFailed`))
    } finally {
      setTermsLoading(false)
    }
  }, [user, t])

  const loadClasses = useCallback(
    async (termId: string) => {
      setClassesLoading(true)
      try {
        const res = await listEduClasses(termId)
        if (!res.success) {
          setClassesError(res.error ?? t('common.loadFailed'))
          return
        }
        setClassesError(null)
        const list: EduClassItem[] = res.data?.list ?? []
        setClasses(
          list.map((row) => ({ id: row.id, name: row.name, grade: row.grade ?? null })),
        )
        setSelectedClassId((prev) => {
          if (prev && list.some((x) => x.id === prev)) return prev
          return list[0]?.id ?? null
        })
      } catch {
        setClassesError(t('common.loadFailed'))
      } finally {
        setClassesLoading(false)
      }
    },
    [t],
  )

  const loadPlans = useCallback(
    async (termId: string, classId: string) => {
      setPlansLoading(true)
      try {
        const res = await listEduStudyPlans({
          termId,
          classId,
          page: 1,
          pageSize: PLAN_PAGE_SIZE,
        })
        if (!res.success) {
          setPlansError(res.error ?? t('common.loadFailed'))
          return
        }
        setPlansError(null)
        const list: EduStudyPlanItem[] = res.data?.list ?? []
        setPlans(
          list.map((plan) => ({
            id: plan.id,
            title: plan.title,
            description: plan.description ?? null,
            planType: plan.planType,
            status: plan.status,
            dateRangeText: `${plan.startDate} ~ ${plan.endDate}`,
          })),
        )
        setSelectedPlanId((prev) => {
          if (prev && list.some((x) => x.id === prev)) return prev
          return null
        })
      } catch {
        setPlansError(t('common.loadFailed'))
      } finally {
        setPlansLoading(false)
      }
    },
    [t],
  )

  const loadStats = useCallback(
    async (termId: string, classId: string) => {
      setStatsLoading(true)
      try {
        const res = await getEduPlanCompletionStats(classId, termId)
        if (!res.success || !res.data) {
          setStatsError(res.error ?? t('common.loadFailed'))
          return
        }
        setStatsError(null)
        const data: EduPlanCompletionStats = res.data
        setStats({
          overallRate: data.overallRate ?? 0,
          totalItems: data.totalItems ?? 0,
          totalCompleted: data.totalCompleted ?? 0,
          rows: (data.plans ?? []).map((row) => ({
            planId: row.planId,
            title: row.planTitle,
            rate: row.completionRate ?? 0,
          })),
        })
      } catch {
        setStatsError(t('common.loadFailed'))
      } finally {
        setStatsLoading(false)
      }
    },
    [t],
  )

  const loadItems = useCallback(
    async (planId: string) => {
      setDetailLoading(true)
      try {
        const res = await listEduPlanItems(planId)
        if (!res.success) {
          setDetailError(res.error ?? t('common.loadFailed'))
          return
        }
        setDetailError(null)
        const list: EduPlanItemRow[] = res.data?.items ?? []
        setPlanItems(
          list.map((item) => ({
            id: item.id,
            content: item.content,
            objectiveText: item.objective
              ? t(`${NS}.objectivePrefix`, { value: item.objective })
              : null,
            notesText: item.notes ? t(`${NS}.notesPrefix`, { value: item.notes }) : null,
            dueDateText: item.dueDate ?? null,
            completed: item.completed,
            completedAtText: item.completedAt
              ? t(`${NS}.completedAtPrefix`, {
                  value: dateTimeFmt.format(new Date(item.completedAt)),
                })
              : null,
          })),
        )
      } catch {
        setDetailError(t('common.loadFailed'))
      } finally {
        setDetailLoading(false)
      }
    },
    [t, dateTimeFmt],
  )

  useEffect(() => {
    void loadTerms()
  }, [loadTerms])

  useEffect(() => {
    if (!selectedTermId) return
    void loadClasses(selectedTermId)
  }, [selectedTermId, loadClasses])

  useEffect(() => {
    if (!selectedTermId || !selectedClassId) return
    void loadPlans(selectedTermId, selectedClassId)
    void loadStats(selectedTermId, selectedClassId)
  }, [selectedTermId, selectedClassId, loadPlans, loadStats])

  useEffect(() => {
    if (!selectedPlanId) return
    void loadItems(selectedPlanId)
  }, [selectedPlanId, loadItems])

  return (
    <SharedEduStudyPlanManagementScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loginRequiredText={user ? '' : t(`${NS}.loginRequired`)}
      termsLoading={termsLoading}
      termsError={termsError}
      terms={terms}
      selectedTermId={selectedTermId}
      onSelectTerm={(id) => {
        setSelectedTermId(id)
        setSelectedClassId(null)
        setSelectedPlanId(null)
        setPlans([])
        setStats(null)
        setPlanItems([])
      }}
      classesLoading={classesLoading}
      classesError={classesError}
      classes={classes}
      selectedClassId={selectedClassId}
      onSelectClass={(id) => {
        setSelectedClassId(id)
        setSelectedPlanId(null)
        setPlanItems([])
      }}
      plansLoading={plansLoading}
      plansError={plansError}
      plans={plans}
      selectedPlanId={selectedPlanId}
      onSelectPlan={setSelectedPlanId}
      detailLoading={detailLoading}
      detailError={detailError}
      planItems={planItems}
      statsLoading={statsLoading}
      statsError={statsError}
      stats={stats}
      onRefresh={() => {
        void loadTerms()
        if (selectedTermId) void loadClasses(selectedTermId)
        if (selectedTermId && selectedClassId) {
          void loadPlans(selectedTermId, selectedClassId)
          void loadStats(selectedTermId, selectedClassId)
        }
        if (selectedPlanId) void loadItems(selectedPlanId)
      }}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
