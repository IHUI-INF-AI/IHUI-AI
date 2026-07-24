'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Activity, Trash2, Eraser, Download, ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { HasPermi } from '@/components/auth/HasPermi'
import { exportFromApi } from '@/lib/export-utils'
import { useBatchMutation } from '@/hooks/use-batch-mutation'
import { OperationLogsFilter } from './OperationLogsFilter'
import { OperationLogsTable } from './OperationLogsTable'
import { OperationLogsDetailDialog } from './OperationLogsDetailDialog'
import { RESOURCE, BIZ_TYPE, STATUS_LABEL, api } from './helpers'
import type { OperLog, ListResp } from './types'

const PAGE_SIZE = 15
const EMPTY_SEARCH = { title: '', operName: '', businessType: '' }

export default function OperationLogsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState(EMPTY_SEARCH)
  const [applied, setApplied] = React.useState(EMPTY_SEARCH)
  const [page, setPage] = React.useState(1)
  const [sort, setSort] = React.useState<{ col: string; dir: 'asc' | 'desc' }>({
    col: 'operTime',
    dir: 'desc',
  })
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [detail, setDetail] = React.useState<OperLog | null>(null)

  const params = React.useMemo(() => {
    const qs = new URLSearchParams()
    qs.set('page', String(page))
    qs.set('pageSize', String(PAGE_SIZE))
    if (applied.title) qs.set('title', applied.title)
    if (applied.operName) qs.set('operName', applied.operName)
    if (applied.businessType) qs.set('businessType', applied.businessType)
    qs.set('orderByColumn', sort.col)
    qs.set('isAsc', sort.dir)
    return qs.toString()
  }, [page, applied, sort])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'operation-logs', params],
    queryFn: () => api<ListResp>(`${RESOURCE}?${params}`),
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const delMut = useBatchMutation({
    endpoint: RESOURCE,
    method: 'DELETE',
    queryKey: ['admin', 'operation-logs'],
    ids: [...selected],
    successMessage: '删除成功',
    onSuccess: () => setSelected(new Set()),
  })
  const cleanMut = useMutation({
    mutationFn: () => api(`${RESOURCE}/clean`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'operation-logs'] })
      toast.success('清空成功')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const handleSearch = () => {
    setPage(1)
    setApplied(search)
  }
  const handleReset = () => {
    setSearch(EMPTY_SEARCH)
    setApplied(EMPTY_SEARCH)
    setPage(1)
  }
  const toggleAll = () =>
    setSelected(selected.size === list.length ? new Set() : new Set(list.map((l) => l.id)))
  const toggleOne = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelected(next)
  }
  const handleSort = (col: string) =>
    setSort((s) => ({ col, dir: s.col === col && s.dir === 'desc' ? 'asc' : 'desc' }))
  const handleExport = () =>
    exportFromApi(
      `${RESOURCE}?pageSize=9999&${new URLSearchParams(applied as Record<string, string>)}`,
      'operation-logs',
      [
        { key: 'id', title: 'ID' },
        { key: 'title', title: '模块' },
        { key: 'businessType', title: '类型', formatter: (v) => BIZ_TYPE[Number(v)] ?? '' },
        { key: 'operName', title: '操作人' },
        { key: 'operIp', title: 'IP' },
        { key: 'operUrl', title: 'URL' },
        { key: 'requestMethod', title: '方法' },
        { key: 'status', title: '状态', formatter: (v) => STATUS_LABEL[Number(v)]?.label ?? '' },
        { key: 'costTime', title: '耗时(ms)' },
        { key: 'operTime', title: '操作时间' },
      ],
    ).then((ok) => (ok ? toast.success('导出成功') : toast.error('导出失败')))

  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <Activity className="h-6 w-6 text-primary" />
        操作日志
      </h1>

      <OperationLogsFilter
        value={search}
        onChange={setSearch}
        onSearch={handleSearch}
        onReset={handleReset}
      />

      <div className="flex items-center gap-2">
        <HasPermi code="system:operlog:remove">
          <Button
            size="sm"
            variant="outline"
            disabled={selected.size === 0 || delMut.isPending}
            onClick={() => {
              if (confirm(`确认删除选中的 ${selected.size} 条记录？`)) delMut.mutate()
            }}
          >
            <Trash2 className="h-4 w-4" />
            删除
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={cleanMut.isPending}
            onClick={() => {
              if (confirm('确认清空所有操作日志？')) cleanMut.mutate()
            }}
          >
            <Eraser className="h-4 w-4" />
            清空
          </Button>
        </HasPermi>
        <HasPermi code="system:operlog:export">
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4" />
            导出
          </Button>
        </HasPermi>
      </div>

      <OperationLogsTable
        list={list}
        isLoading={isLoading}
        selected={selected}
        onToggleAll={toggleAll}
        onToggleOne={toggleOne}
        sort={sort}
        onSort={handleSort}
        onDetail={setDetail}
      />

      {total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            共 {total} 条 · {page}/{totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <OperationLogsDetailDialog detail={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
