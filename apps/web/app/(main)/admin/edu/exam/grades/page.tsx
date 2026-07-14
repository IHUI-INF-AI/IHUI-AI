'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft } from 'lucide-react'
import { eduApi, buildQs } from '@/lib/edu'
import { Button } from '@ihui/ui'

import { GradesTable } from './GradesTable'
import { GradesDialog } from './GradesDialog'
import { PAGE_SIZE } from './helpers'
import type { MarkRecord, PageData, RecordDetail } from './types'

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
    queryFn: () => eduApi<RecordDetail>(`/api/admin/exam/records/${gradeId}`),
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

  function closeDialog() {
    setGradeId(null)
    setGrades({})
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
          <Link href="/admin/edu/exam/records">{t('records')}</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/edu/exam/ranking">{t('ranking')}</Link>
        </Button>
      </div>

      <GradesTable records={records} isLoading={isLoading} error={error} onGrade={setGradeId} />

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

      <GradesDialog
        open={!!gradeId}
        subjectiveQs={subjectiveQs}
        grades={grades}
        setGrades={setGrades}
        pending={gradeMut.isPending}
        onClose={closeDialog}
        onSubmit={() => gradeMut.mutate()}
      />
    </div>
  )
}
