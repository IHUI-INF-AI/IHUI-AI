'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ShieldCheck, Plus, Download } from 'lucide-react'

import { exportToExcel } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { Button } from '@ihui/ui'
import { ExamineFilter } from './ExamineFilter'
import { ExamineTable } from './ExamineTable'
import { ExamineDialog } from './ExamineDialog'
import { ExamineChatDialog } from './ExamineChatDialog'
import { PAGE_SIZE, EMPTY_FORM, EXPORT_COLUMNS, api, formFromItem } from './helpers'
import type { Examine, ListData, ExamineForm } from './types'

export default function AdminExaminePage() {
  const t = useTranslations('admin.agents.examine')
  const qc = useQueryClient()
  const [searchAgent, setSearchAgent] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Examine | null>(null)
  const [form, setForm] = React.useState<ExamineForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)
  const [chatOpen, setChatOpen] = React.useState(false)
  const [chatTarget, setChatTarget] = React.useState<Examine | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(searchAgent)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [searchAgent])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'examine', debounced, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (debounced) qs.set('agentName', debounced)
      return api<ListData>(`/api/admin/examine?${qs.toString()}`)
    },
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        agentId: form.agentId.trim(),
        agentName: form.agentName || undefined,
        agentAvatar: form.agentAvatar || undefined,
        startTime: form.startTime || undefined,
        startPhone: form.startPhone || undefined,
        startName: form.startName || undefined,
        examineUser: form.examineUser || undefined,
        examineTime: form.examineTime || undefined,
        desc: form.desc || undefined,
        follow: form.follow || undefined,
        prologue: form.prologue || undefined,
        status: form.status ? 1 : 0,
      }
      return editing
        ? api(`/api/admin/examine/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : api('/api/admin/examine', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'examine'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/examine/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'examine'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function openEdit(item: Examine) {
    setEditing(item)
    setForm(formFromItem(item))
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
    if (!form.agentId.trim()) return setErr(t('agentIdRequired'))
    saveMut.mutate()
  }
  function handleDelete(item: Examine) {
    if (!window.confirm(t('deleteConfirm'))) return
    deleteMut.mutate(item.id)
  }
  function handleExport() {
    exportToExcel(
      t('exportName'),
      EXPORT_COLUMNS,
      (data?.list ?? []) as unknown as Record<string, unknown>[],
    )
  }
  function openChat(item: Examine) {
    setChatTarget(item)
    setChatOpen(true)
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ShieldCheck className="h-6 w-6 text-primary" />
          {t('pageHeader')}
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            {t('exportLabel')}
          </Button>
          <HasPermi code="ai:examine:add">
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {t('createLabel')}
            </Button>
          </HasPermi>
        </div>
      </div>

      <ExamineFilter value={searchAgent} onChange={setSearchAgent} />

      <ExamineTable
        list={list}
        isLoading={isLoading}
        onEdit={openEdit}
        onDelete={handleDelete}
        onChat={openChat}
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
            {t('prev')}
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
            {t('next')}
          </Button>
        </div>
      </div>

      <ExamineDialog
        open={open}
        editing={!!editing}
        form={form}
        err={err}
        isPending={saveMut.isPending}
        onFormChange={setForm}
        onClose={closeDialog}
        onSubmit={submit}
      />

      <ExamineChatDialog open={chatOpen} target={chatTarget} onClose={() => setChatOpen(false)} />
    </div>
  )
}
