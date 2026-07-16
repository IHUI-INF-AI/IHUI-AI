'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Search, ClipboardList, Save, CheckCircle2, XCircle } from 'lucide-react'
import { eduApi, buildQs } from '@/lib/edu'
import { cn } from '@/lib/utils'
import {
  Button,
  Input,
  Label,
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
} from '@ihui/ui'

interface MarkRecord {
  id: string
  userId: string
  nickname: string | null
  paperId: string
  paperTitle: string | null
  score: string
  totalScore: string | null
  passScore: string | null
  status: string
  answers: Array<{ questionId: string; answer: unknown; isCorrect?: boolean }> | null
  submittedAt: string | null
}
interface PageData<T> {
  list: T[]
  total: number
}

const PAGE_SIZE = 15

function StateRow({
  colSpan,
  text,
  icon,
  className,
}: {
  colSpan: number
  text: string
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className={cn('px-3 py-10 text-center text-muted-foreground', className)}
      >
        {icon}
        {text}
      </TableCell>
    </TableRow>
  )
}

export default function ExamMarkingPage() {
  const qc = useQueryClient()
  const [keyword, setKeyword] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [gradeId, setGradeId] = React.useState<string | null>(null)
  const [grades, setGrades] = React.useState<Record<string, { score: string; isCorrect: boolean }>>(
    {},
  )

  const { data, isLoading, error } = useQuery({
    queryKey: ['exam-marking', keyword, page],
    queryFn: () =>
      eduApi<PageData<MarkRecord>>(
        `/api/exam/records/pending-marks${buildQs({
          search: keyword || undefined,
          page,
          pageSize: PAGE_SIZE,
        })}`,
      ),
  })

  const gradeMut = useMutation({
    mutationFn: () => {
      const current = records.find((r) => r.id === gradeId)
      const gradeList = (current?.answers ?? [])
        .filter(
          (a) => grades[a.questionId]?.score !== undefined && grades[a.questionId]?.score !== '',
        )
        .map((a) => ({
          questionId: a.questionId,
          score: Number(grades[a.questionId]?.score ?? 0),
          isCorrect: grades[a.questionId]?.isCorrect ?? false,
        }))
      if (gradeList.length === 0) {
        return Promise.reject(new Error('请至少为一道题评分'))
      }
      return eduApi(`/api/admin/exam/records/${gradeId}/grade`, {
        method: 'POST',
        body: JSON.stringify({ grades: gradeList }),
      })
    },
    onSuccess: () => {
      toast.success('评分成功')
      qc.invalidateQueries({ queryKey: ['exam-marking'] })
      closeDialog()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const records = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const current = records.find((r) => r.id === gradeId)
  const totalInputScore = current?.answers
    ? current.answers.reduce((sum, a) => sum + Number(grades[a.questionId]?.score ?? 0), 0)
    : 0
  const passScore = current?.passScore ? Number(current.passScore) : 0
  const isPassed = passScore > 0 ? totalInputScore >= passScore : false

  function openGrade(r: MarkRecord) {
    setGradeId(r.id)
    setGrades({})
  }
  function closeDialog() {
    setGradeId(null)
    setGrades({})
  }
  function search() {
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">考试答题批阅</h1>
        <div className="flex items-center gap-2">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="学生昵称 / 手机号"
            className="h-9 w-56"
          />
          <Button size="sm" onClick={search}>
            <Search className="h-4 w-4" />
            搜索
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              {['学生', '试卷', '当前得分', '合格分', '提交时间', '操作'].map((h) => (
                <TableHead key={h} className="px-3 py-2.5">
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <StateRow
                colSpan={6}
                icon={<Loader2 className="mr-2 inline h-4 w-4 animate-spin" />}
                text="加载中..."
              />
            ) : error ? (
              <StateRow colSpan={6} className="text-destructive" text={(error as Error).message} />
            ) : records.length === 0 ? (
              <StateRow
                colSpan={6}
                icon={<ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-40" />}
                text="暂无待批阅记录"
              />
            ) : (
              records.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/30">
                  <TableCell className="px-3 py-2.5 font-medium">
                    {r.nickname ?? r.userId.slice(0, 8)}
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    {r.paperTitle ?? r.paperId.slice(0, 8)}
                  </TableCell>
                  <TableCell className="px-3 py-2.5">{r.score}</TableCell>
                  <TableCell className="px-3 py-2.5">{r.passScore ?? '-'}</TableCell>
                  <TableCell className="px-3 py-2.5 text-xs text-muted-foreground">
                    {r.submittedAt ?? '-'}
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0"
                      onClick={() => openGrade(r)}
                    >
                      批改
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </Button>
        </div>
      </div>

      <Dialog open={!!gradeId} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>批改试卷</DialogTitle>
          </DialogHeader>
          {current && (
            <div className="space-y-4">
              <div className="space-y-1 text-sm">
                {(
                  [
                    ['学生', current.nickname ?? current.userId.slice(0, 8)],
                    ['试卷', current.paperTitle ?? '-'],
                    ['合格分数', current.passScore ?? '-'],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-muted-foreground">{k}：</span>
                    <span className="font-medium">{v}</span>
                  </div>
                ))}
              </div>
              {current.answers && current.answers.length > 0 ? (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {current.answers.map((a, idx) => (
                    <div key={a.questionId} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">题目 {idx + 1}</span>
                        <span className="text-xs text-muted-foreground">
                          {a.questionId.slice(0, 8)}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        学生作答：
                        {typeof a.answer === 'string' ? a.answer : JSON.stringify(a.answer)}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`score-${a.questionId}`} className="text-xs">
                            得分
                          </Label>
                          <Input
                            id={`score-${a.questionId}`}
                            type="number"
                            min="0"
                            step="0.5"
                            value={grades[a.questionId]?.score ?? ''}
                            onChange={(e) =>
                              setGrades((g) => ({
                                ...g,
                                [a.questionId]: {
                                  score: e.target.value,
                                  isCorrect: g[a.questionId]?.isCorrect ?? false,
                                },
                              }))
                            }
                            className="h-8 w-24"
                          />
                        </div>
                        <label className="flex items-center gap-1 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={grades[a.questionId]?.isCorrect ?? false}
                            onChange={(e) =>
                              setGrades((g) => ({
                                ...g,
                                [a.questionId]: {
                                  score: g[a.questionId]?.score ?? '',
                                  isCorrect: e.target.checked,
                                },
                              }))
                            }
                          />
                          正确
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">无答题数据</p>
              )}
              <div className="flex items-center gap-2 text-sm border-t pt-3">
                <span className="text-muted-foreground">总得分：</span>
                <span className="font-bold">{totalInputScore}</span>
                <span className="ml-4 text-muted-foreground">判定：</span>
                {totalInputScore === 0 ? (
                  <span className="text-muted-foreground">请评分</span>
                ) : isPassed ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                    通过
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-rose-600">
                    <XCircle className="h-4 w-4" />
                    不通过
                  </span>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog}>
              取消
            </Button>
            <Button type="button" onClick={() => gradeMut.mutate()} disabled={gradeMut.isPending}>
              {gradeMut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              提交评分
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
