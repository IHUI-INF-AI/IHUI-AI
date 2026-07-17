'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
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

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  pending: { label: '待考', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-500' },
  attended: { label: '已考', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' },
  canceled: { label: '已取消', cls: 'bg-muted text-muted-foreground' },
}

function statusOf(s: string) {
  return STATUS_CFG[s] ?? { label: s || '未知', cls: 'bg-muted text-muted-foreground' }
}

export default function MemberExamSignUpPage() {
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
        toast.success('已取消报名')
        qc.invalidateQueries({ queryKey: ['member', 'exam', 'signups'] })
      } else {
        toast.error(r.error || '取消失败')
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
    if (!window.confirm('确认取消该考试报名?')) return
    cancelMut.mutate(examId)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <ClipboardList className="h-5 w-5 text-primary" />
          我的考试报名
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">查看已报名的考试并管理报名状态</p>
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <ClipboardList className="h-8 w-8 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">暂无报名记录</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">考试名称</th>
                <th className="px-3 py-2 font-medium">报名时间</th>
                <th className="px-3 py-2 font-medium">考试时间</th>
                <th className="px-3 py-2 font-medium">状态</th>
                <th className="px-3 py-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => {
                const sc = statusOf(r.status)
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
                          sc.cls,
                        )}
                      >
                        {sc.label}
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
                          取消报名
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
          <span className="text-xs text-muted-foreground">共 {total} 条</span>
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
