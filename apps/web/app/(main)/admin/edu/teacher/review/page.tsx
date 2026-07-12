'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Loader2, ChevronLeft, ShieldCheck, Check, X } from 'lucide-react'
import { eduApi, buildQs, type PageData } from '@/lib/edu'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '@ihui/ui'

interface Applicant {
  id: string
  nickname: string
  phone: string | null
  title: string
  intro: string | null
  appliedAt: string
  status: string
  reviewNote: string | null
}

const PAGE_SIZE = 10

export default function EduTeacherReviewPage() {
  const t = useTranslations('admin.edu.teacher.review')
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'teacher', 'review', page],
    queryFn: () =>
      eduApi<PageData<Applicant>>(
        `/api/admin/users${buildQs({ page, pageSize: PAGE_SIZE, role: 'teacher', status: 'pending' })}`,
      ),
    retry: false,
  })

  const reviewMut = useMutation({
    mutationFn: ({ id, approved }: { id: string; approved: boolean }) =>
      eduApi(`/api/admin/users/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ approved }),
      }),
    onSuccess: (_d, vars) => {
      toast.success(vars.approved ? t('approveSuccess') : t('rejectSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'teacher', 'review'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []
  const noEndpoint = !!(error as Error) && (error as Error).message.includes('请求失败')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu/teacher">
            <ChevronLeft className="h-4 w-4" />
            {t('backToTeacher')}
          </Link>
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">{t('colApplicant')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colTitle')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colIntro')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colAppliedAt')}</TableHead>
              <TableHead className="px-4 py-2.5 text-right">{t('colAction')}</TableHead>
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
            ) : noEndpoint ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <ShieldCheck className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('endpointNotConfigured')}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <ShieldCheck className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noApplicants')}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((a) => (
                <TableRow key={a.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5">
                    <div className="font-medium">{a.nickname}</div>
                    {a.phone && <div className="text-xs text-muted-foreground">{a.phone}</div>}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">{a.title}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <div className="max-w-xs break-words text-xs text-muted-foreground">
                      {a.intro ?? '-'}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                    {a.appliedAt}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => reviewMut.mutate({ id: a.id, approved: true })}
                        disabled={reviewMut.isPending}
                        className="text-emerald-600 hover:text-emerald-700"
                      >
                        <Check className="h-4 w-4" />
                        {t('approve')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => reviewMut.mutate({ id: a.id, approved: false })}
                        disabled={reviewMut.isPending}
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                        {t('reject')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('totalItems', { count: total })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
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
          </Button>
        </div>
      </div>
    </div>
  )
}
