'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Loader2,
  School,
  Users,
  ArrowUp,
  ArrowDown,
  Minus,
  TrendingUp,
  Download,
  Camera,
  AlertCircle,
  BarChart3,
  BookOpen,
  Trophy,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import Link from 'next/link'

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

interface EduExamScore {
  id: string
  studentId: string
  classId: string
  subject: string
  examName: string
  score: number
  totalScore: number
  examDate: string
  remark: string | null
  recordedBy: string | null
  createdAt: string
  updatedAt: string
}

interface ScoreStats {
  avgScore: number
  maxScore: number
  minScore: number
  totalCount: number
  passRate: number
  distribution: Array<{ range: string; count: number }>
}

interface RankingEntry {
  studentId: string
  totalScore: number
  examCount: number
  rank: number
}

/* ─── API helper ─── */

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

/* ─── Score Entry Dialog ─── */

interface ScoreFormData {
  studentId: string
  subject: string
  examName: string
  score: number
  totalScore: number
  examDate: string
  remark: string
}

function ScoreEntryDialog({
  open,
  onOpenChange,
  students,
  onSave,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  students: Array<{ id: string; name: string }>
  onSave: (data: ScoreFormData) => Promise<void>
}) {
  const [form, setForm] = React.useState<ScoreFormData>({
    studentId: '',
    subject: '',
    examName: '',
    score: 0,
    totalScore: 100,
    examDate: new Date().toISOString().split('T')[0]!,
    remark: '',
  })
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setForm({
        studentId: students[0]?.id ?? '',
        subject: '',
        examName: '',
        score: 0,
        totalScore: 100,
        examDate: new Date().toISOString().split('T')[0]!,
        remark: '',
      })
    }
  }, [open, students])

  const update = (key: keyof ScoreFormData, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!form.studentId || !form.subject.trim() || !form.examName.trim()) return
    setSaving(true)
    try {
      await onSave(form)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>录入成绩</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>学生</Label>
            <Select value={form.studentId} onValueChange={(v) => update('studentId', v)}>
              <SelectTrigger>
                <SelectValue placeholder="选择学生" />
              </SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>科目</Label>
              <Input
                value={form.subject}
                onChange={(e) => update('subject', e.target.value)}
                placeholder="例如：数学"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>考试名称</Label>
              <Input
                value={form.examName}
                onChange={(e) => update('examName', e.target.value)}
                placeholder="期中考试"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>分数</Label>
              <Input
                type="number"
                min={0}
                value={form.score}
                onChange={(e) => update('score', Number(e.target.value))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>总分</Label>
              <Input
                type="number"
                min={1}
                value={form.totalScore}
                onChange={(e) => update('totalScore', Number(e.target.value))}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>考试日期</Label>
            <Input
              type="date"
              value={form.examDate}
              onChange={(e) => update('examDate', e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>备注</Label>
            <Input
              value={form.remark}
              onChange={(e) => update('remark', e.target.value)}
              placeholder="可选"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={saving || !form.studentId || !form.subject.trim() || !form.examName.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Batch Score Entry ─── */

function BatchScoreEntry({
  students,
  subjects,
  onSave,
}: {
  students: Array<{ id: string; name: string }>
  subjects: string[]
  onSave: (scores: Array<{ studentId: string; subject: string; score: number }>) => Promise<void>
}) {
  const [scores, setScores] = React.useState<Record<string, Record<string, string>>>({})
  const [saving, setSaving] = React.useState(false)

  const updateScore = (studentId: string, subject: string, value: string) => {
    setScores((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] ?? {}), [subject]: value },
    }))
  }

  const handleBatchSave = async () => {
    const entries: Array<{ studentId: string; subject: string; score: number }> = []
    for (const student of students) {
      for (const subject of subjects) {
        const val = scores[student.id]?.[subject]
        if (val !== undefined && val !== '') {
          entries.push({ studentId: student.id, subject, score: Number(val) })
        }
      }
    }
    if (entries.length === 0) return
    setSaving(true)
    try {
      await onSave(entries)
      setScores({})
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left font-medium">学生</th>
              {subjects.map((s) => (
                <th key={s} className="px-3 py-2 text-left font-medium">{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id} className="border-b last:border-0">
                <td className="px-3 py-2 font-medium">{student.name}</td>
                {subjects.map((subject) => (
                  <td key={subject} className="px-3 py-2">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      className="h-8 w-20"
                      value={scores[student.id]?.[subject] ?? ''}
                      onChange={(e) => updateScore(student.id, subject, e.target.value)}
                      placeholder="分数"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button onClick={handleBatchSave} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        批量保存
      </Button>
    </div>
  )
}

/* ─── Main Page ─── */

export default function GradesPage() {
  const queryClient = useQueryClient()

  /* ── State ── */
  const [selectedTermId, setSelectedTermId] = React.useState('')
  const [selectedClassId, setSelectedClassId] = React.useState('')
  const [selectedSubject, setSelectedSubject] = React.useState('')
  const [selectedExamName, setSelectedExamName] = React.useState('')
  const [activeTab, setActiveTab] = React.useState<'entry' | 'list' | 'ranking' | 'stats'>('entry')
  const [scoreEntryOpen, setScoreEntryOpen] = React.useState(false)

  /* Filter state for score list */
  const [filterSubject, setFilterSubject] = React.useState('')
  const [filterExamName, setFilterExamName] = React.useState('')
  const [sortField, setSortField] = React.useState<'score' | 'examDate'>('examDate')
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc')

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

  const { data: scoresData, isLoading: scoresLoading } = useQuery({
    queryKey: ['edu-ai-management', 'exam-score', selectedClassId, filterSubject, filterExamName],
    queryFn: () => {
      const params = new URLSearchParams()
      if (selectedClassId) params.set('classId', selectedClassId)
      if (filterSubject) params.set('subject', filterSubject)
      if (filterExamName) params.set('examName', filterExamName)
      return api<{ list: EduExamScore[] }>(`/api/edu-ai-management/exam-score?${params}`)
    },
    enabled: !!selectedClassId,
  })
  const scores = React.useMemo(() => scoresData?.list ?? [], [scoresData])

  const { data: statsData } = useQuery({
    queryKey: ['edu-ai-management', 'exam-score', 'stats', selectedClassId],
    queryFn: () => {
      const params = new URLSearchParams()
      if (selectedClassId) params.set('classId', selectedClassId)
      return api<ScoreStats>(`/api/edu-ai-management/exam-score/stats?${params}`)
    },
    enabled: !!selectedClassId,
  })

  const { data: rankingData } = useQuery({
    queryKey: ['edu-ai-management', 'exam-score', 'ranking', selectedClassId, selectedExamName],
    queryFn: () => {
      const params = new URLSearchParams()
      if (selectedClassId) params.set('classId', selectedClassId)
      if (selectedExamName) params.set('examName', selectedExamName)
      return api<{ ranking: RankingEntry[]; totalStudents: number }>(
        `/api/edu-ai-management/exam-score/ranking?${params}`,
      )
    },
    enabled: !!selectedClassId && !!selectedExamName,
  })

  /* ── Derived ── */
  const subjects = React.useMemo(() => {
    const set = new Set(scores.map((s) => s.subject))
    return Array.from(set).sort()
  }, [scores])

  const examNames = React.useMemo(() => {
    const set = new Set(scores.map((s) => s.examName))
    return Array.from(set).sort()
  }, [scores])

  // Determine rank change by comparing with scores
  const rankWithChange = React.useMemo(() => {
    if (!rankingData?.ranking) return []
    return rankingData.ranking.map((r) => ({
      ...r,
      change: 0 as number, // No previous snapshot to compare in this simple version
    }))
  }, [rankingData])

  /* ── Mutations ── */
  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['edu-ai-management'] })
  }, [queryClient])

  const createScore = useMutation({
    mutationFn: (data: ScoreFormData) =>
      api('/api/edu-ai-management/exam-score', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: invalidate,
  })

  const batchCreateScores = useMutation({
    mutationFn: (entries: Array<{ studentId: string; subject: string; score: number }>) =>
      Promise.all(
        entries.map((e) =>
          api('/api/edu-ai-management/exam-score', {
            method: 'POST',
            body: JSON.stringify({
              ...e,
              classId: selectedClassId,
              examName: selectedExamName,
              examDate: new Date().toISOString().split('T')[0]!,
            }),
          }),
        ),
      ),
    onSuccess: invalidate,
  })

  const deleteScore = useMutation({
    mutationFn: (id: string) =>
      api(`/api/edu-ai-management/exam-score/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })

  const createSnapshot = useMutation({
    mutationFn: () =>
      api('/api/edu-ai-management/exam-score/snapshot', {
        method: 'POST',
        body: JSON.stringify({ classId: selectedClassId, examName: selectedExamName }),
      }),
    onSuccess: invalidate,
  })

  /* ── Handlers ── */
  const handleExportCSV = () => {
    const headers = ['学生ID', '科目', '考试名称', '分数', '总分', '日期']
    const rows = scores.map((s) => [
      s.studentId,
      s.subject,
      s.examName,
      s.score,
      s.totalScore,
      s.examDate,
    ])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `成绩导出_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDeleteScore = async (id: string) => {
    if (confirm('确定删除该成绩记录？')) {
      await deleteScore.mutateAsync(id)
    }
  }

  /* ── Sorted scores ── */
  const sortedScores = React.useMemo(() => {
    return [...scores].sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1
      if (sortField === 'score') return (a.score - b.score) * mul
      return a.examDate.localeCompare(b.examDate) * mul
    })
  }, [scores, sortField, sortDir])

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  /* ── Tabs ── */
  const tabs = [
    { key: 'entry' as const, label: '成绩录入', icon: Plus },
    { key: 'list' as const, label: '成绩列表', icon: BookOpen },
    { key: 'ranking' as const, label: '排名', icon: Trophy },
    { key: 'stats' as const, label: '统计', icon: BarChart3 },
  ]

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />

      {/* Header */}
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">成绩管理</h1>
        <p className="text-xs text-muted-foreground">管理学生考试成绩、排名和统计分析</p>
      </header>

      {/* Class/Subject Selector */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex items-center gap-2">
            <School className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedTermId} onValueChange={(v) => { setSelectedTermId(v); setSelectedClassId('') }}>
              <SelectTrigger className="w-40">
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
              onValueChange={(v) => { setSelectedClassId(v); setSelectedSubject(''); setSelectedExamName('') }}
              disabled={!selectedTermId || classes.length === 0}
            >
              <SelectTrigger className="w-40">
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

      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-md border p-0.5">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon className="mr-1 h-3.5 w-3.5" />
              {tab.label}
            </Button>
          )
        })}
      </div>

      {/* Section 1: Score Entry */}
      {activeTab === 'entry' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">成绩录入</CardTitle>
            <div className="flex items-center gap-2">
              <Input
                className="h-8 w-36"
                placeholder="考试名称"
                value={selectedExamName}
                onChange={(e) => setSelectedExamName(e.target.value)}
              />
              <Input
                className="h-8 w-36"
                placeholder="科目（逗号分隔）"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
              />
              <Button size="sm" onClick={() => setScoreEntryOpen(true)} disabled={!selectedClassId}>
                <Plus className="h-3.5 w-3.5" />
                单个录入
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!selectedClassId ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <AlertCircle className="mb-2 h-8 w-8" />
                <p className="text-sm">请先选择班级</p>
              </div>
            ) : selectedExamName && selectedSubject ? (
              <BatchScoreEntry
                students={[]}
                subjects={selectedSubject.split(',').map((s) => s.trim()).filter(Boolean)}
                onSave={async (entries) => {
                  await batchCreateScores.mutateAsync(entries)
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <AlertCircle className="mb-2 h-8 w-8" />
                <p className="text-sm">请输入考试名称和科目以开始批量录入</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Section 2: Score List */}
      {activeTab === 'list' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">成绩列表</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={filterSubject} onValueChange={setFilterSubject}>
                <SelectTrigger className="h-8 w-32">
                  <SelectValue placeholder="全部科目" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部科目</SelectItem>
                  {subjects.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterExamName} onValueChange={setFilterExamName}>
                <SelectTrigger className="h-8 w-32">
                  <SelectValue placeholder="全部考试" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部考试</SelectItem>
                  {examNames.map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={scores.length === 0}>
                <Download className="h-3.5 w-3.5" />
                导出CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {scoresLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                加载中...
              </div>
            ) : sortedScores.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <AlertCircle className="mb-2 h-8 w-8" />
                <p className="text-sm">暂无成绩数据</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium">学生</th>
                      <th className="px-3 py-2 text-left font-medium">科目</th>
                      <th className="px-3 py-2 text-left font-medium">考试名称</th>
                      <th
                        className="cursor-pointer px-3 py-2 text-left font-medium hover:text-foreground"
                        onClick={() => toggleSort('score')}
                      >
                        分数 {sortField === 'score' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th className="px-3 py-2 text-left font-medium">总分</th>
                      <th className="px-3 py-2 text-left font-medium">百分比</th>
                      <th className="px-3 py-2 text-left font-medium">排名</th>
                      <th className="px-3 py-2 text-left font-medium">日期</th>
                      <th className="px-3 py-2 text-left font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedScores.map((s, i) => {
                      const pct = Math.round((s.score / s.totalScore) * 100)
                      return (
                        <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-3 py-2">
                            <Link
                              href={`/edu/edu-management/grades/trend/${s.studentId}`}
                              className="font-medium hover:text-primary"
                            >
                              {s.studentId.slice(0, 8)}
                            </Link>
                          </td>
                          <td className="px-3 py-2">{s.subject}</td>
                          <td className="px-3 py-2">{s.examName}</td>
                          <td className="px-3 py-2 font-medium">{s.score}</td>
                          <td className="px-3 py-2 text-muted-foreground">{s.totalScore}</td>
                          <td className="px-3 py-2">
                            <span className={cn(pct >= 60 ? 'text-green-600' : 'text-red-600')}>
                              {pct}%
                            </span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">#{i + 1}</td>
                          <td className="px-3 py-2 text-muted-foreground">{s.examDate}</td>
                          <td className="px-3 py-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-red-500 hover:text-red-600"
                              onClick={() => handleDeleteScore(s.id)}
                            >
                              删除
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Section 3: Ranking */}
      {activeTab === 'ranking' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">班级排名</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={selectedExamName} onValueChange={setSelectedExamName}>
                <SelectTrigger className="h-8 w-36">
                  <SelectValue placeholder="选择考试" />
                </SelectTrigger>
                <SelectContent>
                  {examNames.map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => createSnapshot.mutateAsync()}
                disabled={!selectedExamName || createSnapshot.isPending}
              >
                <Camera className="h-3.5 w-3.5" />
                拍快照
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!selectedExamName ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <AlertCircle className="mb-2 h-8 w-8" />
                <p className="text-sm">请选择考试查看排名</p>
              </div>
            ) : !rankingData ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                加载排名...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium">排名</th>
                      <th className="px-3 py-2 text-left font-medium">学生</th>
                      <th className="px-3 py-2 text-left font-medium">总分</th>
                      <th className="px-3 py-2 text-left font-medium">考试次数</th>
                      <th className="px-3 py-2 text-left font-medium">变化</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankWithChange.map((r) => (
                      <tr key={r.studentId} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <span className={cn(
                            'inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-medium',
                            r.rank <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground',
                          )}>
                            {r.rank}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-medium">
                          <Link
                            href={`/edu/edu-management/grades/trend/${r.studentId}`}
                            className="hover:text-primary"
                          >
                            {r.studentId.slice(0, 8)}
                          </Link>
                        </td>
                        <td className="px-3 py-2 font-medium">{r.totalScore}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.examCount}</td>
                        <td className="px-3 py-2">
                          {r.change === 0 ? (
                            <Minus className="h-4 w-4 text-muted-foreground" />
                          ) : r.change > 0 ? (
                            <span className="flex items-center gap-1 text-green-600">
                              <ArrowUp className="h-4 w-4" />+{r.change}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-600">
                              <ArrowDown className="h-4 w-4" />{r.change}
                            </span>
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
      )}

      {/* Section 4: Statistics */}
      {activeTab === 'stats' && (
        <div className="space-y-4">
          {/* Stats Cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">平均分</span>
                </div>
                <p className="mt-1 text-2xl font-bold">{statsData?.avgScore ?? '-'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">最高分</span>
                </div>
                <p className="mt-1 text-2xl font-bold text-green-600">{statsData?.maxScore ?? '-'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">最低分</span>
                </div>
                <p className="mt-1 text-2xl font-bold text-red-600">{statsData?.minScore ?? '-'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">及格率</span>
                </div>
                <p className="mt-1 text-2xl font-bold">{statsData?.passRate ?? '-'}%</p>
              </CardContent>
            </Card>
          </div>

          {/* Score Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">分数分布</CardTitle>
            </CardHeader>
            <CardContent>
              {statsData?.distribution && statsData.distribution.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statsData.distribution}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="range" className="text-xs" />
                      <YAxis className="text-xs" allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <p className="text-sm">暂无统计数据</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top/Bottom 5 */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">前5名</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {rankWithChange.slice(0, 5).map((r) => (
                  <div key={r.studentId} className="flex items-center justify-between border-b px-4 py-2 text-sm last:border-0">
                    <span className="font-medium">#{r.rank} {r.studentId.slice(0, 8)}</span>
                    <span className="text-muted-foreground">{r.totalScore}分</span>
                  </div>
                ))}
                {rankWithChange.length === 0 && (
                  <p className="px-4 py-4 text-center text-sm text-muted-foreground">暂无数据</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">后5名</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {rankWithChange.slice(-5).reverse().map((r) => (
                  <div key={r.studentId} className="flex items-center justify-between border-b px-4 py-2 text-sm last:border-0">
                    <span className="font-medium">#{r.rank} {r.studentId.slice(0, 8)}</span>
                    <span className="text-muted-foreground">{r.totalScore}分</span>
                  </div>
                ))}
                {rankWithChange.length === 0 && (
                  <p className="px-4 py-4 text-center text-sm text-muted-foreground">暂无数据</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Score Entry Dialog */}
      <ScoreEntryDialog
        open={scoreEntryOpen}
        onOpenChange={setScoreEntryOpen}
        students={[]}
        onSave={async (data) => {
          await createScore.mutateAsync(data)
        }}
      />
    </div>
  )
}