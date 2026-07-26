'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Download, ChevronLeft, ChevronRight } from 'lucide-react'

import { exportToExcel } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { Button } from '@ihui/ui-react'

import { AgentTaskFilter } from './AgentTaskFilter'
import { AgentTaskTable } from './AgentTaskTable'
import { AgentTaskDialog } from './AgentTaskDialog'
import { PAGE_SIZE, api, EMPTY_FORM, agentTaskToForm } from './helpers'
import { getExportColumns } from './helpers'
import type { AgentTask, AgentTaskForm, ListData } from './types'

export default function AgentTaskPage() {
  const t = useTranslations('admin.agentTask')
  const qc = useQueryClient()
  const [searchTitle, setSearchTitle] = React.useState('')
  const [searchCreator, setSearchCreator] = React.useState('')
  const [searchClosing, setSearchClosing] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<AgentTask | null>(null)
  const [form, setForm] = React.useState<AgentTaskForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(JSON.stringify({ t: searchTitle, c: searchCreator, d: searchClosing }))
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [searchTitle, searchCreator, searchClosing])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'agent-task', debounced, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (searchTitle) qs.set('title', searchTitle)
      if (searchCreator) qs.set('creator', searchCreator)
      if (searchClosing) qs.set('closingTime', searchClosing)
      return api<ListData>(`/api/admin/agent-task?${qs.toString()}`)
    },
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title.trim(),
        context: form.context || undefined,
        lowestPrice: form.lowestPrice || undefined,
        peakPrice: form.peakPrice || undefined,
        cycle: form.cycle || undefined,
        cycleUnit: form.cycleUnit || undefined,
        closingTime: form.closingTime || undefined,
      }
      return editing
        ? api(`/api/admin/agent-task/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : api('/api/admin/agent-task', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'agent-task'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: number }) =>
      api(`/api/admin/agent-task/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }),
    onSuccess: () => {
      toast.success(t('operateSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'agent-task'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/agent-task/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'agent-task'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function openEdit(item: AgentTask) {
    setEditing(item)
    setForm(agentTaskToForm(item))
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
    if (!form.title.trim()) {
      setErr(t('titleRequired'))
      return
    }
    saveMut.mutate()
  }
  function handleDelete(item: AgentTask) {
    if (!window.confirm(t('deleteConfirm', { title: item.title ?? '' }))) return
    deleteMut.mutate(item.id)
  }
  function handleExport() {
    exportToExcel(
      t('exportName'),
      getExportColumns(t),
      (data?.list ?? []) as unknown as Record<string, unknown>[],
    )
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            {t('exportLabel')}
          </Button>
          <HasPermi code="ai:agenttask:add">
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {t('createLabel')}
            </Button>
          </HasPermi>
        </div>
      </div>

      <AgentTaskFilter
        searchTitle={searchTitle}
        setSearchTitle={setSearchTitle}
        searchCreator={searchCreator}
        setSearchCreator={setSearchCreator}
        searchClosing={searchClosing}
        setSearchClosing={setSearchClosing}
      />

      <AgentTaskTable
        list={list}
        isLoading={isLoading}
        onApprove={(id) => statusMut.mutate({ id, status: 2 })}
        onReject={(id) => statusMut.mutate({ id, status: 1 })}
        onEdit={openEdit}
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
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <AgentTaskDialog
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
