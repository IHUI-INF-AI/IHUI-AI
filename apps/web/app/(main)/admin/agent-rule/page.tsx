'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, ChevronLeft, ChevronRight, Download } from 'lucide-react'

import { exportToExcel } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { Button } from '@ihui/ui-react'

import { AgentRuleFilter } from './AgentRuleFilter'
import { AgentRuleTable } from './AgentRuleTable'
import { AgentRuleDialog } from './AgentRuleDialog'
import { PAGE_SIZE, api, EMPTY_FORM, EXPORT_COLUMNS, agentRuleToForm } from './helpers'
import type { AgentRule, AgentRuleForm, ListData } from './types'

export default function AgentRulePage() {
  const t = useTranslations('admin.agentRule')
  const router = useRouter()
  const qc = useQueryClient()
  const [searchAgentId, setSearchAgentId] = React.useState('')
  const [searchName, setSearchName] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<AgentRule | null>(null)
  const [form, setForm] = React.useState<AgentRuleForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'agent-rule', searchAgentId, searchName, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (searchAgentId) qs.set('agentId', searchAgentId)
      if (searchName) qs.set('ruleName', searchName)
      return api<ListData>(`/api/admin/agent-rule?${qs.toString()}`)
    },
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        agentId: form.agentId.trim(),
        ruleName: form.ruleName.trim(),
        ruleCode: form.ruleCode.trim(),
        ruleType: form.ruleType,
        priority: Number(form.priority) || 0,
        status: form.status ? 1 : 0,
        description: form.description.trim() || undefined,
      }
      return editing
        ? api(`/api/admin/agent-rule/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : api('/api/admin/agent-rule', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'agent-rule'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/agent-rule/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'agent-rule'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function openEdit(item: AgentRule) {
    setEditing(item)
    setForm(agentRuleToForm(item))
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
    if (!form.ruleName.trim()) {
      setErr(t('ruleNameRequired'))
      return
    }
    saveMut.mutate()
  }
  function handleDelete(item: AgentRule) {
    if (!window.confirm(t('confirmDelete', { name: item.ruleName }))) return
    deleteMut.mutate(item.id)
  }
  function handleExport() {
    exportToExcel(
      t('exportName'),
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
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            {t('export')}
          </Button>
          <HasPermi code="ai:agentrule:add">
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {t('add')}
            </Button>
          </HasPermi>
        </div>
      </div>

      <AgentRuleFilter
        searchAgentId={searchAgentId}
        setSearchAgentId={(v) => {
          setSearchAgentId(v)
          setPage(1)
        }}
        searchName={searchName}
        setSearchName={(v) => {
          setSearchName(v)
          setPage(1)
        }}
      />

      <AgentRuleTable
        list={list}
        isLoading={isLoading}
        onParams={(item) => router.push(`/admin/agent-rule-param?ruleId=${item.id}`)}
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
            {t('prevPage')}
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
            {t('nextPage')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <AgentRuleDialog
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
