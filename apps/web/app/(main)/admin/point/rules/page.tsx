'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@ihui/ui'

import { RuleFilter } from './RuleFilter'
import { RuleTable } from './RuleTable'
import { RuleDialog } from './RuleDialog'
import { PAGE_SIZE, api, EMPTY_FORM, ruleToForm } from './helpers'
import type { Channel, Rule, RuleForm, RulesData } from './types'

export default function AdminPointRulesPage() {
  const t = useTranslations('admin.point')
  const qc = useQueryClient()

  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Rule | null>(null)
  const [form, setForm] = React.useState<RuleForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data: channelsData } = useQuery({
    queryKey: ['admin', 'point', 'channels', 'all'],
    queryFn: () =>
      api<{ list: Channel[] }>(`/api/admin/edu-points/channels`).then((d) => d.list ?? []),
  })
  const channels = channelsData ?? []

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'point', 'rules', debounced, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (debounced) qs.set('name', debounced)
      return api<RulesData>(`/api/admin/edu-points/rules?${qs.toString()}`)
    },
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        channelId: form.channelId || undefined,
        point: Number(form.point) || 0,
        description: form.description.trim() || undefined,
        sort: Number(form.sort) || 0,
        status: form.status ? 1 : 0,
      }
      if (editing) {
        return api<{ point: Rule }>(`/api/admin/edu-points/rules/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      }
      return api<{ point: Rule }>(`/api/admin/edu-points/rules`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'point', 'rules'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/edu-points/rules/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'point', 'rules'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }

  function openEdit(rule: Rule) {
    setEditing(rule)
    setForm(ruleToForm(rule))
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

  function handleDelete(rule: Rule) {
    if (!window.confirm(t('deleteConfirm'))) return
    deleteMut.mutate(rule.id)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rules = data?.list ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('rulesTitle')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('rulesSubtitle')}</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4" />
          {t('rulesCreate')}
        </Button>
      </div>

      <RuleFilter search={search} setSearch={setSearch} />

      <RuleTable
        list={rules}
        channels={channels}
        isLoading={isLoading}
        error={error as Error | null}
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

      <RuleDialog
        open={open}
        editing={editing}
        form={form}
        setForm={setForm}
        err={err}
        savePending={saveMut.isPending}
        channels={channels}
        onSubmit={submit}
        onClose={closeDialog}
      />
    </div>
  )
}
