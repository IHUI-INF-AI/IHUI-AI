'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { eduApi, buildQs, type PageData } from '@/lib/edu'
import { exportFromApi } from '@/lib/export-utils'
import { Button } from '@ihui/ui'

import { EduOrganizationFilter } from './EduOrganizationFilter'
import { EduOrganizationTable } from './EduOrganizationTable'
import { EduOrganizationDialog } from './EduOrganizationDialog'
import { PAGE_SIZE, EMPTY_FORM, EMPTY_SEARCH, EXPORT_COLUMNS, organizationToForm } from './helpers'
import type { Organization, OrganizationForm, OrganizationSearch } from './types'

export default function EduOrganizationPage() {
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [q, setQ] = React.useState<OrganizationSearch>(EMPTY_SEARCH)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Organization | null>(null)
  const [form, setForm] = React.useState<OrganizationForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  const params = { page, pageSize: PAGE_SIZE, ...q }
  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'organization', params],
    queryFn: () => eduApi<PageData<Organization>>(`/api/admin/organization${buildQs(params)}`),
  })
  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        uuid: form.uuid || undefined,
        platformId: form.platformId,
        name: form.name,
        remark: form.remark || undefined,
        filePath: form.filePath || undefined,
        binding: form.binding || undefined,
      }
      return editing
        ? eduApi(`/api/admin/organization/${editing.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : eduApi(`/api/admin/organization`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '创建成功')
      qc.invalidateQueries({ queryKey: ['edu', 'organization'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/organization/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['edu', 'organization'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function openEdit(r: Organization) {
    setEditing(r)
    setForm(organizationToForm(r))
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
    if (!form.name.trim()) return setErr('名称不能为空')
    if (!form.platformId.trim()) return setErr('平台ID不能为空')
    saveMut.mutate()
  }
  function handleExport() {
    exportFromApi(
      `/api/admin/organization${buildQs({ ...q, pageSize: 10000 })}`,
      `organization_${Date.now()}`,
      EXPORT_COLUMNS,
    ).then((ok) => toast[ok ? 'success' : 'error'](ok ? '导出成功' : '导出失败'))
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">平台组织</h1>
        <p className="mt-1 text-sm text-muted-foreground">教育平台下的组织机构管理</p>
      </div>

      <EduOrganizationFilter
        search={q}
        onSearchChange={(patch) => {
          setQ({ ...q, ...patch })
          setPage(1)
        }}
        onReset={() => {
          setQ(EMPTY_SEARCH)
          setPage(1)
        }}
        onCreate={openCreate}
        onExport={handleExport}
      />

      <EduOrganizationTable
        list={rows}
        isLoading={isLoading}
        error={error as Error | null}
        deletePending={deleteMut.isPending}
        onEdit={openEdit}
        onDelete={(r) => {
          if (window.confirm('确定删除？')) deleteMut.mutate(r.id)
        }}
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
            第 {page} / {totalPages} 页
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

      <EduOrganizationDialog
        open={open}
        editing={editing}
        form={form}
        onFormChange={(patch) => setForm({ ...form, ...patch })}
        err={err}
        savePending={saveMut.isPending}
        onSubmit={submit}
        onClose={closeDialog}
      />
    </div>
  )
}
