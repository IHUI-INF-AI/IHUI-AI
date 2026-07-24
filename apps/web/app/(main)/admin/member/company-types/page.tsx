'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@ihui/ui-react'

import { CompanyTypeFilter } from './CompanyTypeFilter'
import { CompanyTypeTable } from './CompanyTypeTable'
import { CompanyTypeDialog } from './CompanyTypeDialog'
import { PAGE_SIZE, api, fetchCompanyTypes, EMPTY_FORM, companyTypeToForm } from './helpers'
import type { CompanyType, CompanyTypeForm } from './types'

export default function AdminMemberCompanyTypesPage() {
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<CompanyType | null>(null)
  const [form, setForm] = React.useState<CompanyTypeForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'member', 'company-types', page],
    queryFn: () => fetchCompanyTypes({ page }),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        sort: Number(form.sort) || 0,
        status: form.status ? 1 : 0,
      }
      if (editing) {
        return api<{ type: CompanyType }>(`/api/admin/members/company-types/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      }
      return api<{ type: CompanyType }>(`/api/admin/members/company-types`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '创建成功')
      qc.invalidateQueries({ queryKey: ['admin', 'member', 'company-types'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/members/company-types/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'member', 'company-types'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function openEdit(type: CompanyType) {
    setEditing(type)
    setForm(companyTypeToForm(type))
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
      setErr('名称不能为空')
      return
    }
    saveMut.mutate()
  }
  function handleDelete(type: CompanyType) {
    if (!window.confirm(`确定删除「${type.name}」？`)) return
    deleteMut.mutate(type.id)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const types = data?.list ?? []

  return (
    <div className="space-y-4">
      <CompanyTypeFilter onCreate={openCreate} />
      <CompanyTypeTable
        list={types}
        isLoading={isLoading}
        error={error as Error | null}
        deletePending={deleteMut.isPending}
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
      <CompanyTypeDialog
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
