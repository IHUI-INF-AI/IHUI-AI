'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, FolderCog, Plus } from 'lucide-react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui'

import { ProjectTable } from './ProjectTable'
import { ProjectDialog } from './ProjectDialog'
import { PAGE_SIZE, api, EMPTY_FORM, projectToForm } from './helpers'
import type { AdminProject, ProjectForm, PageData } from './types'

export default function AdminProjectsPage() {
  const t = useTranslations('admin.projects')
  const tc = useTranslations('common')
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<AdminProject | null>(null)
  const [delTarget, setDelTarget] = React.useState<AdminProject | null>(null)
  const [form, setForm] = React.useState<ProjectForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'projects', page],
    queryFn: () => api<PageData>(`/api/admin/projects?page=${page}&pageSize=${PAGE_SIZE}`),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim() || null,
      }
      if (editing) {
        body.status = form.status
        return api(`/api/admin/projects/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      }
      body.userId = form.userId.trim()
      body.status = form.status
      return api('/api/admin/projects', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'projects'] })
      close()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/projects/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'projects'] })
      setDelTarget(null)
    },
    onError: (e: Error) => setErr(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function openEdit(p: AdminProject) {
    setEditing(p)
    setForm(projectToForm(p))
    setErr(null)
    setOpen(true)
  }
  function close() {
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
    if (!editing && !form.userId.trim()) {
      setErr(t('userIdRequired'))
      return
    }
    saveMut.mutate()
  }
  function handleDelete(p: AdminProject) {
    setErr(null)
    setDelTarget(p)
  }
  function handleFormChange(patch: Partial<ProjectForm>) {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <FolderCog className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      <ProjectTable
        list={list}
        isLoading={isLoading}
        error={error as Error | null}
        page={page}
        total={total}
        totalPages={totalPages}
        onEdit={openEdit}
        onDelete={handleDelete}
        onPageChange={setPage}
      />

      <ProjectDialog
        open={open}
        editing={editing}
        form={form}
        onFormChange={handleFormChange}
        err={err}
        savePending={saveMut.isPending}
        onSubmit={submit}
        onClose={close}
      />

      <Dialog
        open={!!delTarget}
        onOpenChange={(o) => {
          if (!o && !delMut.isPending) setDelTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>{t('deleteConfirm')}</DialogDescription>
          </DialogHeader>
          {delTarget && (
            <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
              <div className="font-medium">{delTarget.name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {t('owner')}:{' '}
                {delTarget.ownerNickname ?? delTarget.ownerPhone ?? delTarget.ownerEmail ?? '-'} ·{' '}
                {t(`status_${delTarget.status}`)}
              </div>
            </div>
          )}
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDelTarget(null)}
              disabled={delMut.isPending}
            >
              {tc('cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={delMut.isPending}
              onClick={() => delMut.mutate(delTarget!.id)}
            >
              {delMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {tc('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
