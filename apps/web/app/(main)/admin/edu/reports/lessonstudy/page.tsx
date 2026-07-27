'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Users,
  CheckCircle,
  Clock,
} from 'lucide-react'

import { eduApi, buildQs, type PageData } from '@/lib/edu'
import { isNotFound } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import {
  Card,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button,
  Input,
} from '@ihui/ui-react'

interface LessonStudyReport {
  id: string
  lessonTitle: string
  learnerCount: number
  avgProgress: number
  completedCount: number
  totalHours: number
}

const PAGE_SIZE = 10

export default function EduReportsLessonStudyPage() {
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'reports', 'lessonstudy', debounced, page],
    queryFn: () =>
      eduApi<PageData<LessonStudyReport>>(
        `/api/learn/reports/lesson${buildQs({ page, pageSize: PAGE_SIZE, search: debounced })}`,
      ),
    retry: false,
  })

  const rows = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const totalLearners = rows.reduce((a, r) => a + r.learnerCount, 0)
  const totalCompleted = rows.reduce((a, r) => a + r.completedCount, 0)
  const totalHours = rows.reduce((a, r) => a + r.totalHours, 0)
  const noEndpoint = isNotFound(error)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">课程学习报表</h1>
        <p className="mt-1 text-sm text-muted-foreground">统计各课程的学习人数、进度与时长</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">本页学习人数</div>
              <div className="mt-0.5 text-xl font-semibold">{totalLearners}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">已完成人数</div>
              <div className="mt-0.5 text-xl font-semibold">{totalCompleted}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">本页总时长</div>
              <div className="mt-0.5 text-xl font-semibold">{totalHours.toFixed(1)}h</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu">
            <ChevronLeft className="h-4 w-4" />
            返回
          </Link>
        </Button>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索课程名称"
          className="h-9 max-w-xs"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">课程</TableHead>
              <TableHead className="px-4 py-2.5">学习人数</TableHead>
              <TableHead className="px-4 py-2.5">平均进度</TableHead>
              <TableHead className="px-4 py-2.5">已完成</TableHead>
              <TableHead className="px-4 py-2.5">总时长</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </TableCell>
              </TableRow>
            ) : noEndpoint ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <BarChart3 className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  报表接口未配置
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <BarChart3 className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">{r.lessonTitle}</TableCell>
                  <TableCell className="px-4 py-2.5">{r.learnerCount}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-2xl bg-muted">
                        <div
                          className={cn(
                            'h-full rounded-md',
                            r.avgProgress >= 100
                              ? 'bg-emerald-500'
                              : r.avgProgress >= 50
                                ? 'bg-sky-500'
                                : 'bg-amber-500',
                          )}
                          style={{ width: `${Math.min(100, r.avgProgress)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{r.avgProgress}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-emerald-600">{r.completedCount}</TableCell>
                  <TableCell className="px-4 py-2.5">{r.totalHours.toFixed(1)}h</TableCell>
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
            <ChevronLeft className="h-4 w-4" />
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
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
