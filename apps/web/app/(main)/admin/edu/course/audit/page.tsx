'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { eduApi, buildQs, type PageData } from '@/lib/edu'
import { exportFromApi } from '@/lib/export-utils'
import { Button } from '@ihui/ui'

import { CourseAuditFilter } from './CourseAuditFilter'
import { CourseAuditTable } from './CourseAuditTable'
import { CourseAuditDialog } from './CourseAuditDialog'
import { PAGE_SIZE, EXPORT_COLS, EMPTY_SEARCH } from './helpers'
import type { Audit, CompareData, CourseAuditSearch, Snapshot } from './types'

export default function EduCourseAuditPage() {
  const t = useTranslations('admin.edu.course.audit')
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [q, setQ] = React.useState<CourseAuditSearch>(EMPTY_SEARCH)
  const [compareOpen, setCompareOpen] = React.useState(false)
  const [compareType, setCompareType] = React.useState(0)
  const [compareData, setCompareData] = React.useState<CompareData>({ before: {}, after: {} })
  const [compareRemark, setCompareRemark] = React.useState('')
  const [currentId, setCurrentId] = React.useState<string | null>(null)
  const [loadingCompare, setLoadingCompare] = React.useState(false)

  const params = { page, pageSize: PAGE_SIZE, ...q }
  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'course-audit', params],
    queryFn: () => eduApi<PageData<Audit>>(`/api/admin/course-audit${buildQs(params)}`),
  })
  const auditMut = useMutation({
    mutationFn: (args: { id: string; status: number; remark: string }) =>
      eduApi(`/api/admin/course-audit/${args.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: args.status, remark: args.remark }),
      }),
    onSuccess: (_d, vars) => {
      toast.success(vars.status === 3 ? t('approveSuccess') : t('rectifySuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'course-audit'] })
      closeCompare()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  async function openCompare(r: Audit) {
    setCurrentId(r.id)
    setCompareType(r.type)
    setCompareRemark(r.remark ?? '')
    setCompareData({ before: {}, after: {} })
    setCompareOpen(true)
    setLoadingCompare(true)
    try {
      let before: Snapshot = {}
      let after: Snapshot = {}
      if (r.type === 0) {
        before = await eduApi<Snapshot>(`/api/admin/courses/${r.sourceId}`)
        after = await eduApi<Snapshot>(`/api/admin/courses/temp/${r.targetId}`)
      } else {
        before = await eduApi<Snapshot>(`/api/admin/course-videos/${r.sourceId}`)
        after = await eduApi<Snapshot>(`/api/admin/course-videos/temp/${r.targetId}`)
      }
      setCompareData({ before, after })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('loadCompareFailed'))
    } finally {
      setLoadingCompare(false)
    }
  }
  function closeCompare() {
    if (auditMut.isPending) return
    setCompareOpen(false)
    setCompareData({ before: {}, after: {} })
    setCompareRemark('')
    setCurrentId(null)
  }
  function approve() {
    if (currentId) auditMut.mutate({ id: currentId, status: 3, remark: compareRemark })
  }
  function rectify() {
    if (!compareRemark.trim()) return toast.warning(t('remarkRequired'))
    if (currentId) auditMut.mutate({ id: currentId, status: 1, remark: compareRemark })
  }
  function handleExport() {
    exportFromApi(
      `/api/admin/course-audit${buildQs({ ...q, pageSize: 10000 })}`,
      `courseAudit_${Date.now()}`,
      EXPORT_COLS,
    ).then((ok) => toast[ok ? 'success' : 'error'](ok ? t('exportSuccess') : t('exportFailed')))
  }
  function patchQ(patch: Partial<CourseAuditSearch>) {
    setQ((s) => ({ ...s, ...patch }))
    setPage(1)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <CourseAuditFilter
        q={q}
        onQChange={patchQ}
        onReset={() => {
          setQ(EMPTY_SEARCH)
          setPage(1)
        }}
        onExport={handleExport}
      />
      <CourseAuditTable list={rows} isLoading={isLoading} error={error} onAudit={openCompare} />
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('totalItems', { count: total })}</span>
        <div className="flex items-center gap-2">
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
      <CourseAuditDialog
        open={compareOpen}
        compareType={compareType}
        compareData={compareData}
        loadingCompare={loadingCompare}
        compareRemark={compareRemark}
        onRemarkChange={setCompareRemark}
        pending={auditMut.isPending}
        onApprove={approve}
        onRectify={rectify}
        onClose={closeCompare}
      />
    </div>
  )
}
