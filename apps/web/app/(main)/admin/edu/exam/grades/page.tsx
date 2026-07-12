'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, ChevronLeft, ClipboardList, CheckCircle2, Save } from 'lucide-react'
import { eduApi, buildQs, selectClass } from '@/lib/edu'
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
  DialogFooter,
  Button,
  Input,
  Label,
} from '@ihui/ui'

interface MarkRecord {
  id: string
  paperId: string
  paperTitle?: string
  userId: string
  userName?: string
  score: string
  status: string
  submittedAt: string | null
}
interface PageData<T> {
  list: T[]
  total: number
}
interface Question {
  id: string
  type: string
  title: string
  score: string
}

const PAGE_SIZE = 10

export default function EduExamGradesPage() {
  const t = useTranslations('admin.edu.exam.grades')
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [gradeId, setGradeId] = React.useState<string | null>(null)
  const [grades, setGrades] = React.useState<Record<string, string>>({})

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'exam', 'pending-marks', page],
    queryFn: () =>
      eduApi<PageData<MarkRecord>>(
        `/api/exam/records/pending-marks${buildQs({ page, pageSize: PAGE_SIZE })}`,
      ),
  })

  const { data: detail } = useQuery({
    queryKey: ['edu', 'exam', 'record', gradeId],
    queryFn: () =>
      eduApi<{
        record: {
          id: string
          paperId: string
          answers: Array<{ questionId: string; answer: unknown }>
        }
        questions: Question[]
      }>(`/api/admin/exam/records/${gradeId}`),
    enabled: !!gradeId,
  })

  const gradeMut = useMutation({
    mutationFn: () => {
      const arr = Object.entries(grades).map(([questionId, score]) => ({
        questionId,
        score: Number(score) || 0,
      }))
      return eduApi(`/api/admin/exam/records/${gradeId}/grade`, {
        method: 'POST',
        body: JSON.stringify({ grades: arr }),
      })
    },
    onSuccess: () => {
      toast.success(t('gradeSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'exam', 'pending-marks'] })
      setGradeId(null)
      setGrades({})
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const records = data?.list ?? []
  const subjectiveQs = React.useMemo(
    () => (detail?.questions ?? []).filter((q) => q.type === 'subjective'),
    [detail],
  )

  React.useEffect(() => {
    if (gradeId && detail) {
      const init: Record<string, string> = {}
      for (const q of subjectiveQs) init[q.id] = ''
      setGrades(init)
    }
  }, [gradeId, detail, subjectiveQs])

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
          <Link href="/admin/edu/exam/records">{t('records')}</Link>
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
              <TableHead className="px-4 py-2.5">{t('colSubmittedAt')}</TableHead>
              <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noData')}
                </TableCell>
              </TableRow>
            ) : (
              records.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5">
                    {r.userName ?? r.userId.slice(0, 8)}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    {r.paperTitle ?? r.paperId.slice(0, 8)}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 font-medium">{Number(r.score)}</TableCell>
                  <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                    {r.submittedAt ?? '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setGradeId(r.id)}
                      title={t('grade')}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {t('grade')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('totalItems', { total })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t('prev')}
          </Button>
          <span className="text-sm text-muted-foreground">{t('pageOf', { page, totalPages })}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('next')}
          </Button>
        </div>
      </div>

      <Dialog
        open={!!gradeId}
        onOpenChange={(o) => {
          if (!o) {
            setGradeId(null)
            setGrades({})
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('dialogTitle')}</DialogTitle>
          </DialogHeader>
          {subjectiveQs.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {t('noSubjective')}
            </div>
          ) : (
            <div className="space-y-3">
              {subjectiveQs.map((q, idx) => (
                <div key={q.id} className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">
                    {t('subjectiveInfo', { index: idx + 1, score: Number(q.score) })}
                  </div>
                  <div className="mt-1 text-sm font-medium">{q.title}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <Label htmlFor={`g-${q.id}`} className="text-xs">
                      {t('fieldScore')}
                    </Label>
                    <Input
                      id={`g-${q.id}`}
                      type="number"
                      min="0"
                      max={Number(q.score)}
                      step="0.5"
                      className={cn(selectClass, 'h-8 max-w-[120px]')}
                      value={grades[q.id] ?? ''}
                      onChange={(e) => setGrades({ ...grades, [q.id]: e.target.value })}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setGradeId(null)
                setGrades({})
              }}
            >
              {t('cancel')}
            </Button>
            <Button onClick={() => gradeMut.mutate()} disabled={gradeMut.isPending}>
              {gradeMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Save className="h-4 w-4" />
              {t('submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
