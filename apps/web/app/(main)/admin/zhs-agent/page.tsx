'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, ChevronLeft, ChevronRight, Download } from 'lucide-react'

import { exportToExcel } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { Button } from '@ihui/ui'

import { ZhsAgentFilter } from './ZhsAgentFilter'
import { ZhsAgentTable } from './ZhsAgentTable'
import { ZhsAgentDialog } from './ZhsAgentDialog'
import { PAGE_SIZE, api, EMPTY_FORM, EXPORT_COLUMNS, zhsAgentToForm } from './helpers'
import type { ZhsAgent, ZhsAgentForm, ListData } from './types'

export default function ZhsAgentPage() {
  const qc = useQueryClient()
  const [searchName, setSearchName] = React.useState('')
  const [searchField1, setSearchField1] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ZhsAgent | null>(null)
  const [form, setForm] = React.useState<ZhsAgentForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(JSON.stringify({ n: searchName, f: searchField1 }))
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [searchName, searchField1])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'zhs-agent', debounced, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (searchName) qs.set('name', searchName)
      if (searchField1) qs.set('field1', searchField1)
      return api<ListData>(`/api/admin/zhs-agent?${qs.toString()}`)
    },
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        consume: form.consume || undefined,
        image: form.image || undefined,
        url: form.url || undefined,
        info: form.info || undefined,
        remark: form.remark || undefined,
        seqencing: Number(form.seqencing) || 0,
        price: form.price || undefined,
        heat: form.heat || undefined,
        field1: form.field1 || undefined,
      }
      return editing
        ? api(`/api/admin/zhs-agent/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : api('/api/admin/zhs-agent', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '新增成功')
      qc.invalidateQueries({ queryKey: ['admin', 'zhs-agent'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/zhs-agent/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'zhs-agent'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function openEdit(item: ZhsAgent) {
    setEditing(item)
    setForm(zhsAgentToForm(item))
    setErr(null)
    setOpen(true)
  }
  function closeDialog() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
    setErr(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.name.trim()) {
      setErr('请输入名称')
      return
    }
    saveMut.mutate()
  }
  function handleDelete(item: ZhsAgent) {
    if (!window.confirm(`确认删除 "${item.name}" ?`)) return
    deleteMut.mutate(item.id)
  }
  function handleExport() {
    exportToExcel(
      'ZHS Agent',
      EXPORT_COLUMNS,
      (data?.list ?? []) as unknown as Record<string, unknown>[],
    )
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">ZHS Agent管理</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            导出
          </Button>
          <HasPermi code="ai:zhsagent:add">
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              新增
            </Button>
          </HasPermi>
        </div>
      </div>

      <ZhsAgentFilter
        searchName={searchName}
        setSearchName={setSearchName}
        searchField1={searchField1}
        setSearchField1={setSearchField1}
      />

      <ZhsAgentTable list={list} isLoading={isLoading} onEdit={openEdit} onDelete={handleDelete} />

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
            上一页
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
            下一页
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ZhsAgentDialog
        open={open}
        editing={editing}
        form={form}
        setForm={setForm}
        err={err}
        savePending={saveMut.isPending}
        onSubmit={submit}
        onClose={closeDialog}
      />
    </div>
  )
}
