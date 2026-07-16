'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { eduApi, buildQs, type PageData } from '@/lib/edu'
import { Button } from '@ihui/ui'

import { CertTemplateFilter } from './CertTemplateFilter'
import { CertTemplateTable } from './CertTemplateTable'
import { CertTemplateDialog } from './CertTemplateDialog'
import { PAGE_SIZE, EMPTY, templateToForm, encodeValidityPolicy } from './helpers'
import type { Template, TForm } from './types'

export default function EduCertificateTemplatesPage() {
  const t = useTranslations('admin.eduCertTemplate')
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
          throw new Error(t('configJsonError'))
        }
      }
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        awardingOrganization: form.awardingOrganization.trim(),
        awarderName: form.awarderName.trim(),
        awardConditions: form.awardConditions.trim(),
        validityPolicy: encodeValidityPolicy(form),
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
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'cert', 'templates'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      eduApi(`/api/admin/certificates/templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
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
    if (!form.name.trim()) return setErr(t('nameRequired'))
    if (!form.awardingOrganization.trim()) return setErr(t('awardingOrganizationRequired'))
    if (!form.awarderName.trim()) return setErr(t('awarderNameRequired'))
    if (!form.awardConditions.trim()) return setErr(t('awardConditionsRequired'))
    if (!form.validityPolicy) return setErr(t('validityPolicyRequired'))
    saveMut.mutate()
  }
  function handleDelete(id: string) {
    if (window.confirm(t('deleteConfirm'))) deleteMut.mutate(id)
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
