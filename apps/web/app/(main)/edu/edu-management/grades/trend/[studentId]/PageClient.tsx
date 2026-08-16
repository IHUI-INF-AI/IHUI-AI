'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { Loader2, AlertCircle, TrendingUp, BookOpen, AlertTriangle } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts'

import { fetchApi } from '@/lib/api'
import { BackButton } from '@/components/common'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
} from '@ihui/ui-react'

/* ─── Types ─── */

interface TrendEntry {
  id: string
  examName: string
  subject: string
  score: number
  totalScore: number
  examDate: string
}

interface WeaknessItem {
  subject: string
  avgScore: number
  totalScore: number
  percentage: number
  examCount: number
  isWeak: boolean
}

/* ─── API helper ─── */

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

/* ─── Color palette ─── */

const SUBJECT_COLORS = [
  'hsl(var(--primary))',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
]

/* ─── Page ─── */

export default function TrendPage() {
  const params = useParams()
  const studentId = params?.studentId as string

  const [selectedSubject, setSelectedSubject] = React.useState('')

  /* ── Queries ── */
  const { data: trendData, isLoading: trendLoading } = useQuery({
    queryKey: ['edu-ai-management', 'exam-score', 'trend', studentId, selectedSubject],
    queryFn: () => {
      const params = new URLSearchParams()
      if (selectedSubject) params.set('subject', selectedSubject)
      return api<{ list: TrendEntry[] }>(
        `/api/edu-ai-management/exam-score/trend/${studentId}?${params}`,
      )
    },
    enabled: !!studentId,
  })

  const { data: weaknessData, isLoading: weaknessLoading } = useQuery({
    queryKey: ['edu-ai-management', 'exam-score', 'weakness', studentId],
    queryFn: () =>
      api<{ weakness: WeaknessItem[] }>(`/api/edu-ai-management/exam-score/weakness/${studentId}`),
    enabled: !!studentId,
  })

  const trendList = React.useMemo(() => trendData?.list ?? [], [trendData])
  const weakness = React.useMemo(() => weaknessData?.weakness ?? [], [weaknessData])

  /* ── Derived ── */
  const subjects = React.useMemo(() => {
    const set = new Set(trendList.map((t) => t.subject))
    return Array.from(set).sort()
  }, [trendList])

  // Group trend data by subject for multiple lines
  const trendBySubject = React.useMemo(() => {
    const map = new Map<string, TrendEntry[]>()
    for (const entry of trendList) {
      const list = map.get(entry.subject) ?? []
      list.push(entry)
      map.set(entry.subject, list)
    }
    return map
  }, [trendList])

  // Unique exam names for x-axis
  const examNames = React.useMemo(() => {
    const set = new Set(trendList.map((t) => t.examName))
    return Array.from(set)
  }, [trendList])

  // Radar chart data
  const radarData = React.useMemo(() => {
    return weakness.map((w) => ({
      subject: w.subject,
      percentage: w.percentage,
      fullMark: 100,
    }))
  }, [weakness])

  /* ── Loading / Error ── */
  if (trendLoading || weaknessLoading) {
    return (
      <div className="space-y-4 px-4 py-6">
        <BackButton />
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />

      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">成绩趋势分析</h1>
        <p className="text-xs text-muted-foreground">
          学生 {studentId?.slice(0, 8)} 的成绩趋势与薄弱环节
        </p>
      </header>

      {/* Subject filter */}
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="全部科目" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部科目</SelectItem>
              {subjects.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Score Trend Line Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <TrendingUp className="h-4 w-4" />
            成绩趋势
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trendList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertCircle className="mb-2 h-8 w-8" />
              <p className="text-sm">暂无成绩数据</p>
            </div>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={examNames.map((name) => {
                    const point: Record<string, string | number> = { examName: name }
                    for (const [subject, entries] of trendBySubject) {
                      const entry = entries.find((e) => e.examName === name)
                      if (entry) point[subject] = entry.score
                    }
                    return point
                  })}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="examName" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  {Array.from(trendBySubject.entries()).map(([subject], i) => (
                    <Line
                      key={subject}
                      type="monotone"
                      dataKey={subject}
                      stroke={SUBJECT_COLORS[i % SUBJECT_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subject Breakdown Radar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <BookOpen className="h-4 w-4" />
            科目成绩分布
          </CardTitle>
        </CardHeader>
        <CardContent>
          {radarData.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <p className="text-sm">暂无科目数据</p>
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid className="stroke-border" />
                  <PolarAngleAxis dataKey="subject" className="text-xs" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} className="text-xs" />
                  <Radar
                    name="成绩"
                    dataKey="percentage"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weakness List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="h-4 w-4" />
            薄弱环节
          </CardTitle>
        </CardHeader>
        <CardContent>
          {weakness.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <p className="text-sm">暂无数据</p>
            </div>
          ) : (
            <div className="space-y-2">
              {weakness.map((w) => (
                <div
                  key={w.subject}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{w.subject}</span>
                    {w.isWeak && (
                      <Badge variant="destructive" className="text-[10px]">
                        薄弱
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>平均分: {w.avgScore}</span>
                    <span>得分率: {w.percentage}%</span>
                    <span>考试次数: {w.examCount}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
