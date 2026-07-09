'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Plus,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Award,
  FileText,
} from 'lucide-react'

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
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'

interface Certificate {
  id: string
  templateId: string | null
  userId: string
  certificateNo: string
  title: string
  recipientName: string | null
  source: string | null
  sourceId: string | null
  issuedAt: string | null
  status: number
  createdAt: string
  nickname?: string | null
  templateName?: string | null
}

interface Template {
  id: string
  name: string
  status: number
}

interface CertificatesData {
  list: Certificate[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 20

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function fetchCertificates(params: { page: number; status: string }): Promise<CertificatesData> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) })
  if (params.status && params.status !== 'all') qs.set('status', params.status)
  return api<CertificatesData>(`/api/admin/certificates?${qs.toString()}`)
}

interface CertForm {
  userId: string
  title: string
  recipientName: string
  source: string
  templateId: string
  issuedAt: string
}

const EMPTY_FORM: CertForm = {
  userId: '',
  title: '',
  recipientName: '',
  source: 'manual',
  templateId: '',
  issuedAt: '',
}

export default function AdminCertificatePage() {
  const t = useTranslations('admin.certificate')
  const qc = useQueryClient()

  const [status, setStatus] = React.useState('all')
  const [page, setPage] = React.useState(1)

  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState<CertForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    setPage(1)
  }, [status])

  const { data: templatesData } = useQuery({
    queryKey: ['admin', 'certificates', 'templates', 'all'],
    queryFn: () =>
      api<{ list: Template[] }>(`/api/admin/certificates/templates?page=1&pageSize=100`).then(
        (d) => d.list ?? [],
      ),
  })
  const templates = templatesData ?? []

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'certificates', status, page],
    queryFn: () => fetchCertificates({ page, status }),
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
      return api<{ certificate: Certificate }>(`/api/admin/certificates`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'certificates'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const statusMut = useMutation({
    mutationFn: ({ id, next }: { id: string; next: number }) =>
      api<{ certificate: Certificate }>(`/api/admin/certificates/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      }),
    onSuccess: () => {
      toast.success(t('updateSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'certificates'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/certificates/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'certificates'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }

  function closeDialog() {
    if (createMut.isPending) return
    setOpen(false)
    setErr(null)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.userId.trim()) {
      setErr(t('userIdRequired'))
      return
    }
    if (!form.title.trim()) {
      setErr(t('titleRequired'))
      return
    }
    createMut.mutate()
  }

  function handleStatusChange(cert: Certificate, next: string) {
    if (String(cert.status) === next) return
    statusMut.mutate({ id: cert.id, next: Number(next) })
  }

  function handleDelete(cert: Certificate) {
    if (!window.confirm(t('deleteConfirm'))) return
    deleteMut.mutate(cert.id)
  }

  const sourceLabel = (s: string | null) => {
    if (!s) return <span className="text-muted-foreground">—</span>
    if (s === 'exam') return t('sourceExam')
    if (s === 'learn') return t('sourceLearn')
    if (s === 'manual') return t('sourceManual')
    return s
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const certificates = data?.list ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('certificatesTitle')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('certificatesSubtitle')}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/certificate/templates">
            <FileText className="h-4 w-4" />
            {t('templatesTitle')}
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-[180px]">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className={selectClass} aria-label={t('allStatus')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allStatus')}</SelectItem>
              <SelectItem value="1">{t('valid')}</SelectItem>
              <SelectItem value="0">{t('revoked')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openCreate} size="sm" className="ml-auto">
          <Plus className="h-4 w-4" />
          {t('certificatesCreate')}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">{t('colCertificateNo')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colTitle')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colRecipient')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colSource')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colIssuedAt')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colCreatedAt')}</TableHead>
              <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={8} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : certificates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  <Award className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noData')}
                </TableCell>
              </TableRow>
            ) : (
              certificates.map((cert) => {
                const valid = cert.status === 1
                return (
                  <TableRow key={cert.id} className="hover:bg-muted/30">
                    <TableCell className="px-4 py-2.5 font-mono text-xs">
                      {cert.certificateNo}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <div className="font-medium">{cert.title}</div>
                      {cert.templateName ? (
                        <div className="text-xs text-muted-foreground">{cert.templateName}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      {cert.recipientName ?? cert.nickname ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">{sourceLabel(cert.source)}</TableCell>
                    <TableCell className="px-4 py-2.5 text-muted-foreground">
                      {cert.issuedAt ? new Date(cert.issuedAt).toLocaleString() : '—'}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                          valid
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-500',
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            valid ? 'bg-emerald-500' : 'bg-rose-500',
                          )}
                        />
                        {valid ? t('valid') : t('revoked')}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-muted-foreground">
                      {new Date(cert.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Select
                          value={String(cert.status)}
                          onValueChange={(v) => handleStatusChange(cert, v)}
                        >
                          <SelectTrigger
                            className="h-8 w-[110px]"
                            aria-label={t('fieldStatus')}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">{t('valid')}</SelectItem>
                            <SelectItem value="0">{t('revoked')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(cert)}
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
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{t('certificatesCreate')}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="cert-user">{t('fieldUserId')}</Label>
              <Input
                id="cert-user"
                value={form.userId}
                onChange={(e) => setForm({ ...form, userId: e.target.value })}
                placeholder={t('userIdPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cert-title">{t('fieldTitle')}</Label>
              <Input
                id="cert-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={t('titlePlaceholder')}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cert-recipient">{t('fieldRecipientName')}</Label>
                <Input
                  id="cert-recipient"
                  value={form.recipientName}
                  onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
                  placeholder={t('recipientNamePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cert-source">{t('fieldSource')}</Label>
                <Select
                  value={form.source}
                  onValueChange={(v) => setForm({ ...form, source: v })}
                >
                  <SelectTrigger className={selectClass} id="cert-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">{t('sourceManual')}</SelectItem>
                    <SelectItem value="exam">{t('sourceExam')}</SelectItem>
                    <SelectItem value="learn">{t('sourceLearn')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cert-template">{t('templatesTitle')}</Label>
                <Select
                  value={form.templateId || 'none'}
                  onValueChange={(v) =>
                    setForm({ ...form, templateId: v === 'none' ? '' : v })
                  }
                >
                  <SelectTrigger className={selectClass} id="cert-template">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('noCategory')}</SelectItem>
                    {templates.map((tpl) => (
                      <SelectItem key={tpl.id} value={tpl.id}>
                        {tpl.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cert-issued">{t('fieldIssuedAt')}</Label>
                <Input
                  id="cert-issued"
                  type="datetime-local"
                  value={form.issuedAt}
                  onChange={(e) => setForm({ ...form, issuedAt: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog} disabled={createMut.isPending}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
