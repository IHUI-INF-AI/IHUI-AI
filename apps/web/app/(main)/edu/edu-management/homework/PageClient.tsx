'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  BarChart3,
  Users,
  BookOpen,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { fetchApi } from '@/lib/api'
import { BackButton } from '@/components/common'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Label,
  Badge,
} from '@ihui/ui-react'

/* ─── Types ─── */

interface Term {
  id: string
  name: string
  startDate: string
  endDate: string
  isCurrent: boolean
}

interface EduClass {
  id: string
  name: string
  grade: string | null
}

interface HomeworkSubmission {
  id: string
  studentId: string
  studentName: string
  classId: string
  content: string
  status: 'submitted' | 'graded' | 'late' | 'resubmit'
  score: number | null
  comment: string | null
  submittedAt: string
  gradedAt: string | null
  gradedBy: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

interface HomeworkStats {
  totalSubmissions: number
  gradedCount: number
  averageScore: number
  completionRate: number
}

/* ─── API helper ─── */

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

/* ─── Constants ─── */

const SUBMISSION_STATUS = [
  { value: 'submitted', label: '已提交', color: 'bg-blue-500 text-white' },
  { value: 'graded', label: '已批改', color: 'bg-green-500 text-white' },
  { value: 'late', label: '迟交', color: 'bg-orange-500 text-white' },
  { value: 'resubmit', label: '待重交', color: 'bg-purple-500 text-white' },
] as const

const SUBMISSION_STATUS_MAP = new Map(SUBMISSION_STATUS.map((s) => [s.value, s.label]))
const SUBMISSION_COLOR_MAP = new Map(SUBMISSION_STATUS.map((s) => [s.value, s.color]))

/* ─── Grade Dialog ─── */

function GradeDialog({
  open,
  onOpenChange,
  submission,
  onSave,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  submission: HomeworkSubmission | null
  onSave: (id: string, score: number, comment: string) => Promise<void>
}) {
  const [score, setScore] = React.useState(0)
  const [comment, setComment] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (submission) {
      setScore(submission.score ?? 0)
      setComment(submission.comment ?? '')
    } else {
      setScore(0)
      setComment('')
    }
  }, [submission, open])

  const handleSave = async () => {
    if (!submission) return
    setSaving(true)
    try {
      await onSave(submission.id, score, comment)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>批改作业</DialogTitle>
        </DialogHeader>
        {submission && (
          <div className="space-y-3 py-2">
            <div className="rounded-md border p-3 text-sm space-y-1">
              <p><span className="text-muted-foreground">学生：</span>{submission.studentName}</p>
              <p><span className="text-muted-foreground">内容：</span>{submission.content}</p>
              <p><span className="text-muted-foreground">提交时间：</span>{new Date(submission.submittedAt).toLocaleString('zh-CN')}</p>
            </div>
            <div className="grid gap-1.5">
              <Label>分数</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={score}
                onChange={(e) => setScore(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>评语</Label>
              <Input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="可选，批改评语"
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            提交批改
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Main Page ─── */

export default function HomeworkPage() {
  const queryClient = useQueryClient()

  /* ── State ── */
  const [selectedTermId, setSelectedTermId] = React.useState('')
  const [selectedClassId, setSelectedClassId] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('')
  const [gradeOpen, setGradeOpen] = React.useState(false)
  const [gradingSubmission, setGradingSubmission] = React.useState<HomeworkSubmission | null>(null)

  /* ── Queries ── */
  const { data: termsData } = useQuery({
    queryKey: ['edu-ai-management', 'term'],
    queryFn: () => api<{ list: Term[] }>('/api/edu-ai-management/term'),
  })
  const terms = React.useMemo(() => termsData?.list ?? [], [termsData])

  React.useEffect(() => {
    if (terms.length > 0 && !selectedTermId) {
      const current = terms.find((t) => t.isCurrent)
      setSelectedTermId(current?.id ?? terms[0]!.id)
    }
  }, [terms, selectedTermId])

  const { data: classesData } = useQuery({
    queryKey: ['edu-ai-management', 'class', selectedTermId],
    queryFn: () => api<{ list: EduClass[] }>(`/api/edu-ai-management/class?termId=${selectedTermId}`),
    enabled: !!selectedTermId,
  })
  const classes = React.useMemo(() => classesData?.list ?? [], [classesData])

  React.useEffect(() => {
    if (classes.length > 0 && !selectedClassId) {
      setSelectedClassId(classes[0]!.id)
    }
  }, [classes, selectedClassId])

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['edu-ai-management', 'homework-submission', 'stats', selectedClassId],
    queryFn: () => api<HomeworkStats>(`/api/edu-ai-management/homework-submission/stats?classId=${selectedClassId}`),
    enabled: !!selectedClassId,
  })

  const { data: submissionsData, isLoading: submissionsLoading } = useQuery({
    queryKey: ['edu-ai-management', 'homework-submission', selectedClassId, statusFilter],
    queryFn: () => {
      let url = `/api/edu-ai-management/homework-submission?classId=${selectedClassId}`
      if (statusFilter) url += `&status=${statusFilter}`
      return api<{ list: HomeworkSubmission[] }>(url)
    },
    enabled: !!selectedClassId,
  })
  const submissions = (submissionsData?.list ?? []).filter((s) => !s.deletedAt)

  /* ── Mutations ── */
  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['edu-ai-management', 'homework-submission'] })
  }, [queryClient])

  const gradeMutation = useMutation({
    mutationFn: ({ id, score, comment }: { id: string; score: number; comment: string }) =>
      api(`/api/edu-ai-management/homework-submission/${id}/grade`, {
        method: 'PUT',
        body: JSON.stringify({ score, comment: comment || null }),
      }),
    onSuccess: invalidate,
  })

  /* ── Handlers ── */
  const handleGrade = async (id: string, score: number, comment: string) => {
    await gradeMutation.mutateAsync({ id, score, comment })
  }

  /* ── Stats cards ── */
  const statsCards = [
    { label: '总提交数', value: statsData?.totalSubmissions ?? '-', icon: FileText, color: 'text-blue-600' },
    { label: '已批改数', value: statsData?.gradedCount ?? '-', icon: CheckCircle2, color: 'text-green-600' },
    { label: '平均分', value: statsData?.averageScore != null ? `${statsData.averageScore}分` : '-', icon: BarChart3, color: 'text-purple-600' },
    { label: '完成率', value: statsData?.completionRate != null ? `${statsData.completionRate}%` : '-', icon: Users, color: 'text-orange-600' },
  ]

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />

      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">作业管理</h1>
        <p className="text-xs text-muted-foreground">管理学生作业提交、批改和评分</p>
      </header>

      {/* Class Selector */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedTermId} onValueChange={(v) => { setSelectedTermId(v); setSelectedClassId('') }}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="选择学期" />
              </SelectTrigger>
              <SelectContent>
                {terms.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}{t.isCurrent ? ' (当前)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <Select
              value={selectedClassId}
              onValueChange={(v) => { setSelectedClassId(v) }}
              disabled={!selectedTermId || classes.length === 0}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="选择班级" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}{c.grade ? ` (${c.grade})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      {selectedClassId && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {statsCards.map((card) => {
            const Icon = card.icon
            return (
              <Card key={card.label}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Icon className={cn('h-4 w-4', card.color)} />
                    <span className="text-xs text-muted-foreground">{card.label}</span>
                  </div>
                  <p className="mt-1 text-2xl font-bold">
                    {statsLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : (
                      card.value
                    )}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Submissions List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">作业提交</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-8 w-32">
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                {SUBMISSION_STATUS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {submissionsLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!selectedClassId ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertCircle className="mb-2 h-8 w-8" />
              <p className="text-sm">请先选择班级</p>
            </div>
          ) : submissionsLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              加载作业提交...
            </div>
          ) : submissions.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              暂无作业提交
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">学生姓名</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">作业内容</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">提交时间</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">状态</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">分数</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">评语</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s) => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 text-xs font-medium">{s.studentName}</td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-xs" title={s.content}>
                        {s.content}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {new Date(s.submittedAt).toLocaleString('zh-CN', {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="secondary"
                          className={cn('text-[10px] text-white', SUBMISSION_COLOR_MAP.get(s.status) ?? 'bg-gray-500')}
                        >
                          {SUBMISSION_STATUS_MAP.get(s.status) ?? s.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium">
                        {s.score != null ? (
                          <span className={cn(s.score >= 60 ? 'text-green-600' : 'text-red-600')}>
                            {s.score}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="max-w-[120px] truncate px-4 py-3 text-xs text-muted-foreground" title={s.comment ?? ''}>
                        {s.comment ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {s.status !== 'graded' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => { setGradingSubmission(s); setGradeOpen(true) }}
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            批改
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grade Dialog */}
      <GradeDialog
        open={gradeOpen}
        onOpenChange={setGradeOpen}
        submission={gradingSubmission}
        onSave={handleGrade}
      />
    </div>
  )
}