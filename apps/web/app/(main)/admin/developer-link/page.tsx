'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, ChevronLeft, ChevronRight, Download } from 'lucide-react'

import { exportToExcel } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { Button } from '@ihui/ui'

import { DeveloperLinkFilter } from './DeveloperLinkFilter'
import { DeveloperLinkTable } from './DeveloperLinkTable'
import { DeveloperLinkDialog } from './DeveloperLinkDialog'
import { PAGE_SIZE, api, EMPTY_FORM, EXPORT_COLUMNS, developerLinkToForm } from './helpers'
import type { DeveloperLink, DeveloperLinkForm, ListData } from './types'

export default function DeveloperLinkPage() {
  const qc = useQueryClient()
  const [searchDeveloper, setSearchDeveloper] = React.useState('')
  const [searchAgent, setSearchAgent] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<DeveloperLink | null>(null)
  const [form, setForm] = React.useState<DeveloperLinkForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'developer-link', searchDeveloper, searchAgent, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (searchDeveloper) qs.set('developerId', searchDeveloper)
      if (searchAgent) qs.set('agentId', searchAgent)
      return api<ListData>(`/api/admin/developer-link?${qs.toString()}`)
    },
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        developerId: form.developerId.trim(),
        agentId: form.agentId.trim(),
        status: form.status ? 1 : 0,
      }
      return editing
        ? api(`/api/admin/developer-link/${editing.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : api('/api/admin/developer-link', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '新增成功')
      qc.invalidateQueries({ queryKey: ['admin', 'developer-link'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/developer-link/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'developer-link'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function openEdit(item: DeveloperLink) {
    setEditing(item)
    setForm(developerLinkToForm(item))
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
    if (!form.developerId.trim()) {
      setErr('请输入开发者ID')
      return
    }
    saveMut.mutate()
  }
  function handleDelete(item: DeveloperLink) {
    if (!window.confirm('确认删除该记录?')) return
    deleteMut.mutate(item.id)
  }
  function handleExport() {
    exportToExcel(
      '开发者链接',
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
        <h1 className="text-2xl font-bold tracking-tight">开发者链接管理</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            导出
          </Button>
          <HasPermi code="ai:developerlink:add">
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              新增
            </Button>
          </HasPermi>
        </div>
      </div>

      <DeveloperLinkFilter
        searchDeveloper={searchDeveloper}
        setSearchDeveloper={(v) => {
          setSearchDeveloper(v)
          setPage(1)
        }}
        searchAgent={searchAgent}
        setSearchAgent={(v) => {
          setSearchAgent(v)
          setPage(1)
        }}
      />

      <DeveloperLinkTable
        list={list}
        isLoading={isLoading}
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

      <DeveloperLinkDialog
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
