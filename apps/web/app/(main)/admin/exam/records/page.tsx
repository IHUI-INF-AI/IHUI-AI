'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import {
  Eye,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CheckCircle2,
  XCircle,
  Search,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
} from '@ihui/ui'

type QuestionType =
  | 'single_choice'
  | 'multi_choice'
  | 'judgment'
  | 'fill_blank'
  | 'subjective'

interface ExamPaper {
  id: string
  title: string
}

interface GradedAnswer {
  questionId: string
  answer: unknown
  isCorrect: boolean
  score: number
}

interface ExamRecord {
  id: string
  paperId: string
  userId: string
  answers: GradedAnswer[] | null
  score: string
  isPassed: boolean
  status: string
  startedAt: string
  submittedAt: string | null
  duration: number
  createdAt: string
}

interface RecordsData {
  list: ExamRecord[]
  total: number
  page: number
  pageSize: number
}

interface Question {
  id: string
  paperId: string
  type: QuestionType
  title: string
  options: unknown
  score: string
  sortOrder: number
  answer?: unknown
  analysis?: string | null
}

interface RecordDetail {
  record: ExamRecord
  questions: Question[]
}

const PAGE_SIZE = 10

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function formatAnswer(ans: unknown): string {
  if (ans === undefined || ans === null || ans === '') return '-'
  if (typeof ans === 'string') return ans
  try {
    return JSON.stringify(ans)
  } catch {
    return String(ans)
  }
}

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations('admin.exam')
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: t('statusPending'), cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
    submitted: { label: t('statusSubmitted'), cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
    graded: { label: t('statusGraded'), cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  }
  const item = map[status] ?? { label: status, cls: 'bg-muted text-muted-foreground' }
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', item.cls)}>
      {item.label}
    </span>
  )
}

function RecordsContent() {
  const t = useTranslations('admin.exam')
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const search = searchParams.get('search') ?? ''
  const [page, setPage] = React.useState(1)
  const [detailId, setDetailId] = React.useState<string | null>(null)

  const typeLabel: Record<QuestionType, string> = {
    single_choice: t('typeSingle'),
    multi_choice: t('typeMulti'),
    judgment: t('typeJudgment'),
    fill_blank: t('typeFill'),
    subjective: t('typeSubjective'),
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'exam', 'records', page, search],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (search) qs.set('search', search)
      return api<RecordsData>(`/api/admin/exam/records?${qs.toString()}`)
    },
  })

  // 拉取试卷列表用于 paperId -> title 映射
  const { data: papersData } = useQuery({
    queryKey: ['admin', 'exam', 'papers', 'all'],
    queryFn: () =>
      api<{ list: ExamPaper[] }>(`/api/admin/exam/papers?page=1&pageSize=100`),
  })
  const paperMap = React.useMemo(() => {
    const m = new Map<string, string>()
    for (const p of papersData?.list ?? []) m.set(p.id, p.title)
    return m
  }, [papersData])

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['admin', 'exam', 'records', 'detail', detailId],
    queryFn: () => api<RecordDetail>(`/api/admin/exam/records/${detailId}`),
    enabled: !!detailId,
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const records = data?.list ?? []
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const detailRecord = detail?.record
  const detailQuestions = detail?.questions ?? []
  const answerMap = React.useMemo(() => {
    const m = new Map<string, GradedAnswer>()
    const detailAnswers = detailRecord?.answers ?? []
    for (const a of detailAnswers) m.set(a.questionId, a)
    return m
  }, [detailRecord])

  function onSearchChange(v: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (v) params.set('search', v)
    else params.delete('search')
    setPage(1)
    router.replace(`/admin/exam/records?${params.toString()}`)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('recordsTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('recordsSubtitle')}</p>
      </div>

      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/exam">
            <ChevronLeft className="h-4 w-4" />
            {t('backToExam')}
          </Link>
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">{t('colUser')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colPaper')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colScore')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colPassed')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colSubmittedAt')}</TableHead>
              <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noData')}
                </TableCell>
              </TableRow>
            ) : (
              records.map((r) => {
                const passed = r.isPassed
                return (
                  <TableRow key={r.id} className="hover:bg-muted/30">
                    <TableCell className="px-4 py-2.5">
                      <span className="font-mono text-xs text-muted-foreground" title={r.userId}>
                        {r.userId.slice(0, 8)}…
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs truncate px-4 py-2.5">
                      {paperMap.get(r.paperId) ?? t('unknownPaper')}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 font-medium">{Number(r.score)}</TableCell>
                    <TableCell className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                          passed
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-500',
                        )}
                      >
                        {passed ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {passed ? t('passed') : t('failed')}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                      {r.submittedAt ? dateFmt.format(new Date(r.submittedAt)) : '-'}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDetailId(r.id)}
                        title={t('detail')}
                      >
                        <Eye className="h-4 w-4" />
                        {t('detail')}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {t('total', { total })}
        </span>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="h-9 w-56 pl-8"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            {t('prev')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('page', { page, total: totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('next')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog
        open={!!detailId}
        onOpenChange={(o) => {
          if (!o) setDetailId(null)
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('detailTitle')}</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t('loading')}
            </div>
          ) : detailRecord ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 rounded-md bg-muted/40 px-3 py-3 text-sm sm:grid-cols-4">
                <div>
                  <div className="text-xs text-muted-foreground">{t('colScore')}</div>
                  <div className="mt-0.5 font-medium">{Number(detailRecord.score)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t('colPassed')}</div>
                  <div
                    className={cn(
                      'mt-0.5 font-medium',
                      detailRecord.isPassed ? 'text-emerald-600' : 'text-rose-600',
                    )}
                  >
                    {detailRecord.isPassed ? t('passed') : t('failed')}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t('fieldDuration')}</div>
                  <div className="mt-0.5 font-medium">
                    {Math.floor(detailRecord.duration / 60)}{t('minutes')} {detailRecord.duration % 60}s
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t('colSubmittedAt')}</div>
                  <div className="mt-0.5 font-medium">
                    {detailRecord.submittedAt ? dateFmt.format(new Date(detailRecord.submittedAt)) : '-'}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {detailQuestions.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">{t('noData')}</div>
                ) : (
                  detailQuestions.map((q, idx) => {
                    const ans = answerMap.get(q.id)
                    const isSubjective = q.type === 'subjective'
                    return (
                      <div key={q.id} className="rounded-md border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="text-xs text-muted-foreground">
                              {idx + 1}. {typeLabel[q.type]} · {t('fieldScore')} {Number(q.score)}
                            </div>
                            <div className="mt-1 text-sm font-medium">{q.title}</div>
                          </div>
                          {ans && !isSubjective ? (
                            <span
                              className={cn(
                                'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                                ans.isCorrect
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-500',
                              )}
                            >
                              {ans.isCorrect ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                              {ans.isCorrect ? t('correct') : t('incorrect')}
                            </span>
                          ) : null}
                          {isSubjective ? (
                            <span className="inline-flex shrink-0 items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                              {t('pendingGrade')}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2 text-sm">
                          <span className="text-muted-foreground">{t('fieldYourAnswer')}: </span>
                          <span className="font-mono">{ans ? formatAnswer(ans.answer) : '-'}</span>
                        </div>
                        {ans ? (
                          <div className="mt-1 text-sm">
                            <span className="text-muted-foreground">{t('fieldScore')}: </span>
                            <span className="font-medium">{ans.score}</span>
                          </div>
                        ) : null}
                      </div>
                    )
                  })
                )}
              </div>

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setDetailId(null)}>
                  {t('close')}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function AdminExamRecordsPage() {
  const t = useTranslations('admin.exam')
  return (
    <React.Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      }
    >
      <RecordsContent />
    </React.Suspense>
  )
}
