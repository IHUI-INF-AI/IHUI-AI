'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ClipboardList, Loader2, ChevronLeft, ChevronRight, CalendarClock } from 'lucide-react'

import { getMySignUps, cancelSignUp } from '@/lib/exam-api'
import { Button } from '@ihui/ui'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface SignUpRow {
  id: string
  examId: string
  status: string
  signedAt: string
  examTitle?: string | null
  examStartTime?: string | null
  examEndTime?: string | null
}

interface SignUpsData {
  list: SignUpRow[]
  total: number
}

const PAGE_SIZE = 10

const STATUS_CLS: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  attended: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  canceled: 'bg-muted text-muted-foreground',
}

function statusClsOf(s: string) {
  return STATUS_CLS[s] ?? 'bg-muted text-muted-foreground'
}

export default function MemberExamSignUpPage() {
  const t = useTranslations('memberExamSignUpPage')
  const locale = useLocale()
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)

  const { data, isLoading, error } = useQuery({
    queryKey: ['member', 'exam', 'signups', page],
    queryFn: async () => {
      const r = await getMySignUps({ page, pageSize: PAGE_SIZE })
      if (!r.success) throw new Error(r.error)
      return r.data as SignUpsData
    },
  })

  const cancelMut = useMutation({
    mutationFn: (examId: string) => cancelSignUp(examId),
    onSuccess: (r) => {
      if (r.success) {
        toast.success(t('cancelSuccess'))
        qc.invalidateQueries({ queryKey: ['member', 'exam', 'signups'] })
      } else {
        toast.error(r.error || t('cancelFailed'))
      }
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const rows = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  function handleCancel(examId: string) {
    if (!window.confirm(t('cancelConfirm'))) return
    cancelMut.mutate(examId)
  }

  function statusLabel(s: string) {
    if (s === 'pending' || s === 'attended' || s === 'canceled') {
      return t(`status.${s}`)
    }
    return s || t('status.unknown')
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <ClipboardList className="h-5 w-5 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <ClipboardList className="h-8 w-8 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">{t('columns.examName')}</th>
                <th className="px-3 py-2 font-medium">{t('columns.signedAt')}</th>
                <th className="px-3 py-2 font-medium">{t('columns.examTime')}</th>
                <th className="px-3 py-2 font-medium">{t('columns.status')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('columns.action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => {
                const sc = statusClsOf(r.status)
                const canCancel = r.status === 'pending'
                return (
                  <tr key={r.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{r.examTitle ?? r.examId.slice(0, 8)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.signedAt ? dateFmt.format(new Date(r.signedAt)) : '-'}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.examStartTime ? (
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" />
                          {dateFmt.format(new Date(r.examStartTime))}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                          sc,
                        )}
                      >
                        {statusLabel(r.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {canCancel ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={cancelMut.isPending}
                          onClick={() => handleCancel(r.examId)}
                        >
                          {t('cancelBtn')}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{t('total', { n: total })}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
