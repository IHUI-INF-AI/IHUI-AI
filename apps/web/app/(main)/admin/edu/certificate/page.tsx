'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Plus, Trash2, Loader2, ChevronLeft, ChevronRight, Award, Search } from 'lucide-react'
import { eduApi, buildQs, selectClass, type PageData } from '@/lib/edu'
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
  certificateNo: string
  title: string
  recipientName: string | null
  nickname: string | null
  source: string | null
  issuedAt: string | null
  status: number
  templateName: string | null
}
interface Template {
  id: string
  name: string
}
interface CForm {
  userId: string
  title: string
  recipientName: string
  source: string
  templateId: string
  issuedAt: string
}
const EMPTY: CForm = {
  userId: '',
  title: '',
  recipientName: '',
  source: 'manual',
  templateId: '',
  issuedAt: '',
}
const PAGE_SIZE = 10

const SOURCE_MAP: Record<string, string> = { manual: 'manual', exam: 'exam', learn: 'learn' }

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
        method: 'PATCH',
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
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu">
            <ChevronLeft className="h-4 w-4" />
            {t('backToEdu')}
          </Link>
        </Button>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="h-9 pl-8"
          />
        </div>
        <div className="w-full max-w-[140px]">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className={selectClass} aria-label={t('status')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allStatus')}</SelectItem>
              <SelectItem value="1">{t('statusValid')}</SelectItem>
              <SelectItem value="0">{t('statusRevoked')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => {
            setForm(EMPTY)
            setErr(null)
            setOpen(true)
          }}
          size="sm"
          className="ml-auto"
        >
          <Plus className="h-4 w-4" />
          {t('issueCertificate')}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">{t('colNo')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colTitle')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colRecipient')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colSource')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colIssuedAt')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('status')}</TableHead>
              <TableHead className="px-4 py-2.5 text-right">{t('colAction')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <Award className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noCertificates')}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((c) => {
                const valid = c.status === 1
                return (
                  <TableRow key={c.id} className="hover:bg-muted/30">
                    <TableCell className="px-4 py-2.5 font-mono text-xs">
                      {c.certificateNo}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <div className="font-medium">{c.title}</div>
                      {c.templateName && (
                        <div className="text-xs text-muted-foreground">{c.templateName}</div>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      {c.recipientName ?? c.nickname ?? '-'}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-xs">
                      {SOURCE_MAP[c.source ?? '']
                        ? t(`sourceLabel.${SOURCE_MAP[c.source ?? '']}`)
                        : (c.source ?? '-')}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                      {c.issuedAt ? new Date(c.issuedAt).toLocaleDateString() : '-'}
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
                        {valid ? t('statusValid') : t('statusRevoked')}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Select
                          value={String(c.status)}
                          onValueChange={(v) => statusMut.mutate({ id: c.id, next: Number(v) })}
                        >
                          <SelectTrigger className="h-8 w-[90px]" aria-label={t('status')}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">{t('statusValid')}</SelectItem>
                            <SelectItem value="0">{t('statusRevoke')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (window.confirm(t('confirmDelete'))) deleteMut.mutate(c.id)
                          }}
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
      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{t('issueCertificate')}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="cert-uid">{t('userId')}</Label>
              <Input
                id="cert-uid"
                value={form.userId}
                onChange={(e) => setForm({ ...form, userId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cert-title">{t('certificateTitle')}</Label>
              <Input
                id="cert-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cert-recipient">{t('recipientName')}</Label>
                <Input
                  id="cert-recipient"
                  value={form.recipientName}
                  onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cert-source">{t('source')}</Label>
                <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                  <SelectTrigger className={selectClass} id="cert-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">{t('sourceLabel.manual')}</SelectItem>
                    <SelectItem value="exam">{t('sourceLabel.exam')}</SelectItem>
                    <SelectItem value="learn">{t('sourceLabel.learn')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cert-tpl">{t('template')}</Label>
                <Select
                  value={form.templateId || 'none'}
                  onValueChange={(v) => setForm({ ...form, templateId: v === 'none' ? '' : v })}
                >
                  <SelectTrigger className={selectClass} id="cert-tpl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('noTemplate')}</SelectItem>
                    {templates.map((tpl) => (
                      <SelectItem key={tpl.id} value={tpl.id}>
                        {tpl.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cert-date">{t('issueDate')}</Label>
                <Input
                  id="cert-date"
                  type="datetime-local"
                  value={form.issuedAt}
                  onChange={(e) => setForm({ ...form, issuedAt: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={createMut.isPending}
              >
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('issue')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
