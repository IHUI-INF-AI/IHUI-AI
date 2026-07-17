'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, ChevronLeft, ChevronRight, Download, Upload, BookCopy } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { exportToExcel } from '@/lib/export-utils'
import { cn } from '@/lib/utils'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'

interface BatchLesson {
  id: string
  lessonTitle: string
  batchNo: string
  count: number
  successCount: number
  status: number
  createdAt: string
}

interface BatchLessonData {
  list: BatchLesson[]
  total: number
}

const PAGE_SIZE = 10
const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

const STATUS_CFG: Record<number, { label: string; cls: string }> = {
  0: { label: '待处理', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-500' },
  1: { label: '已完成', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' },
  2: { label: '失败', cls: 'bg-red-500/10 text-red-600 dark:text-red-500' },
}

function statusOf(s: number) {
  return STATUS_CFG[s] ?? { label: String(s), cls: 'bg-muted text-muted-foreground' }
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function AdminLearnSignupBatchLessonPage() {
  const locale = useLocale()
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [status, setStatus] = React.useState('all')
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
    queryKey: ['admin', 'learn', 'signup-batchlesson', debounced, status, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (debounced) qs.set('search', debounced)
      if (status !== 'all') qs.set('status', status)
      return api<BatchLessonData>(`/api/admin/learn/signup-batchlesson?${qs.toString()}`)
    },
    retry: false,
  })

  const retryMut = useMutation({
    mutationFn: (id: string) =>
      api(`/api/admin/learn/signup-batchlesson/${id}/retry`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('已重新提交')
      qc.invalidateQueries({ queryKey: ['admin', 'learn', 'signup-batchlesson'] })
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

  function handleExport() {
    exportToExcel(
      '批量课程报名',
      [
        { key: 'lessonTitle', title: '课程' },
        { key: 'batchNo', title: '批次号' },
        { key: 'count', title: '报名人数' },
        { key: 'successCount', title: '成功人数' },
        { key: 'status', title: '状态' },
        { key: 'createdAt', title: '创建时间' },
      ],
      rows as unknown as Record<string, unknown>[],
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">批量课程报名</h1>
        <p className="mt-1 text-sm text-muted-foreground">管理课程批量报名,支持导入与重试</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu/learn">
            <ChevronLeft className="h-4 w-4" />
            返回
          </Link>
        </Button>
        <div className="w-full max-w-[160px]">
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
          >
            <SelectTrigger className={selectClass} aria-label="状态筛选">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="0">待处理</SelectItem>
              <SelectItem value="1">已完成</SelectItem>
              <SelectItem value="2">失败</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="relative w-full max-w-xs">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索课程或批次号"
            className="h-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0}>
          <Download className="h-4 w-4" />
          导出
        </Button>
        <Button size="sm" className="ml-auto">
          <Upload className="h-4 w-4" />
          导入报名
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">课程</TableHead>
              <TableHead className="px-4 py-2.5">批次号</TableHead>
              <TableHead className="px-4 py-2.5">报名人数</TableHead>
              <TableHead className="px-4 py-2.5">成功人数</TableHead>
              <TableHead className="px-4 py-2.5">状态</TableHead>
              <TableHead className="px-4 py-2.5">创建时间</TableHead>
              <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <BookCopy className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  接口未配置或加载失败
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <BookCopy className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无批量课程报名记录
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const sc = statusOf(r.status)
                const canRetry = r.status === 2
                return (
                  <TableRow key={r.id} className="hover:bg-muted/30">
                    <TableCell className="px-4 py-2.5 font-medium">{r.lessonTitle}</TableCell>
                    <TableCell className="px-4 py-2.5 font-mono text-xs">{r.batchNo}</TableCell>
                    <TableCell className="px-4 py-2.5">{r.count}</TableCell>
                    <TableCell className="px-4 py-2.5 text-emerald-600">{r.successCount}</TableCell>
                    <TableCell className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                          sc.cls,
                        )}
                      >
                        {sc.label}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                      {dateFmt.format(new Date(r.createdAt))}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right">
                      {canRetry ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={retryMut.isPending}
                          onClick={() => retryMut.mutate(r.id)}
                        >
                          重试
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
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
