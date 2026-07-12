'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { eduApi, buildQs, type PageData } from '@/lib/edu'
import { Button } from '@ihui/ui'

import { CertTemplateFilter } from './CertTemplateFilter'
import { CertTemplateTable } from './CertTemplateTable'
import { CertTemplateDialog } from './CertTemplateDialog'
import { PAGE_SIZE, EMPTY, templateToForm } from './helpers'
import type { Template, TForm } from './types'

export default function EduCertificateTemplatesPage() {
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Template | null>(null)
  const [form, setForm] = React.useState<TForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'cert', 'templates', page],
    queryFn: () =>
      eduApi<PageData<Template>>(
        `/api/admin/certificates/templates${buildQs({ page, pageSize: PAGE_SIZE })}`,
      ),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      let templateConfig: Record<string, unknown> | undefined
      const raw = form.templateConfig.trim()
      if (raw) {
        try {
          templateConfig = JSON.parse(raw)
        } catch {
          throw new Error('模板配置JSON格式错误')
        }
      }
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        backgroundImage: form.backgroundImage.trim() || undefined,
        templateConfig,
        status: form.status ? 1 : 0,
      }
      if (editing)
        return eduApi(`/api/admin/certificates/templates/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      return eduApi(`/api/admin/certificates/templates`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '创建成功')
      qc.invalidateQueries({ queryKey: ['edu', 'cert', 'templates'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      eduApi(`/api/admin/certificates/templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['edu', 'cert', 'templates'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(t: Template) {
    setEditing(t)
    setForm(templateToForm(t))
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
    saveMut.mutate()
  }
  function handleDelete(id: string) {
    if (window.confirm('确定删除？')) deleteMut.mutate(id)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">证书模板</h1>
        <p className="mt-1 text-sm text-muted-foreground">管理证书模板样式</p>
      </div>

      <CertTemplateFilter onCreate={openCreate} />

      <CertTemplateTable
        rows={rows}
        isLoading={isLoading}
        error={error ? (error as Error).message : null}
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

      <CertTemplateDialog
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
