'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  Award,
  BookOpen,
  Building2,
  Clock,
  ExternalLink,
  GraduationCap,
  Loader2,
  Search,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { BackButton } from '@/components/common'
import { Alert } from '@/components/feedback'
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@ihui/ui-react'

type Tab = 'k12' | 'university'

interface K12Course {
  id: string
  stage?: string
  gradeRange?: string
  courseName?: string
  hoursPerYear?: number
  courseType?: string
  learningObjectives?: string
  contentModules?: string
  keyConcepts?: string
  skillRequirements?: string
  teachingMethods?: string
  assessmentMethods?: string
  toolsResources?: string
}

interface UniversityCourse {
  id: string
  courseName?: string
  courseType?: string
  targetMajor?: string
  credits?: number
  hours?: number
  university?: string
  description?: string
  modules?: string
  prerequisites?: string
  textbooks?: string
  teachingTeam?: string
  assessment?: string
  isRequired?: boolean
}

interface ListResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 10

const ENDPOINTS: Record<Tab, string> = {
  k12: '/api/ai-education/k12-curriculum',
  university: '/api/ai-education/university-course',
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function isTruthy(v?: boolean | number | string | null): boolean {
  return v === true || v === 1 || v === '1' || v === 'true'
}

type FieldValue = string | number | boolean | undefined | null

export default function EduAICoursesPage() {
  const t = useTranslations('eduAi.courses')
  const ct = useTranslations('common')
  const [tab, setTab] = React.useState<Tab>('k12')
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [detailId, setDetailId] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(tm)
  }, [search])

  React.useEffect(() => {
    setPage(1)
  }, [debounced])

  function handleTabChange(value: string) {
    setTab(value as Tab)
    setSearch('')
    setDebounced('')
    setPage(1)
    setDetailId(null)
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu-ai', 'courses', tab, debounced, page],
    queryFn: () => {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        status: 'active',
      })
      if (debounced) qs.set('keyword', debounced)
      return api<ListResult<K12Course | UniversityCourse>>(`${ENDPOINTS[tab]}?${qs.toString()}`)
    },
  })

  const detailQuery = useQuery({
    queryKey: ['edu-ai', 'courses', 'detail', tab, detailId],
    queryFn: () => {
      const id = detailId
      if (!id) throw new Error('missing id')
      return tab === 'k12'
        ? api<{ curriculum: K12Course }>(`${ENDPOINTS.k12}/${id}`).then((d) => d.curriculum)
        : api<{ course: UniversityCourse }>(`${ENDPOINTS.university}/${id}`).then((d) => d.course)
    },
    enabled: !!detailId,
  })

  const items = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const detail = detailQuery.data

  function stageLabel(stage?: string) {
    if (stage === 'primary') return t('primary')
    if (stage === 'junior') return t('junior')
    if (stage === 'senior') return t('senior')
    return stage || '-'
  }

  function stageClass(stage?: string) {
    if (stage === 'primary') return 'bg-sky-500/10 text-sky-600'
    if (stage === 'junior') return 'bg-amber-500/10 text-amber-600'
    if (stage === 'senior') return 'bg-violet-500/10 text-violet-600'
    return 'bg-muted text-muted-foreground'
  }

  function renderField(label: string, value: FieldValue) {
    if (value === undefined || value === null || value === '') return null
    const display =
      typeof value === 'boolean' ? (value ? t('required') : t('elective')) : String(value)
    return (
      <div className="rounded-lg border bg-muted/40 p-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm whitespace-pre-wrap">{display}</p>
      </div>
    )
  }

  function renderListItem(item: K12Course | UniversityCourse) {
    if (tab === 'k12') {
      const k = item as K12Course
      return (
        <Card key={item.id} className="transition-colors hover:bg-accent">
          <CardContent className="space-y-2 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'rounded-md px-2 py-0.5 text-xs font-medium',
                  stageClass(k.stage),
                )}
              >
                {stageLabel(k.stage)}
              </span>
              <h3 className="flex-1 text-sm font-medium">{k.courseName}</h3>
              {k.courseType && (
                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">
                  {k.courseType}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('gradeRange')}: {k.gradeRange ?? '-'}
            </p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {t('hoursPerYear')}: {k.hoursPerYear ?? '-'}
              </span>
              <Button size="sm" variant="outline" onClick={() => setDetailId(k.id)}>
                <ExternalLink className="h-3.5 w-3.5" />
                {ct('viewDetail')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )
    }
    const u = item as UniversityCourse
    const required = isTruthy(u.isRequired)
    return (
      <Card key={item.id} className="transition-colors hover:bg-accent">
        <CardContent className="space-y-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="flex-1 text-sm font-medium">{u.courseName}</h3>
            <span
              className={cn(
                'rounded-md px-2 py-0.5 text-xs font-medium',
                required
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : 'bg-amber-500/10 text-amber-600',
              )}
            >
              {required ? t('required') : t('elective')}
            </span>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            {u.university ?? '-'}
          </p>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Award className="h-3.5 w-3.5" />
                {u.credits ?? '-'} {t('credits')}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {u.hours ?? '-'} {t('hours')}
              </span>
            </div>
            <Button size="sm" variant="outline" onClick={() => setDetailId(u.id)}>
              <ExternalLink className="h-3.5 w-3.5" />
              {ct('viewDetail')}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const k12DetailFields: Array<[string, FieldValue]> = detail
    ? [
        [t('stage'), (detail as K12Course).stage],
        [t('gradeRange'), (detail as K12Course).gradeRange],
        [t('courseName'), (detail as K12Course).courseName],
        [t('hoursPerYear'), (detail as K12Course).hoursPerYear],
        [t('courseType'), (detail as K12Course).courseType],
        [t('learningObjectives'), (detail as K12Course).learningObjectives],
        [t('contentModules'), (detail as K12Course).contentModules],
        [t('keyConcepts'), (detail as K12Course).keyConcepts],
        [t('skillRequirements'), (detail as K12Course).skillRequirements],
        [t('teachingMethods'), (detail as K12Course).teachingMethods],
        [t('assessmentMethods'), (detail as K12Course).assessmentMethods],
        [t('toolsResources'), (detail as K12Course).toolsResources],
      ]
    : []

  const uniDetailFields: Array<[string, FieldValue]> = detail
    ? [
        [t('courseName'), (detail as UniversityCourse).courseName],
        [t('courseType'), (detail as UniversityCourse).courseType],
        [t('targetMajor'), (detail as UniversityCourse).targetMajor],
        [t('credits'), (detail as UniversityCourse).credits],
        [t('hours'), (detail as UniversityCourse).hours],
        [t('university'), (detail as UniversityCourse).university],
        [t('description'), (detail as UniversityCourse).description],
        [t('modules'), (detail as UniversityCourse).modules],
        [t('prerequisites'), (detail as UniversityCourse).prerequisites],
        [t('textbooks'), (detail as UniversityCourse).textbooks],
        [t('teachingTeam'), (detail as UniversityCourse).teachingTeam],
        [t('assessment'), (detail as UniversityCourse).assessment],
        [t('required'), (detail as UniversityCourse).isRequired],
      ]
    : []

  return (
    <div className="space-y-4">
      <BackButton />
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <BookOpen className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      <Tabs value={tab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList>
          <TabsTrigger value="k12">
            <BookOpen className="mr-1.5 h-4 w-4" />
            {t('tabK12')}
          </TabsTrigger>
          <TabsTrigger value="university">
            <GraduationCap className="mr-1.5 h-4 w-4" />
            {t('tabUniversity')}
          </TabsTrigger>
        </TabsList>

        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search')}
            className="h-9 pl-8"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('loading')}
          </div>
        ) : error ? (
          <Alert variant="danger" description={(error as Error).message} />
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(renderListItem)}
            {total > PAGE_SIZE && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {t('page', { page, total: totalPages })}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                    className="rounded border px-2 py-1 disabled:opacity-50"
                  >
                    {t('prev')}
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                    className="rounded border px-2 py-1 disabled:opacity-50"
                  >
                    {t('next')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Tabs>

      <Dialog open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {tab === 'k12'
                ? (detail as K12Course | undefined)?.courseName
                : (detail as UniversityCourse | undefined)?.courseName}
            </DialogTitle>
            <DialogDescription>
              {tab === 'k12' ? t('tabK12') : t('tabUniversity')}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {detailQuery.isLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {t('loading')}
              </div>
            ) : detailQuery.isError ? (
              <Alert variant="danger" description={(detailQuery.error as Error).message} />
            ) : !detail ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                {t('noDetail')}
              </div>
            ) : (
              (tab === 'k12' ? k12DetailFields : uniDetailFields).map(([label, value]) =>
                renderField(label, value),
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
