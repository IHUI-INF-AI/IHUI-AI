'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Download, Trash2, Terminal } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { HasPermi } from '@/components/auth/HasPermi'
import { exportFromApi } from '@/lib/export-utils'
import { Button } from '@ihui/ui-react'

import { TaskDeveloperFilter } from './TaskDeveloperFilter'
import { TaskDeveloperTable } from './TaskDeveloperTable'
import { TaskDeveloperDialog } from './TaskDeveloperDialog'
import { RESOURCE, PERMS, EMPTY_FORM, EXPORT_COLS } from './helpers'
import type { TaskDeveloper, TaskDeveloperForm, PageData } from './types'

export default function TaskDeveloperPage() {
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState<Record<string, string>>({})
  const [applied, setApplied] = React.useState<Record<string, string>>({})
  const [open, setOpen] = React.useState(false)
  const [editId, setEditId] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<TaskDeveloperForm>(EMPTY_FORM)
  const [ids, setIds] = React.useState<string[]>([])

  const qs = React.useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: '10' })
    Object.entries(applied).forEach(([k, v]) => {
      if (v.trim()) p.set(k, v.trim())
    })
    return p.toString()
  }, [page, applied])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'task-developer', qs],
    queryFn: async () => {
      const r = await fetchApi<PageData>(`${RESOURCE}?${qs}`)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  const saveMut = useMutation({
    mutationFn: async () => {
      const body = {
        ...form,
        amount: Number(form.amount),
        discount: Number(form.discount),
        realAmount: Number(form.realAmount),
      }
      const url = editId ? `${RESOURCE}/${editId}` : RESOURCE
      const method = editId ? 'PUT' : 'POST'
      const r = await fetchApi(url, { method, body: JSON.stringify(body) })
      if (!r.success) throw new Error(r.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'task-developer'] })
      setOpen(false)
      toast.success(editId ? '更新成功' : '创建成功')
    },
  })

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetchApi(`${RESOURCE}/${id}`, { method: 'DELETE' })
      if (!r.success) throw new Error(r.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'task-developer'] })
      toast.success('删除成功')
    },
  })

  const batchDelMut = useMutation({
    mutationFn: async () => {
      const r = await fetchApi(`${RESOURCE}/batch`, { method: 'DELETE', body: JSON.stringify(ids) })
      if (!r.success) throw new Error(r.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'task-developer'] })
      setIds([])
      toast.success('批量删除成功')
    },
  })

  const rows = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / 10))
  const allChecked = rows.length > 0 && rows.every((r) => ids.includes(r.id))

  function toggleAll() {
    setIds(allChecked ? [] : rows.map((r) => r.id))
  }
  function toggleOne(id: string) {
    setIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  function openCreate() {
    setEditId(null)
    setForm(EMPTY_FORM)
    setOpen(true)
  }
  function openEdit(row: TaskDeveloper) {
    setEditId(row.id)
    setForm({
      taskId: row.taskId,
      accept: row.accept,
      amount: String(row.amount),
      discount: String(row.discount),
      realAmount: String(row.realAmount),
      nodes: row.nodes,
      publisher: row.publisher,
      creator: row.creator,
    })
    setOpen(true)
  }
  function closeDialog() {
    if (saveMut.isPending) return
    setOpen(false)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    saveMut.mutate()
  }
  function applySearch() {
    setPage(1)
    setApplied(search)
  }
  function resetSearch() {
    setSearch({})
    setApplied({})
    setPage(1)
  }
  function handleExport() {
    exportFromApi(`${RESOURCE}?pageSize=10000`, '任务开发者', EXPORT_COLS)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Terminal className="h-6 w-6 text-primary" />
          任务开发者管理
        </h1>
        <div className="flex gap-2">
          <HasPermi code={PERMS.export}>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" />
              导出
            </Button>
          </HasPermi>
          {ids.length > 0 && (
            <HasPermi code={PERMS.remove}>
              <Button variant="destructive" size="sm" onClick={() => batchDelMut.mutate()}>
                <Trash2 className="h-4 w-4" />
                批量删除({ids.length})
              </Button>
            </HasPermi>
          )}
          <HasPermi code={PERMS.add}>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              新增
            </Button>
          </HasPermi>
        </div>
      </div>

      <TaskDeveloperFilter
        search={search}
        setSearch={setSearch}
        onApply={applySearch}
        onReset={resetSearch}
      />

      <TaskDeveloperTable
        list={rows}
        isLoading={isLoading}
        ids={ids}
        allChecked={allChecked}
        onToggleAll={toggleAll}
        onToggleOne={toggleOne}
        onEdit={openEdit}
        onDelete={(id) => delMut.mutate(id)}
      />

      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>共 {total} 条</span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              上一页
            </Button>
            <span className="flex items-center px-2">
              {page} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              下一页
            </Button>
          </div>
        </div>
      )}

      <TaskDeveloperDialog
        open={open}
        editId={editId}
        form={form}
        setForm={setForm}
        savePending={saveMut.isPending}
        onSubmit={submit}
        onClose={closeDialog}
      />
    </div>
  )
}
