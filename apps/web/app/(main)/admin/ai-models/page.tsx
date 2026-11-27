// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { confirmDialog } from '@/components/feedback'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { AiModelDialog } from './AiModelDialog'
import { AiModelsFilter } from './AiModelsFilter'
import type { PublicFilter, StatusFilter } from './AiModelsFilter'
import { AiModelsTable } from './AiModelsTable'
import { AiModelsTelemetry } from './AiModelsTelemetry'
import { AiModelHealth } from './AiModelHealth'
import { AiModelDrawer } from './AiModelDrawer'
import { PAGE_SIZE, EMPTY_FORM, api, rowToForm, formToBody } from './helpers'
import type {
  ModelRow,
  ListData,
  FormState,
  TestResult,
  AiModelTelemetry,
  AiModelGovernance,
  TelemetryWindow,
} from './types'
import { BackButton } from '@/components/common'

export default function AiModelsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [provider, setProvider] = React.useState('')
  const [status, setStatus] = React.useState<StatusFilter>('all')
  const [publicFilter, setPublicFilter] = React.useState<PublicFilter>('all')
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE)
  const [telemetryWindow, setTelemetryWindow] = React.useState<TelemetryWindow>('1h')
  const [inspectId, setInspectId] = React.useState<number | null>(null)
  const [open, setOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<number | null>(null)
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: [
      'admin',
      'ai-model-config',
      debounced,
      page,
      pageSize,
      provider,
      status,
      publicFilter,
    ],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (debounced) qs.set('search', debounced)
      if (provider) qs.set('provider', provider)
      if (status !== 'all') qs.set('enabled', String(status === 'enabled'))
      if (publicFilter !== 'all') qs.set('public', publicFilter)
      return api<ListData>(`/api/admin/ai-model-config?${qs.toString()}`)
    },
  })

  // 运行遥测独立取数:表格翻页/搜索不打断监测条,监测条 30s 自刷新也不重拉表格。
  const {
    data: telemetry,
    isLoading: telemetryLoading,
    isFetching: telemetryFetching,
    isError: telemetryError,
    refetch: refetchTelemetry,
  } = useQuery({
    queryKey: ['admin', 'ai-model-config', 'telemetry', telemetryWindow],
    queryFn: () =>
      api<AiModelTelemetry>(`/api/admin/ai-model-config/telemetry?window=${telemetryWindow}`),
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  // 配置治理体检:重复配置/别名冲突/公开停用/零价/缺运营号,60s 刷新。
  const { data: governance } = useQuery({
    queryKey: ['admin', 'ai-model-config', 'health'],
    queryFn: () => api<AiModelGovernance>('/api/admin/ai-model-config/health'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const saveMut = useMutation({
    mutationFn: () =>
      editingId
        ? api(`/api/admin/ai-model-config/${editingId}`, {
            method: 'PUT',
            body: JSON.stringify(formToBody(form)),
          })
        : api('/api/admin/ai-model-config', {
            method: 'POST',
            body: JSON.stringify(formToBody(form)),
          }),
    onSuccess: () => {
      toast.success(editingId ? '更新成功' : '创建成功')
      qc.invalidateQueries({ queryKey: ['admin', 'ai-model-config'] })
      closeDialog()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const toggleMut = useMutation({
    mutationFn: (item: ModelRow) =>
      api(`/api/admin/ai-model-config/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: !item.enabled }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ai-model-config'] }),
    onError: (e: Error) => toast.error(e.message),
  })

  const testMut = useMutation({
    mutationFn: (id: number) =>
      api<TestResult>(`/api/admin/ai-model-config/${id}/test`, { method: 'POST' }),
    onSuccess: (res) => {
      toast.success(`连通测试成功 (${res.responseMs ?? 0}ms)`)
      qc.invalidateQueries({ queryKey: ['admin', 'ai-model-config'] })
    },
    onError: (e: Error) => toast.error(`测试失败: ${e.message}`),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => api(`/api/admin/ai-model-config/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'ai-model-config'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setOpen(true)
  }
  function openEdit(item: ModelRow) {
    setEditingId(item.id)
    setForm(rowToForm(item))
    setOpen(true)
  }
  function closeDialog() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditingId(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.providerCode.trim() || !form.baseUrl.trim()) {
      toast.error('名称、Provider Code、Base URL 必填')
      return
    }
    saveMut.mutate()
  }
  function handleDelete(item: ModelRow) {
    void confirmDialog({
      title: `确认删除「${item.name}」? 有模型行或调用流水时会被拒绝，建议先停用归档。`,
    }).then((ok) => {
      if (ok) deleteMut.mutate(item.id)
    })
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-4 px-4 py-4">
      <BackButton />
      <AiModelsFilter
        search={search}
        onSearchChange={setSearch}
        provider={provider}
        providers={[
          ...new Set(Object.values(governance?.byConfig ?? {}).map((item) => item.providerCode)),
        ].sort()}
        onProviderChange={(value) => {
          setProvider(value)
          setPage(1)
        }}
        status={status}
        onStatusChange={(value) => {
          setStatus(value)
          setPage(1)
        }}
        publicFilter={publicFilter}
        onPublicChange={(value) => {
          setPublicFilter(value)
          setPage(1)
        }}
        onCreate={openCreate}
      />

      <AiModelsTelemetry
        data={telemetry}
        isLoading={telemetryLoading}
        isFetching={telemetryFetching}
        isError={telemetryError}
        window={telemetryWindow}
        onWindowChange={setTelemetryWindow}
        onRefresh={() => void refetchTelemetry()}
      />

      {governance && <AiModelHealth governance={governance} />}

      <AiModelsTable
        list={list}
        isLoading={isLoading}
        telemetry={telemetry?.byConfig}
        telemetryReady={Boolean(telemetry) && !telemetryError}
        realtimeMinutes={telemetry?.realtimeMinutes}
        window={telemetryWindow}
        governance={governance}
        togglePending={toggleMut.isPending}
        testPending={testMut.isPending}
        onToggle={toggleMut.mutate}
        onTest={testMut.mutate}
        onEdit={openEdit}
        onDelete={handleDelete}
        onInspect={setInspectId}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-body text-muted-foreground">共 {total} 条</span>
          <select
            className="h-8 rounded-md border border-border bg-background px-2 text-label text-foreground"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setPage(1)
            }}
            aria-label="每页条数"
          >
            <option value={10}>10 / 页</option>
            <option value={20}>20 / 页</option>
            <option value={50}>50 / 页</option>
            <option value={100}>100 / 页</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-body text-muted-foreground">
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

      {inspectId !== null && (
        <AiModelDrawer
          configId={inspectId}
          row={list.find((item) => item.id === inspectId)}
          governance={governance}
          onClose={() => setInspectId(null)}
        />
      )}

      <AiModelDialog
        open={open}
        editingId={editingId}
        form={form}
        setForm={setForm}
        savePending={saveMut.isPending}
        onSubmit={submit}
        onClose={closeDialog}
      />
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
