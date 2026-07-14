'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { eduApi, buildQs, type PageData } from '@/lib/edu'
import { Button } from '@ihui/ui'

import { EMPTY, PAGE_SIZE } from './helpers'
import type { Certificate, Template, CForm } from './types'
import { CertificateFilter } from './CertificateFilter'
import { CertificateTable } from './CertificateTable'
import { CertificateDialog } from './CertificateDialog'

export default function EduCertificatePage() {
  const t = useTranslations('admin.edu.certificate')
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [status, setStatus] = React.useState('all')
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState<CForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])
  React.useEffect(() => {
    setPage(1)
  }, [status])

  const { data: tplData } = useQuery({
    queryKey: ['edu', 'cert', 'templates'],
    queryFn: () =>
      eduApi<{ list: Template[] }>(
        `/api/admin/certificates/templates${buildQs({ page: 1, pageSize: 100 })}`,
      ).then((d) => d.list ?? []),
  })
  const templates = tplData ?? []

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'cert', debounced, status, page],
    queryFn: () =>
      eduApi<PageData<Certificate>>(
        `/api/admin/certificates${buildQs({ page, pageSize: PAGE_SIZE, search: debounced, status: status === 'all' ? '' : status })}`,
      ),
  })

  const createMut = useMutation({
    mutationFn: () => {
      const body = {
        userId: form.userId.trim(),
        title: form.title.trim(),
        recipientName: form.recipientName.trim() || undefined,
        source: form.source || undefined,
        templateId: form.templateId || undefined,
        issuedAt: form.issuedAt ? new Date(form.issuedAt).toISOString() : undefined,
      }
      return eduApi(`/api/admin/certificates`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(t('issueSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'cert'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const statusMut = useMutation({
    mutationFn: ({ id, next }: { id: string; next: number }) =>
      eduApi(`/api/admin/certificates/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: next }),
      }),
    onSuccess: () => {
      toast.success(t('updateSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'cert'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/certificates/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'cert'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function closeDialog() {
    if (createMut.isPending) return
    setOpen(false)
    setForm(EMPTY)
    setErr(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.userId.trim()) return setErr(t('userIdRequired'))
    if (!form.title.trim()) return setErr(t('titleRequired'))
    createMut.mutate()
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <CertificateFilter
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        onCreate={() => {
          setForm(EMPTY)
          setErr(null)
          setOpen(true)
        }}
      />
      <CertificateTable
        rows={rows}
        isLoading={isLoading}
        error={error as Error | null}
        onStatusChange={(c, next) => statusMut.mutate({ id: c.id, next })}
        onDelete={(c) => {
          if (window.confirm(t('confirmDelete'))) deleteMut.mutate(c.id)
        }}
        deletePending={deleteMut.isPending}
      />
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('totalItems', { count: total })}</span>
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
            {t('pageInfo', { page, totalPages })}
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
      <CertificateDialog
        open={open}
        form={form}
        onFormChange={(patch) => setForm({ ...form, ...patch })}
        onClose={closeDialog}
        onSubmit={submit}
        pending={createMut.isPending}
        err={err}
        templates={templates}
      />
    </div>
  )
}
