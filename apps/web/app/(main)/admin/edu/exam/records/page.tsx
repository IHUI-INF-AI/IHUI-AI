'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { eduApi, buildQs } from '@/lib/edu'
import { cn } from '@/lib/utils'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button,
  Input,
} from '@ihui/ui'

interface ExamRecord {
  id: string
  paperId: string
  userId: string
  score: string
  isPassed: boolean
  status: string
  submittedAt: string | null
}
interface PageData<T> {
  list: T[]
  total: number
}
interface Paper {
  id: string
  title: string
}

const PAGE_SIZE = 10

const STATUS_CLS: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  submitted: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  graded: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
}

function RecordsContent() {
  const t = useTranslations('admin.edu.exam.records')
  const router = useRouter()
  const sp = useSearchParams()
  const search = sp.get('search') ?? ''
  const [page, setPage] = React.useState(1)

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'exam', 'records', page, search],
    queryFn: () =>
      eduApi<PageData<ExamRecord>>(
        `/api/admin/exam/records${buildQs({ page, pageSize: PAGE_SIZE, search })}`,
      ),
  })
  const { data: papersData } = useQuery({
    queryKey: ['edu', 'exam', 'papers', 'all'],
    queryFn: () => eduApi<{ list: Paper[] }>(`/api/admin/exam/papers?page=1&pageSize=100`),
  })
  const paperMap = React.useMemo(() => {
    const m = new Map<string, string>()
    for (const p of papersData?.list ?? []) m.set(p.id, p.title)
    return m
  }, [papersData])

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const records = data?.list ?? []

  function onSearch(v: string) {
    const p = new URLSearchParams(sp.toString())
    if (v) p.set('search', v)
    else p.delete('search')
    setPage(1)
    router.replace(`/admin/edu/exam/records?${p.toString()}`)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu/exam">
            <ChevronLeft className="h-4 w-4" />
            {t('backToExam')}
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/edu/exam/grades">{t('gradesReview')}</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/edu/exam/ranking">{t('ranking')}</Link>
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
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noRecords')}
                </TableCell>
              </TableRow>
            ) : (
              records.map((r) => {
                const cls = STATUS_CLS[r.status] ?? 'bg-muted text-muted-foreground'
                return (
                  <TableRow key={r.id} className="hover:bg-muted/30">
                    <TableCell className="px-4 py-2.5 font-mono text-xs">
                      {r.userId.slice(0, 8)}…
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      {paperMap.get(r.paperId) ?? t('unknownPaper')}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 font-medium">{Number(r.score)}</TableCell>
                    <TableCell className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                          r.isPassed
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-500',
                        )}
                      >
                        {r.isPassed ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {r.isPassed ? t('passed') : t('notPassed')}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          cls,
                        )}
                      >
                        {t(`status.${r.status}`)}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                      {r.submittedAt ?? '-'}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('totalItems', { count: total })}</span>
        <div className="flex items-center gap-2">
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="h-9 w-48"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            {t('prevPage')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('pageInfo', { page, totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('nextPage')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function EduExamRecordsPage() {
  const t = useTranslations('admin.edu.exam.records')
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
