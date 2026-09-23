// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  Users,
  UserPlus,
  Link2,
  Loader2,
  BookOpen,
  UtensilsCrossed,
  ClipboardList,
  CalendarCheck,
  Award,
  Clock,
  MapPin,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Trash2,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  LogOut,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { fetchApi } from '@/lib/api'
import { CHART_BLUE } from '@ihui/design-tokens'
import { BackButton } from '@/components/common'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@ihui/ui-react'
import { Alert, ConfirmDialog, Tooltip } from '@/components/feedback'
import { Input } from '@/components/form'
import { Badge } from '@/components/data'

/* ─── Types ─── */

interface ChildInfo {
  bindingId: string
  studentId: string
  relationship: string
  status: string
  student: {
    id: string
    username: string
    nickname: string
    avatar: string | null
  } | null
}

interface BindingRecord {
  id: string
  parentId: string
  studentId: string
  relationship: string
  status: string
  confirmedAt: string | null
  createdAt: string
}

interface CourseItem {
  id: string
  courseName: string
  teacher: string | null
  weekday: number
  startTime: string
  endTime: string
  classroom: string | null
  color: string | null
}

interface MealItem {
  id: string
  date: string
  mealType: string
  dishName: string
  ingredients: string | null
  nutrition: string | null
  imageUrl: string | null
}

interface StudyPlanItem {
  id: string
  title: string
  planType: string
  startDate: string
  endDate: string
  description: string | null
  status: string
}

interface AttendanceRecord {
  id: string
  date: string
  status: string
  checkInTime: string | null
  checkOutTime: string | null
  checkInMethod: string | null
  checkOutMethod: string | null
}

interface GradeItem {
  id: string
  subject: string
  examName: string
  score: number
  totalScore: number
  examDate: string
}

/* ─── API Helper ─── */

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

/* ─── Constants ─── */

const RELATIONSHIP_OPTIONS = ['father', 'mother', 'guardian', 'other']

/** 关系码 → eduParent 取词键;渲染处 t(key),未知码回退原码 */
const RELATIONSHIP_LABEL_KEYS: Record<string, string> = {
  father: 'relationshipFather',
  mother: 'relationshipMother',
  guardian: 'relationshipGuardian',
  other: 'relationshipOther',
}

const BINDING_STATUS_KEYS: Record<string, string> = {
  pending: 'bindingStatusPending',
  confirmed: 'bindingStatusConfirmed',
  rejected: 'bindingStatusRejected',
}

const BINDING_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
}

const WEEKDAY_KEYS = [
  'weekdayMon',
  'weekdayTue',
  'weekdayWed',
  'weekdayThu',
  'weekdayFri',
  'weekdaySat',
  'weekdaySun',
]

const MEAL_TYPE_KEYS: Record<string, string> = {
  breakfast: 'mealBreakfast',
  lunch: 'mealLunch',
  dinner: 'mealDinner',
  snack: 'mealSnack',
}

const MEAL_TYPE_ORDER = ['breakfast', 'lunch', 'dinner', 'snack']

const STUDY_PLAN_STATUS_KEYS: Record<string, string> = {
  draft: 'planStatusDraft',
  active: 'planStatusActive',
  completed: 'planStatusCompleted',
  archived: 'planStatusArchived',
}

const STUDY_PLAN_STATUS_STYLES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  archived: 'bg-amber-100 text-amber-700',
}

const ATTENDANCE_STATUS_KEYS: Record<string, string> = {
  present: 'attendancePresent',
  late: 'attendanceLate',
  early: 'attendanceEarly',
  absent: 'attendanceAbsent',
  leave: 'attendanceLeave',
}

const ATTENDANCE_STATUS_STYLES: Record<string, string> = {
  present: 'bg-emerald-100 text-emerald-700',
  late: 'bg-amber-100 text-amber-700',
  early: 'bg-orange-100 text-orange-700',
  absent: 'bg-red-100 text-red-700',
  leave: 'bg-blue-100 text-blue-700',
}

/* ─── i18n Helper ─── */

type Translator = (key: string) => string

/** 码 → 取词键 → 本地化文案;未知码回退原码(与后端比对的全是英文码,不参与中文匹配) */
function codeLabel(t: Translator, keys: Record<string, string>, code: string): string {
  const key = keys[code]
  return key ? t(key) : code
}

/* ─── Main Page ─── */

export default function ParentPortalPage() {
  const t = useTranslations('eduParent')
  const [activeTab, setActiveTab] = React.useState('children')
  const [selectedChildId, setSelectedChildId] = React.useState<string | null>(null)
  const [childSubTab, setChildSubTab] = React.useState('courses')

  /* ── Children Query ── */
  const childrenQuery = useQuery({
    queryKey: ['parent', 'children'],
    queryFn: () => api<{ children: ChildInfo[] }>('/api/edu-ai-management/parent/children'),
  })

  const children = childrenQuery.data?.children ?? []
  const confirmedChildren = children.filter((c) => c.status === 'confirmed')
  const selectedChild = confirmedChildren.find((c) => c.studentId === selectedChildId)

  const handleBackToChildren = () => {
    setSelectedChildId(null)
    setChildSubTab('courses')
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <BackButton />
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('pageTitle')}</h1>
        <p className="text-xs text-muted-foreground">{t('pageSubtitle')}</p>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="children">
            <Users className="mr-1.5 h-4 w-4" />
            {t('tabMyChildren')}
          </TabsTrigger>
          <TabsTrigger value="bindings">
            <Link2 className="mr-1.5 h-4 w-4" />
            {t('tabBindings')}
          </TabsTrigger>
        </TabsList>

        {/* ════════════════ Tab: 我的孩子 ════════════════ */}
        <TabsContent value="children" className="space-y-4">
          {selectedChildId && selectedChild ? (
            <ChildDetailView
              child={selectedChild}
              childSubTab={childSubTab}
              onSubTabChange={setChildSubTab}
              onBack={handleBackToChildren}
            />
          ) : (
            <ChildrenListView
              items={confirmedChildren}
              isLoading={childrenQuery.isLoading}
              error={childrenQuery.error}
              onSelectChild={(id) => setSelectedChildId(id)}
            />
          )}
        </TabsContent>

        {/* ════════════════ Tab: 绑定管理 ════════════════ */}
        <TabsContent value="bindings" className="space-y-4">
          <BindingsManagement />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* ─── Children List View ─── */

function ChildrenListView({
  items,
  isLoading,
  error,
  onSelectChild,
}: {
  items: ChildInfo[]
  isLoading: boolean
  error: Error | null
  onSelectChild: (id: string) => void
}) {
  const t = useTranslations('eduParent')

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return <Alert variant="danger" description={t('childrenLoadFailed')} />
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-12">
        <Users className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-medium">{t('emptyNoChildren')}</p>
          <p className="text-xs text-muted-foreground">{t('emptyNoChildrenHint')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
      {items.map((child) => (
        <button
          key={child.bindingId}
          onClick={() => onSelectChild(child.studentId)}
          className="group rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
              {child.studentId.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{child.studentId}</p>
              <p className="text-xs text-muted-foreground">
                {codeLabel(t, RELATIONSHIP_LABEL_KEYS, child.relationship)}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
          </div>
        </button>
      ))}
    </div>
  )
}

/* ─── Child Detail View ─── */

function ChildDetailView({
  child,
  childSubTab,
  onSubTabChange,
  onBack,
}: {
  child: ChildInfo
  childSubTab: string
  onSubTabChange: (tab: string) => void
  onBack: () => void
}) {
  const t = useTranslations('eduParent')
  const childId = child.studentId
  const relationship = codeLabel(t, RELATIONSHIP_LABEL_KEYS, child.relationship)

  const SUB_TABS = [
    { value: 'courses', labelKey: 'subTabCourses', icon: BookOpen },
    { value: 'meals', labelKey: 'subTabMeals', icon: UtensilsCrossed },
    { value: 'study-plans', labelKey: 'subTabStudyPlans', icon: ClipboardList },
    { value: 'grades', labelKey: 'subTabGrades', icon: Award },
    { value: 'attendance', labelKey: 'subTabAttendance', icon: CalendarCheck },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
            {childId.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium">{childId}</p>
            <p className="text-xs text-muted-foreground">{relationship}</p>
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <Tabs value={childSubTab} onValueChange={onSubTabChange}>
        <TabsList className="flex-wrap">
          {SUB_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              <tab.icon className="mr-1.5 h-4 w-4" />
              {t(tab.labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="courses" className="space-y-4">
          <CoursesView childId={childId} />
        </TabsContent>

        <TabsContent value="meals" className="space-y-4">
          <MealsView childId={childId} />
        </TabsContent>

        <TabsContent value="study-plans" className="space-y-4">
          <StudyPlansView childId={childId} />
        </TabsContent>

        <TabsContent value="grades" className="space-y-4">
          <GradesView childId={childId} />
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4">
          <AttendanceView childId={childId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* ─── Courses View ─── */

function CoursesView({ childId }: { childId: string }) {
  const t = useTranslations('eduParent')
  const { data, isLoading, error } = useQuery({
    queryKey: ['parent', 'children', childId, 'courses'],
    queryFn: () =>
      api<{ list: CourseItem[] }>(`/api/edu-ai-management/parent/child/${childId}/schedule`),
  })

  const courses = data?.list ?? []
  const grouped = courses.reduce<Record<number, CourseItem[]>>((acc, c) => {
    ;(acc[c.weekday] ??= []).push(c)
    return acc
  }, {})

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loadingCourses')}
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return <Alert variant="danger" description={t('coursesLoadFailed')} />
  }

  if (courses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8">
        <BookOpen className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('emptyNoCourses')}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
      {WEEKDAY_KEYS.map((dayKey, idx) => {
        const dayCourses = grouped[idx + 1]
        if (!dayCourses) return null
        return (
          <Card key={idx}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t(dayKey)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {dayCourses.map((c) => (
                <div
                  key={c.id}
                  className="rounded-lg border-l-4 bg-card px-3 py-2"
                  style={{ borderLeftColor: c.color ?? CHART_BLUE }}
                >
                  <p className="text-sm font-medium">{c.courseName}</p>
                  <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {c.startTime} - {c.endTime}
                    </div>
                    {c.teacher && (
                      <div className="flex items-center gap-1">
                        <span>{c.teacher}</span>
                      </div>
                    )}
                    {c.classroom && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {c.classroom}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

/* ─── Meals View ─── */

function MealsView({ childId }: { childId: string }) {
  const t = useTranslations('eduParent')
  const { data, isLoading, error } = useQuery({
    queryKey: ['parent', 'children', childId, 'meals'],
    queryFn: () =>
      api<{ list: MealItem[] }>(`/api/edu-ai-management/parent/children/${childId}/meals`),
  })

  const meals = data?.list ?? []
  const grouped = meals.reduce<Record<string, MealItem[]>>((acc, m) => {
    ;(acc[m.mealType] ??= []).push(m)
    return acc
  }, {})

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loadingMeals')}
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return <Alert variant="danger" description={t('mealsLoadFailed')} />
  }

  if (meals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8">
        <UtensilsCrossed className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('emptyNoMeals')}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-4">
      {MEAL_TYPE_ORDER.map((type) => {
        const items = grouped[type]
        if (!items) return null
        return (
          <Card key={type}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {codeLabel(t, MEAL_TYPE_KEYS, type)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.map((m) => (
                <div key={m.id} className="rounded-lg border bg-card px-3 py-2">
                  <p className="text-sm font-medium">{m.dishName}</p>
                  {m.ingredients && (
                    <p className="mt-1 text-xs text-muted-foreground">{m.ingredients}</p>
                  )}
                  {m.nutrition && <p className="mt-0.5 text-xs text-emerald-600">{m.nutrition}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

/* ─── Study Plans View ─── */

function StudyPlansView({ childId }: { childId: string }) {
  const t = useTranslations('eduParent')
  const { data, isLoading, error } = useQuery({
    queryKey: ['parent', 'children', childId, 'study-plans'],
    queryFn: () =>
      api<{ list: StudyPlanItem[] }>(
        `/api/edu-ai-management/parent/children/${childId}/study-plans`,
      ),
  })

  const plans = data?.list ?? []

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loadingStudyPlans')}
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return <Alert variant="danger" description={t('studyPlansLoadFailed')} />
  }

  if (plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8">
        <ClipboardList className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('emptyNoStudyPlans')}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
      {plans.map((p) => (
        <Card key={p.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                {p.planType === 'monthly' ? (
                  <CalendarDays className="h-4 w-4 text-primary" />
                ) : (
                  <Clock className="h-4 w-4 text-primary" />
                )}
                {p.title}
              </CardTitle>
              <Badge className={STUDY_PLAN_STATUS_STYLES[p.status] ?? ''}>
                {codeLabel(t, STUDY_PLAN_STATUS_KEYS, p.status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-1 text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>
                {p.startDate} ~ {p.endDate}
              </span>
            </div>
            {p.description && <p className="line-clamp-2 text-muted-foreground">{p.description}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/* ─── Grades View ─── */

function GradesView({ childId }: { childId: string }) {
  const t = useTranslations('eduParent')
  const { data, isLoading, error } = useQuery({
    queryKey: ['parent', 'children', childId, 'grades'],
    queryFn: () =>
      api<{ list: GradeItem[] }>(`/api/edu-ai-management/parent/child/${childId}/grades`),
  })

  const grades = data?.list ?? []

  const grouped = grades.reduce<Record<string, GradeItem[]>>((acc, g) => {
    ;(acc[g.subject] ??= []).push(g)
    return acc
  }, {})

  const subjectAvgs = Object.entries(grouped).map(([subject, items]) => {
    const avg = Math.round(items.reduce((s, i) => s + i.score, 0) / items.length)
    const totalScore = items[0]?.totalScore ?? 100
    const percentage = Math.round((avg / totalScore) * 100)
    return { subject, avg, totalScore, percentage, count: items.length }
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loadingGrades')}
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return <Alert variant="danger" description={t('gradesLoadFailed')} />
  }

  if (grades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8">
        <Award className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('emptyNoGrades')}</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
        {subjectAvgs.map((s) => (
          <Card key={s.subject}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{s.subject}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{s.avg}</span>
                <span className="text-sm text-muted-foreground">/ {s.totalScore}</span>
                {s.percentage >= 80 ? (
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
              </div>
              <div className="h-2 overflow-hidden rounded bg-muted">
                <div
                  className={cn(
                    'h-full rounded transition-all',
                    s.percentage >= 80
                      ? 'bg-emerald-500'
                      : s.percentage >= 60
                        ? 'bg-amber-500'
                        : 'bg-red-500',
                  )}
                  style={{ width: `${s.percentage}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{t('examCount', { count: s.count })}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{t('gradeDetails')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {grades.map((g) => {
              const percentage = Math.round((g.score / g.totalScore) * 100)
              return (
                <div
                  key={g.id}
                  className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{g.subject}</span>
                      <span className="text-xs text-muted-foreground">{g.examName}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{g.examDate}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'text-lg font-bold',
                          percentage >= 80
                            ? 'text-emerald-600'
                            : percentage >= 60
                              ? 'text-amber-600'
                              : 'text-red-600',
                        )}
                      >
                        {g.score}
                      </span>
                      <span className="text-xs text-muted-foreground">/ {g.totalScore}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </>
  )
}

/* ─── Attendance View ─── */

function AttendanceView({ childId }: { childId: string }) {
  const t = useTranslations('eduParent')
  const { data, isLoading, error } = useQuery({
    queryKey: ['parent', 'children', childId, 'attendance'],
    queryFn: () =>
      api<{ list: AttendanceRecord[] }>(
        `/api/edu-ai-management/parent/child/${childId}/attendance`,
      ),
  })

  const records = data?.list ?? []

  const stats = {
    total: records.length,
    present: records.filter((r) => r.status === 'present').length,
    late: records.filter((r) => r.status === 'late').length,
    absent: records.filter((r) => r.status === 'absent').length,
    leave: records.filter((r) => r.status === 'leave').length,
  }
  const attendanceRate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loadingAttendance')}
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return <Alert variant="danger" description={t('attendanceLoadFailed')} />
  }

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8">
        <CalendarCheck className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('emptyNoAttendance')}</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 min-[640px]:grid-cols-5">
        <Card>
          <CardContent className="min-[640px]:p-3 p-3 text-center">
            <p className="text-2xl font-bold">{attendanceRate}%</p>
            <p className="text-xs text-muted-foreground">{t('attendanceRate')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="min-[640px]:p-3 p-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">{stats.present}</p>
            <p className="text-xs text-muted-foreground">{t('attendancePresent')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="min-[640px]:p-3 p-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{stats.late}</p>
            <p className="text-xs text-muted-foreground">{t('attendanceLate')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="min-[640px]:p-3 p-3 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
            <p className="text-xs text-muted-foreground">{t('attendanceAbsent')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="min-[640px]:p-3 p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.leave}</p>
            <p className="text-xs text-muted-foreground">{t('attendanceLeave')}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{t('checkInRecords')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {records.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="text-sm font-medium">{r.date}</div>
                  <Badge className={ATTENDANCE_STATUS_STYLES[r.status] ?? ''}>
                    {codeLabel(t, ATTENDANCE_STATUS_KEYS, r.status)}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {r.checkInTime && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(r.checkInTime).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  )}
                  {r.checkOutTime && (
                    <div className="flex items-center gap-1">
                      <LogOut className="h-3 w-3" />
                      {new Date(r.checkOutTime).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  )
}

/* ─── Bindings Management ─── */

function BindingsManagement() {
  const t = useTranslations('eduParent')
  const queryClient = useQueryClient()

  const [studentId, setStudentId] = React.useState('')
  const [relationship, setRelationship] = React.useState('father')
  const [showDeleteId, setShowDeleteId] = React.useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['parent', 'bindings'],
    queryFn: () => api<{ list: BindingRecord[] }>('/api/edu-ai-management/parent/binding'),
  })

  const bindings = data?.list ?? []

  const createMutation = useMutation({
    mutationFn: (body: { parentId: string; studentId: string; relationship: string }) =>
      api('/api/edu-ai-management/parent-binding', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent', 'bindings'] })
      queryClient.invalidateQueries({ queryKey: ['parent', 'children'] })
      setStudentId('')
      setRelationship('father')
    },
  })

  const confirmMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/api/edu-ai-management/parent/binding/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'confirmed' }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent', 'bindings'] })
      queryClient.invalidateQueries({ queryKey: ['parent', 'children'] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/api/edu-ai-management/parent/binding/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'rejected' }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent', 'bindings'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/api/edu-ai-management/parent-binding/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent', 'bindings'] })
      queryClient.invalidateQueries({ queryKey: ['parent', 'children'] })
      setShowDeleteId(null)
    },
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!studentId.trim()) return
    createMutation.mutate({ parentId: '', studentId: studentId.trim(), relationship })
  }

  return (
    <>
      {/* 创建绑定 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <UserPlus className="h-4 w-4 text-primary" />
            {t('addBinding')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('studentIdLabel')}</p>
              <Input
                value={studentId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStudentId(e.target.value)}
                placeholder={t('studentIdPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('relationshipField')}</p>
              <select
                value={relationship}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setRelationship(e.target.value)
                }
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {RELATIONSHIP_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {codeLabel(t, RELATIONSHIP_LABEL_KEYS, value)}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={createMutation.isPending || !studentId.trim()}>
              {createMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="mr-2 h-4 w-4" />
              )}
              {t('submitBinding')}
            </Button>
            {createMutation.isError && (
              <Alert variant="danger" description={(createMutation.error as Error).message} />
            )}
            {createMutation.isSuccess && (
              <Alert variant="success" description={t('bindingSubmitted')} />
            )}
          </form>
        </CardContent>
      </Card>

      {/* 绑定列表 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Link2 className="h-4 w-4 text-primary" />
            {t('bindingRecords')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-4 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : bindings.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t('emptyNoBindings')}</p>
          ) : (
            <div className="space-y-3">
              {bindings.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{b.studentId}</span>
                      <Badge className={BINDING_STATUS_STYLES[b.status] ?? ''}>
                        {codeLabel(t, BINDING_STATUS_KEYS, b.status)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('relationshipPrefix')}{' '}
                      {codeLabel(t, RELATIONSHIP_LABEL_KEYS, b.relationship)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {b.status === 'pending' && (
                      <>
                        <Tooltip content={t('actionConfirm')}>
                          <button
                            onClick={() => confirmMutation.mutate(b.id)}
                            className="rounded-lg p-2 text-emerald-600 transition-colors hover:bg-emerald-50"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        </Tooltip>
                        <Tooltip content={t('actionReject')}>
                          <button
                            onClick={() => rejectMutation.mutate(b.id)}
                            className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </Tooltip>
                      </>
                    )}
                    <Tooltip content={t('actionDelete')}>
                      <button
                        onClick={() => setShowDeleteId(b.id)}
                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 删除确认对话框 */}
      <ConfirmDialog
        open={showDeleteId !== null}
        title={t('confirmDelete')}
        content={t('confirmDeleteContent')}
        variant="danger"
        confirmText={t('confirmDelete')}
        cancelText={t('cancel')}
        loading={deleteMutation.isPending}
        onConfirm={() => showDeleteId && deleteMutation.mutate(showDeleteId)}
        onCancel={() => setShowDeleteId(null)}
      />
    </>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
