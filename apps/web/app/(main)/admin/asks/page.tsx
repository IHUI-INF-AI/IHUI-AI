'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@ihui/ui'

import { AsksFilter } from './AsksFilter'
import { AsksTable } from './AsksTable'
import { AskDialog } from './AskDialog'
import { api, EMPTY_FORM, PAGE_SIZE, askToForm, fetchAsks, parseTags } from './helpers'
import type { AskForm, AskItem } from './types'

// TODO 后端对接: 当前 /admin/asks 路由尚未实现,以下接口在后端就绪前可能返回 404。
// 列表通过 /api/asks 公共端点获取;创建/编辑/审核/删除调用 /api/admin/asks/* (待后端实现)。

export default function AdminAsksPage() {
  const t = useTranslations('admin.asks')
  const qc = useQueryClient()

  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<AskItem | null>(null)
  const [form, setForm] = React.useState<AskForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'asks', debounced, page],
    queryFn: () => fetchAsks({ page, search: debounced }),
    retry: false,
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title.trim(),
        content: form.content.trim(),
        tags: parseTags(form.tags),
        status: form.status,
        isResolved: form.isResolved,
      }
      // TODO 后端: /api/admin/asks POST/PUT 待实现
      return editing
        ? api(`/api/admin/asks/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : api('/api/admin/asks', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'asks'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const auditMut = useMutation({
    mutationFn: (id: string) =>
      // TODO 后端: /api/admin/asks/:id/audit PUT 待实现
      api(`/api/admin/asks/${id}/audit`, { method: 'PUT' }),
    onSuccess: () => {
      toast.success(t('auditSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'asks'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      // TODO 后端: /api/admin/asks/:id DELETE 待实现(目前 /asks/:id 仅允许本人删除)
      api(`/api/admin/asks/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'asks'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function openEdit(item: AskItem) {
    setEditing(item)
    setForm(askToForm(item))
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
    if (!form.title.trim()) return setErr(t('titleRequired'))
    if (!form.content.trim()) return setErr(t('contentRequired'))
    saveMut.mutate()
  }
  function handleAudit(item: AskItem) {
    if (window.confirm(t('auditConfirm'))) auditMut.mutate(item.id)
  }
  function handleDelete(item: AskItem) {
    if (window.confirm(t('deleteConfirm'))) deleteMut.mutate(item.id)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const list = data?.list ?? []
  const mockMode = !!error && list.length === 0

  return (
    <div className="space-y-4">
      <AsksFilter search={search} setSearch={setSearch} onCreate={openCreate} mockMode={mockMode} />
      <AsksTable
        list={list}
        isLoading={isLoading}
        error={error}
        auditPending={auditMut.isPending}
        deletePending={deleteMut.isPending}
        onEdit={openEdit}
        onAudit={handleAudit}
        onDelete={handleDelete}
      />
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            {t('prev')}
          </Button>
          <span className="text-sm text-muted-foreground">{t('pageOf', { page, totalPages })}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('next')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <AskDialog
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
