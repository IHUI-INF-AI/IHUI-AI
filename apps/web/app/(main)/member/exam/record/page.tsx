'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Award,
  FileText,
  CheckCircle,
  XCircle,
} from 'lucide-react'

import { getMyRecords, getResult, type ExamResult, type ExamResultDetail } from '@/lib/exam-api'
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@ihui/ui'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface RecordRow {
  id: string
  examId: string
  score: number
  totalScore: number
  isPassed: boolean
  submittedAt: string
  examTitle?: string | null
}

interface RecordsData {
  list: RecordRow[]
  total: number
}

const PAGE_SIZE = 10

export default function MemberExamRecordPage() {
  const locale = useLocale()
  const [page, setPage] = React.useState(1)
  const [detailId, setDetailId] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['member', 'exam', 'records', page],
    queryFn: async () => {
      const r = await getMyRecords({ page, pageSize: PAGE_SIZE })
      if (!r.success) throw new Error(r.error)
      return r.data as unknown as RecordsData
    },
  })

  const detailQ = useQuery({
    queryKey: ['member', 'exam', 'result', detailId],
    queryFn: async () => {
      const r = await getResult(detailId!)
      if (!r.success) throw new Error(r.error)
      return r.data as ExamResult
    },
    enabled: !!detailId,
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
  const detail = detailQ.data

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Award className="h-5 w-5 text-primary" />
          我的考试记录
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">查看历史考试成绩与答卷详情</p>
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
          <Award className="h-8 w-8 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">暂无考试记录</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">考试名称</th>
                <th className="px-3 py-2 font-medium">考试时间</th>
                <th className="px-3 py-2 text-right font-medium">得分</th>
                <th className="px-3 py-2 font-medium">结果</th>
                <th className="px-3 py-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => {
                const passed = !!r.isPassed
                return (
                  <tr key={r.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{r.examTitle ?? r.examId.slice(0, 8)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.submittedAt ? dateFmt.format(new Date(r.submittedAt)) : '-'}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {r.score}
                      <span className="text-xs font-normal text-muted-foreground">
                        {' '}
                        / {r.totalScore}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                          passed
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                            : 'bg-red-500/10 text-red-600 dark:text-red-500',
                        )}
                      >
                        {passed ? (
                          <CheckCircle className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {passed ? '及格' : '不及格'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setDetailId(r.id)}>
                        查看详情
                      </Button>
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

      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              考试成绩详情
            </DialogTitle>
          </DialogHeader>
          {detailQ.isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              加载中...
            </div>
          ) : detailQ.error ? (
            <Alert variant="danger" description={(detailQ.error as Error).message} />
          ) : detail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-md bg-muted/40 px-3 py-2">
                  <div className="text-xs text-muted-foreground">得分</div>
                  <div className="mt-0.5 text-lg font-semibold">
                    {detail.score}
                    <span className="text-xs font-normal text-muted-foreground">
                      {' '}
                      / {detail.totalScore}
                    </span>
                  </div>
                </div>
                <div className="rounded-md bg-muted/40 px-3 py-2">
                  <div className="text-xs text-muted-foreground">答对</div>
                  <div className="mt-0.5 text-lg font-semibold text-emerald-600">
                    {detail.correctCount}
                  </div>
                </div>
                <div className="rounded-md bg-muted/40 px-3 py-2">
                  <div className="text-xs text-muted-foreground">答错</div>
                  <div className="mt-0.5 text-lg font-semibold text-red-600">
                    {detail.wrongCount}
                  </div>
                </div>
                <div className="rounded-md bg-muted/40 px-3 py-2">
                  <div className="text-xs text-muted-foreground">未答</div>
                  <div className="mt-0.5 text-lg font-semibold">{detail.unansweredCount}</div>
                </div>
              </div>
              <div className="max-h-[40vh] overflow-y-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">题目</th>
                      <th className="px-3 py-2 font-medium">得分</th>
                      <th className="px-3 py-2 font-medium">结果</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {detail.details.map((d: ExamResultDetail) => (
                      <tr key={d.questionId} className="hover:bg-muted/30">
                        <td className="px-3 py-2">{d.title}</td>
                        <td className="px-3 py-2">{d.score}</td>
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                              d.isCorrect
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : 'bg-red-500/10 text-red-600',
                            )}
                          >
                            {d.isCorrect ? '正确' : '错误'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
