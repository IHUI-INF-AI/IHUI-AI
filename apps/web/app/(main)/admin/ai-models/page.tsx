'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { AiModelDialog } from './AiModelDialog'
import { AiModelsFilter } from './AiModelsFilter'
import { AiModelsTable } from './AiModelsTable'
import { PAGE_SIZE, EMPTY_FORM, api, rowToForm, formToBody } from './helpers'
import type { ModelRow, ListData, FormState, TestResult } from './types'

export default function AiModelsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)
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
    queryKey: ['admin', 'ai-model-config', debounced, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (debounced) qs.set('search', debounced)
      return api<ListData>(`/api/admin/ai-model-config?${qs.toString()}`)
    },
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
    if (!window.confirm(`确认删除「${item.name}」?`)) return
    deleteMut.mutate(item.id)
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <AiModelsFilter search={search} onSearchChange={setSearch} onCreate={openCreate} />

      <AiModelsTable
        list={list}
        isLoading={isLoading}
        togglePending={toggleMut.isPending}
        testPending={testMut.isPending}
        onToggle={toggleMut.mutate}
        onTest={testMut.mutate}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

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
