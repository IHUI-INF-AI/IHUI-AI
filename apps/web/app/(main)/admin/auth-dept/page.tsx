'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Plus, Download, Building2 } from 'lucide-react'

import { exportFromApi } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { Button } from '@ihui/ui-react'

import { AuthDeptFilter } from './AuthDeptFilter'
import { AuthDeptTable } from './AuthDeptTable'
import { AuthDeptDialog, AuthDeptDeleteDialog } from './AuthDeptDialog'
import { RESOURCE, PERM, EMPTY, EXPORT_COLS, api } from './helpers'
import type { AuthDept, AuthDeptForm, ListData } from './types'

export default function AuthDeptPage() {
  const t = useTranslations('adminAuthDept')
  const qc = useQueryClient()
  const [search, setSearch] = React.useState({ userId: '' })
  const [page, setPage] = React.useState(1)
  const [pageSize] = React.useState(10)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<AuthDept | null>(null)
  const [form, setForm] = React.useState<AuthDeptForm>(EMPTY)
  const [delId, setDelId] = React.useState<string | null>(null)

  const params = React.useMemo(() => {
    const p: Record<string, string> = { pageNum: String(page), pageSize: String(pageSize) }
    if (search.userId.trim()) p.userId = search.userId.trim()
    return p
  }, [search.userId, page, pageSize])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'auth-dept', params],
    queryFn: () => api<ListData>(`${RESOURCE}?${new URLSearchParams(params)}`),
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const saveMut = useMutation({
    mutationFn: () =>
      editing
        ? api(`${RESOURCE}/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) })
        : api(RESOURCE, { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'auth-dept'] })
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      close()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`${RESOURCE}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'auth-dept'] })
      toast.success(t('deleteSuccess'))
      setDelId(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }
  function openEdit(item: AuthDept) {
    setEditing(item)
    setForm({
      userId: item.userId ?? '',
      deptId: item.deptId ?? '',
      createdAt: item.createdAt ?? '',
    })
    setOpen(true)
  }
  function close() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.userId.trim() || !form.deptId.trim()) {
      toast.error(t('validateRequired'))
      return
    }
    saveMut.mutate()
  }
  function handleReset() {
    setSearch({ userId: '' })
    setPage(1)
  }
  async function handleExport() {
    const ok = await exportFromApi(
      `${RESOURCE}?${new URLSearchParams(params)}`,
      t('exportName'),
      EXPORT_COLS,
    )
    if (!ok) toast.error(t('exportFailed'))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Building2 className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <div className="flex gap-2">
          <HasPermi code={`${PERM}:export`}>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" />
              {t('export')}
            </Button>
          </HasPermi>
          <HasPermi code={`${PERM}:add`}>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {t('add')}
            </Button>
          </HasPermi>
        </div>
      </div>

      <AuthDeptFilter
        userId={search.userId}
        onUserIdChange={(v) => setSearch({ userId: v })}
        onSearch={() => setPage(1)}
        onReset={handleReset}
      />

      <AuthDeptTable
        list={list}
        isLoading={isLoading}
        perm={PERM}
        onEdit={openEdit}
        onDelete={(id) => setDelId(id)}
      />

      {total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('total', { total, page, totalPages })}</span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              {t('prev')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              {t('next')}
            </Button>
          </div>
        </div>
      )}

      <AuthDeptDialog
        open={open}
        editing={editing}
        form={form}
        setForm={setForm}
        savePending={saveMut.isPending}
        onSubmit={submit}
        onClose={close}
      />

      <AuthDeptDeleteDialog
        delId={delId}
        pending={delMut.isPending}
        onCancel={() => setDelId(null)}
        onConfirm={() => delId && delMut.mutate(delId)}
      />
    </div>
  )
}
