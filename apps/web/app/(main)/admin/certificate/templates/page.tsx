'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, Loader2, ChevronLeft, ChevronRight, Award } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Switch,
} from '@ihui/ui'

interface Template {
  id: string
  name: string
  description: string | null
  backgroundImage: string | null
  templateConfig: Record<string, unknown> | null
  status: number
  createdAt: string
  updatedAt: string
}

interface TemplatesData {
  list: Template[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 20

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function fetchTemplates(params: { page: number }): Promise<TemplatesData> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) })
  return api<TemplatesData>(`/api/admin/certificates/templates?${qs.toString()}`)
}

interface TemplateForm {
  name: string
  description: string
  backgroundImage: string
  templateConfig: string
  status: boolean
}

const EMPTY_FORM: TemplateForm = {
  name: '',
  description: '',
  backgroundImage: '',
  templateConfig: '',
  status: true,
}

export default function AdminCertificateTemplatesPage() {
  const t = useTranslations('admin.certificate')
  const locale = useLocale()
  const qc = useQueryClient()

  const [page, setPage] = React.useState(1)

  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Template | null>(null)
  const [form, setForm] = React.useState<TemplateForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'certificates', 'templates', page],
    queryFn: () => fetchTemplates({ page }),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      let templateConfig: Record<string, unknown> | undefined
      const raw = form.templateConfig.trim()
      if (raw) {
        try {
          templateConfig = JSON.parse(raw)
        } catch {
          throw new Error('Invalid JSON')
        }
      }
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        backgroundImage: form.backgroundImage.trim() || undefined,
        templateConfig,
        status: form.status ? 1 : 0,
      }
      if (editing) {
        return api<{ template: Template }>(`/api/admin/certificates/templates/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      }
      return api<{ template: Template }>(`/api/admin/certificates/templates`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'certificates', 'templates'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      api(`/api/admin/certificates/templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'certificates', 'templates'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }

  function openEdit(tpl: Template) {
    setEditing(tpl)
    setForm({
      name: tpl.name,
      description: tpl.description ?? '',
      backgroundImage: tpl.backgroundImage ?? '',
      templateConfig: tpl.templateConfig ? JSON.stringify(tpl.templateConfig, null, 2) : '',
      status: tpl.status === 1,
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

  function handleDelete(tpl: Template) {
    if (!window.confirm(t('deleteConfirm'))) return
    deleteMut.mutate(tpl.id)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const templates = data?.list ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('templatesTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('templatesSubtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/certificate">
            <ChevronLeft className="h-4 w-4" />
            {t('backToCertificate')}
          </Link>
        </Button>
        <Button onClick={openCreate} size="sm" className="ml-auto">
          <Plus className="h-4 w-4" />
          {t('templatesCreate')}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">{t('colName')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colDescription')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colCreatedAt')}</TableHead>
              <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <Award className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noData')}
                </TableCell>
              </TableRow>
            ) : (
              templates.map((tpl) => {
                const enabled = tpl.status === 1
                return (
                  <TableRow key={tpl.id} className="hover:bg-muted/30">
                    <TableCell className="px-4 py-2.5 font-medium">{tpl.name}</TableCell>
                    <TableCell className="px-4 py-2.5">
                      {tpl.description ? (
                        <span className="max-w-xs break-words text-sm text-muted-foreground">
                          {tpl.description}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                          enabled
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            enabled ? 'bg-emerald-500' : 'bg-muted-foreground',
                          )}
                        />
                        {enabled ? t('enabled') : t('disabled')}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-muted-foreground">
                      {new Intl.DateTimeFormat(locale).format(new Date(tpl.createdAt))}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(tpl)}
                          title={t('edit')}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(tpl)}
                          title={t('delete')}
                          className="text-destructive hover:text-destructive"
                          disabled={deleteMut.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

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

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {editing ? t('templatesEditTitle') : t('templatesCreateTitle')}
              </DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="tpl-name">{t('fieldName')}</Label>
              <Input
                id="tpl-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t('namePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-desc">{t('fieldDescription')}</Label>
              <Input
                id="tpl-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t('descriptionPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-bg">{t('fieldBackgroundImage')}</Label>
              <Input
                id="tpl-bg"
                value={form.backgroundImage}
                onChange={(e) => setForm({ ...form, backgroundImage: e.target.value })}
                placeholder={t('backgroundImagePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-config">{t('fieldTemplateConfig')}</Label>
              <textarea
                id="tpl-config"
                value={form.templateConfig}
                onChange={(e) => setForm({ ...form, templateConfig: e.target.value })}
                placeholder={t('templateConfigPlaceholder')}
                className="min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="tpl-status"
                checked={form.status}
                onCheckedChange={(v) => setForm({ ...form, status: v })}
              />
              <Label htmlFor="tpl-status">{t('fieldStatus')}</Label>
              <span className="text-sm text-muted-foreground">
                {form.status ? t('enabled') : t('disabled')}
              </span>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={saveMut.isPending}
              >
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
