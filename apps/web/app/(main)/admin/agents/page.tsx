'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Plus, ChevronLeft, ChevronRight, Bot } from 'lucide-react'

import { Button } from '@ihui/ui'
import { AgentsFilter } from './AgentsFilter'
import { AgentsTable } from './AgentsTable'
import { AgentEditDialog } from './AgentEditDialog'
import { PAGE_SIZE, EMPTY_FORM, api, fetchAgents } from './helpers'
import type { Agent, AgentForm, CategoriesData } from './types'

export default function AdminAgentsPage() {
  const t = useTranslations('admin.agents')
  const tc = useTranslations('common')
  const qc = useQueryClient()

  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [status, setStatus] = React.useState('all')
  const [page, setPage] = React.useState(1)

  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Agent | null>(null)
  const [form, setForm] = React.useState<AgentForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data: catData } = useQuery({
    queryKey: ['agents', 'categories'],
    queryFn: () => api<CategoriesData>(`/api/categories/list?page=1&pageSize=100`),
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'agents', debounced, status, page],
    queryFn: () => fetchAgents({ page, keyword: debounced, status }),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        avatar: form.avatar.trim() || undefined,
        cover: form.cover.trim() || undefined,
        categoryId: form.categoryId || undefined,
        status: form.status,
        price: Number(form.price) || 0,
        isFree: form.isFree,
        sort: Number(form.sort) || 0,
        remark: form.remark.trim() || undefined,
      }
      return api<Agent>(`/api/agents/${editing!.agentId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(t('updateSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'agents'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/agents/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'agents'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openEdit(agent: Agent) {
    setEditing(agent)
    setForm({
      name: agent.name,
      description: agent.description ?? '',
      avatar: agent.avatar ?? '',
      cover: agent.cover ?? '',
      categoryId: agent.categoryId ?? '',
      status: agent.status,
      price: String(agent.price),
      isFree: agent.isFree,
      sort: String(agent.sort),
      remark: agent.remark ?? '',
    })
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
      setErr(t('nameRequired'))
      return
    }
    saveMut.mutate()
  }

  function handleDelete(agent: Agent) {
    if (!window.confirm(t('deleteConfirm'))) return
    deleteMut.mutate(agent.agentId)
  }

  const categories = catData?.list ?? []
  const agents = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Bot className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button asChild size="sm">
          <Link href="/agents/create">
            <Plus className="h-4 w-4" />
            {tc('create')}
          </Link>
        </Button>
      </div>

      <AgentsFilter
        search={search}
        status={status}
        onSearchChange={setSearch}
        onStatusChange={(v) => {
          setStatus(v)
          setPage(1)
        }}
      />

      <AgentsTable
        list={agents}
        isLoading={isLoading}
        error={error as Error | null}
        categories={categories}
        deletePending={deleteMut.isPending}
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
            {t('page', { page, total: totalPages })}
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

      <AgentEditDialog
        open={open}
        form={form}
        err={err}
        isPending={saveMut.isPending}
        categories={categories}
        onFormChange={setForm}
        onClose={closeDialog}
        onSubmit={submit}
      />
    </div>
  )
}
