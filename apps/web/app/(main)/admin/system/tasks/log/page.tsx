'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ScrollText, Trash2, Eraser, Download, ChevronLeft, ChevronRight } from 'lucide-react'

import { exportFromApi } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { useBatchMutation } from '@/hooks/use-batch-mutation'
import { Button } from '@ihui/ui-react'

import { TaskLogFilter } from './TaskLogFilter'
import { TaskLogTable } from './TaskLogTable'
import { TaskLogDetailDialog } from './TaskLogDetailDialog'
import {
  RESOURCE,
  PAGE_SIZE,
  EMPTY_SEARCH,
  EXPORT_COLUMNS,
  api,
  buildQuery,
  buildExportUrl,
} from './helpers'
import type { JobLog, ListResp, SearchState, SortState } from './types'

export default function JobLogPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState<SearchState>(EMPTY_SEARCH)
  const [applied, setApplied] = React.useState<SearchState>(EMPTY_SEARCH)
  const [page, setPage] = React.useState(1)
  const [sort, setSort] = React.useState<SortState>({ col: 'startTime', dir: 'desc' })
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [detail, setDetail] = React.useState<JobLog | null>(null)

  const params = React.useMemo(() => buildQuery(page, applied, sort), [page, applied, sort])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'job-logs', params],
    queryFn: () => api<ListResp>(`${RESOURCE}?${params}`),
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const delMut = useBatchMutation({
    endpoint: RESOURCE,
    method: 'DELETE',
    queryKey: ['admin', 'job-logs'],
    ids: [...selected],
    successMessage: '删除成功',
    onSuccess: () => setSelected(new Set()),
  })
  const cleanMut = useMutation({
    mutationFn: () => api(`${RESOURCE}/clean`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'job-logs'] })
      toast.success('清空成功')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const onSearchChange = (patch: Partial<SearchState>) => setSearch((s) => ({ ...s, ...patch }))
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
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }
  const handleSort = (col: string) =>
    setSort((s) => ({ col, dir: s.col === col && s.dir === 'desc' ? 'asc' : 'desc' }))
  const handleExport = () =>
    exportFromApi(buildExportUrl(applied), 'job-logs', EXPORT_COLUMNS).then((ok) =>
      ok ? toast.success('导出成功') : toast.error('导出失败'),
    )

  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <ScrollText className="h-6 w-6 text-primary" />
        任务日志
      </h1>

      <TaskLogFilter
        search={search}
        onSearchChange={onSearchChange}
        onQuery={handleSearch}
        onReset={handleReset}
      />

      <div className="flex items-center gap-2">
        <HasPermi code="monitor:job:remove">
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
              if (confirm('确认清空所有任务日志？')) cleanMut.mutate()
            }}
          >
            <Eraser className="h-4 w-4" />
            清空
          </Button>
        </HasPermi>
        <HasPermi code="monitor:job:export">
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4" />
            导出
          </Button>
        </HasPermi>
      </div>

      <TaskLogTable
        list={list}
        isLoading={isLoading}
        selected={selected}
        sort={sort}
        onToggleAll={toggleAll}
        onToggleOne={toggleOne}
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

      <TaskLogDetailDialog detail={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
