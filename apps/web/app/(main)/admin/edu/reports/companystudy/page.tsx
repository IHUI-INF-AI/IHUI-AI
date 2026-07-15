'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Loader2, ChevronLeft, ChevronRight, BarChart3, Building2, Users, Clock } from 'lucide-react'

import { eduApi, buildQs, type PageData } from '@/lib/edu'
import { isNotFound } from '@/lib/api-error'
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
} from '@ihui/ui'

interface CompanyStudyReport {
  id: string
  companyName: string
  employeeCount: number
  activeEmployees: number
  totalStudyHours: number
  completedCourses: number
}

const PAGE_SIZE = 10

export default function EduReportsCompanyStudyPage() {
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
    queryKey: ['edu', 'reports', 'companystudy', debounced, page],
    queryFn: () =>
      eduApi<PageData<CompanyStudyReport>>(
        `/api/admin/reports/company-study${buildQs({ page, pageSize: PAGE_SIZE, search: debounced })}`,
      ),
    retry: false,
  })

  const rows = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const totalEmployees = rows.reduce((a, r) => a + r.employeeCount, 0)
  const totalActive = rows.reduce((a, r) => a + r.activeEmployees, 0)
  const totalHours = rows.reduce((a, r) => a + r.totalStudyHours, 0)
  const noEndpoint = isNotFound(error)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">公司学习报表</h1>
        <p className="mt-1 text-sm text-muted-foreground">统计各公司的员工学习活跃度与时长</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">本页员工总数</div>
              <div className="mt-0.5 text-xl font-semibold">{totalEmployees}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">活跃员工</div>
              <div className="mt-0.5 text-xl font-semibold">{totalActive}</div>
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
          placeholder="搜索公司名称"
          className="h-9 max-w-xs"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">公司</TableHead>
              <TableHead className="px-4 py-2.5">员工数</TableHead>
              <TableHead className="px-4 py-2.5">活跃员工</TableHead>
              <TableHead className="px-4 py-2.5">学习时长</TableHead>
              <TableHead className="px-4 py-2.5">完成课程</TableHead>
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
                  <TableCell className="px-4 py-2.5 font-medium">{r.companyName}</TableCell>
                  <TableCell className="px-4 py-2.5">{r.employeeCount}</TableCell>
                  <TableCell className="px-4 py-2.5 text-emerald-600">{r.activeEmployees}</TableCell>
                  <TableCell className="px-4 py-2.5">{r.totalStudyHours.toFixed(1)}h</TableCell>
                  <TableCell className="px-4 py-2.5">{r.completedCourses}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
