'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { Loader2, ChevronLeft, ChevronRight, Download, Upload, Layers } from 'lucide-react'

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
} from '@ihui/ui'

interface SignupBatch {
  id: string
  batchNo: string
  targetTitle: string
  targetType: string
  count: number
  status: string
  createdAt: string
}

interface BatchData {
  list: SignupBatch[]
  total: number
}

const PAGE_SIZE = 10

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  pending: { label: '待处理', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-500' },
  success: { label: '已完成', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' },
  failed: { label: '失败', cls: 'bg-red-500/10 text-red-600 dark:text-red-500' },
  processing: { label: '处理中', cls: 'bg-sky-500/10 text-sky-600 dark:text-sky-500' },
}

function statusOf(s: string) {
  return STATUS_CFG[s] ?? { label: s || '未知', cls: 'bg-muted text-muted-foreground' }
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function AdminLearnSignupBatchPage() {
  const locale = useLocale()
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
    queryKey: ['admin', 'learn', 'signup-batch', debounced, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (debounced) qs.set('search', debounced)
      return api<BatchData>(`/api/admin/learn/signup-batch?${qs.toString()}`)
    },
    retry: false,
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
      '批量报名',
      [
        { key: 'batchNo', title: '批次号' },
        { key: 'targetTitle', title: '目标' },
        { key: 'targetType', title: '类型' },
        { key: 'count', title: '人数' },
        { key: 'status', title: '状态' },
        { key: 'createdAt', title: '创建时间' },
      ],
      rows as unknown as Record<string, unknown>[],
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">批量报名管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">管理批量报名记录,支持导入与导出</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu/learn">
            <ChevronLeft className="h-4 w-4" />
            返回
          </Link>
        </Button>
        <div className="relative w-full max-w-xs">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索批次号或名称"
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
              <TableHead className="px-4 py-2.5">批次号</TableHead>
              <TableHead className="px-4 py-2.5">目标</TableHead>
              <TableHead className="px-4 py-2.5">类型</TableHead>
              <TableHead className="px-4 py-2.5">人数</TableHead>
              <TableHead className="px-4 py-2.5">状态</TableHead>
              <TableHead className="px-4 py-2.5">创建时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Layers className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  接口未配置或加载失败
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Layers className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无批量报名记录
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const sc = statusOf(r.status)
                return (
                  <TableRow key={r.id} className="hover:bg-muted/30">
                    <TableCell className="px-4 py-2.5 font-mono text-xs">{r.batchNo}</TableCell>
                    <TableCell className="px-4 py-2.5 font-medium">{r.targetTitle}</TableCell>
                    <TableCell className="px-4 py-2.5 text-muted-foreground">
                      {r.targetType}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">{r.count}</TableCell>
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
