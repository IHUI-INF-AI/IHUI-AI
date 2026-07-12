'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Plus, Download, Crown } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { exportFromApi } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui'

import { AuthUserVipFilter } from './AuthUserVipFilter'
import { AuthUserVipTable } from './AuthUserVipTable'
import { AuthUserVipDialog } from './AuthUserVipDialog'
import {
  RESOURCE,
  PERM,
  PAGE_SIZE,
  api,
  EMPTY_FORM,
  EMPTY_SEARCH,
  EXPORT_COLS,
  buildQuery,
  authUserVipToForm,
} from './helpers'
import type { AuthUserVip, AuthUserVipForm, AuthUserVipSearch, ListData } from './types'

export default function AuthUserVipPage() {
  const t = useTranslations('adminAuthUserVip')
  const qc = useQueryClient()
  const [search, setSearch] = React.useState<AuthUserVipSearch>(EMPTY_SEARCH)
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<AuthUserVip | null>(null)
  const [form, setForm] = React.useState<AuthUserVipForm>(EMPTY_FORM)
  const [delId, setDelId] = React.useState<string | null>(null)

  const params = React.useMemo(() => buildQuery(search, page, PAGE_SIZE), [search, page])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'auth-user-vip', params],
    queryFn: () => api<ListData>(`${RESOURCE}?${new URLSearchParams(params)}`),
  })

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const saveMut = useMutation({
    mutationFn: () =>
      editing
        ? api(`${RESOURCE}/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) })
        : api(RESOURCE, { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'auth-user-vip'] })
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      close()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`${RESOURCE}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'auth-user-vip'] })
      toast.success(t('deleteSuccess'))
      setDelId(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setOpen(true)
  }
  function openEdit(item: AuthUserVip) {
    setEditing(item)
    setForm(authUserVipToForm(item))
    setOpen(true)
  }
  function close() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.vipId.trim() || !form.progress.trim()) {
      toast.error(t('validateRequired'))
      return
    }
    saveMut.mutate()
  }
  function handleSearchChange(patch: Partial<AuthUserVipSearch>) {
    setSearch((prev) => ({ ...prev, ...patch }))
  }
  function handleReset() {
    setSearch(EMPTY_SEARCH)
    setPage(1)
  }
  async function handleExport() {
    const ok = await exportFromApi(
      `${RESOURCE}?${new URLSearchParams(params)}`,
      t('exportName'),
      EXPORT_COLS,
    )
    if (!ok) toast.error(t('exportFailed'))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Crown className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <div className="flex gap-2">
          <HasPermi code={`${PERM}:export`}>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" />
              {t('export')}
            </Button>
          </HasPermi>
          <HasPermi code={`${PERM}:add`}>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {t('add')}
            </Button>
          </HasPermi>
        </div>
      </div>

      <AuthUserVipFilter
        search={search}
        onSearchChange={handleSearchChange}
        onReset={handleReset}
        onQuery={() => setPage(1)}
      />

      <AuthUserVipTable
        list={list}
        isLoading={isLoading}
        total={total}
        page={page}
        totalPages={totalPages}
        onEdit={openEdit}
        onDelete={setDelId}
        onPageChange={setPage}
      />

      <AuthUserVipDialog
        open={open}
        editing={editing}
        form={form}
        onFormChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
        savePending={saveMut.isPending}
        onSubmit={submit}
        onClose={close}
      />

      <Dialog
        open={delId !== null}
        onOpenChange={(o) => {
          if (!o) setDelId(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>{t('deleteDesc')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDelId(null)}
              disabled={delMut.isPending}
            >
              {t('cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={delMut.isPending}
              onClick={() => delId && delMut.mutate(delId)}
            >
              {delMut.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
