'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@ihui/ui'
import { CompaniesFilter } from './CompaniesFilter'
import { CompaniesTable } from './CompaniesTable'
import { CompanyDialog } from './CompanyDialog'
import { PAGE_SIZE, EMPTY_FORM, api, fetchCompanies } from './helpers'
import type { Company } from './types'

export default function AdminMemberCompaniesPage() {
  const t = useTranslations('admin.member')
  const qc = useQueryClient()

  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [status, setStatus] = React.useState('')
  const [page, setPage] = React.useState(1)

  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Company | null>(null)
  const [form, setForm] = React.useState(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'member', 'companies', debounced, status, page],
    queryFn: () => fetchCompanies({ page, search: debounced, status }),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        contactName: form.contactName.trim() || undefined,
        contactPhone: form.contactPhone.trim() || undefined,
        address: form.address.trim() || undefined,
        remark: form.remark.trim() || undefined,
        sort: Number(form.sort) || 0,
        status: form.status ? 1 : 0,
      }
      if (editing) {
        return api<{ company: Company }>(`/api/admin/members/companies/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      }
      return api<{ company: Company }>(`/api/admin/members/companies`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'member', 'companies'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/members/companies/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'member', 'companies'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }

  function openEdit(company: Company) {
    setEditing(company)
    setForm({
      name: company.name,
      contactName: company.contactName ?? '',
      contactPhone: company.contactPhone ?? '',
      address: company.address ?? '',
      remark: company.remark ?? '',
      sort: String(company.sort),
      status: company.status === 1,
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

  function handleDelete(company: Company) {
    if (!window.confirm(t('deleteConfirm'))) return
    deleteMut.mutate(company.id)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const companies = data?.list ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('companiesTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('companiesSubtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/members">
            <ChevronLeft className="h-4 w-4" />
            {t('backToMembers')}
          </Link>
        </Button>
      </div>

      <CompaniesFilter
        search={search}
        status={status}
        onSearchChange={setSearch}
        onStatusChange={(v) => {
          setStatus(v === 'all' ? '' : v)
          setPage(1)
        }}
        onCreate={openCreate}
      />

      <CompaniesTable
        list={companies}
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

      <CompanyDialog
        open={open}
        editing={editing}
        form={form}
        err={err}
        isPending={saveMut.isPending}
        onFormChange={setForm}
        onClose={closeDialog}
        onSubmit={submit}
      />
    </div>
  )
}
