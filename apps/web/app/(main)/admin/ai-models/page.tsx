'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, ChevronLeft, ChevronRight, Pencil, Trash2, Zap } from 'lucide-react'
import { Button, Input, Switch } from '@ihui/ui'
import { AiModelDialog } from './AiModelDialog'
import {
  PAGE_SIZE,
  EMPTY_FORM,
  api,
  rowToForm,
  formToBody,
  type ModelRow,
  type ListData,
  type FormState,
  type TestResult,
} from './helpers'

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">AI 模型配置</h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          新增
        </Button>
      </div>

      <Input
        placeholder="搜索模型名称..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <div className="rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">名称</th>
              <th className="px-3 py-2 text-left font-medium">Provider</th>
              <th className="px-3 py-2 text-left font-medium">Base URL</th>
              <th className="px-3 py-2 text-left font-medium">格式</th>
              <th className="px-3 py-2 text-left font-medium">Key</th>
              <th className="px-3 py-2 text-left font-medium">启用</th>
              <th className="px-3 py-2 text-left font-medium">测试</th>
              <th className="px-3 py-2 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  加载中...
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  暂无数据
                </td>
              </tr>
            ) : (
              list.map((item) => (
                <tr key={item.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{item.providerCode}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground max-w-[200px] truncate">
                    {item.baseUrl}
                  </td>
                  <td className="px-3 py-2 text-xs">{item.apiFormat}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs ${
                        item.hasApiKey
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {item.hasApiKey ? '已配置' : '未配置'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Switch
                      checked={item.enabled}
                      onCheckedChange={() => toggleMut.mutate(item)}
                      disabled={toggleMut.isPending}
                    />
                  </td>
                  <td className="px-3 py-2">
                    {item.lastTestStatus ? (
                      <span
                        className={`text-xs ${
                          item.lastTestStatus === 'success'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {item.lastTestStatus === 'success'
                          ? `成功 ${item.lastTestResponseMs ?? 0}ms`
                          : '失败'}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">未测试</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => testMut.mutate(item.id)}
                        disabled={testMut.isPending}
                        title="测试连通"
                      >
                        <Zap className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(item)} title="编辑">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(item)}
                        title="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
