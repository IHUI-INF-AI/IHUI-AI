'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Plus,
  Edit,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FolderTree,
  Download,
} from 'lucide-react'
import { eduApi, buildQs, selectClass, type PageData } from '@/lib/edu'
import { isNotFound } from '@/lib/api-error'
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

interface Material {
  id: string
  title: string
  type: string
  fileUrl: string | null
  fileSize: number
  downloadCount: number
  lessonTitle: string | null
}
interface MForm {
  title: string
  type: string
  fileUrl: string
  lessonId: string
}
const EMPTY: MForm = { title: '', type: 'pdf', fileUrl: '', lessonId: '' }

const TYPE_MAP: Record<string, string> = {
  pdf: 'typePdf',
  video: 'typeVideo',
  audio: 'typeAudio',
  doc: 'typeDoc',
  image: 'typeImage',
  other: 'typeOther',
}

const PAGE_SIZE = 10

export default function EduLearnMaterialsPage() {
  const t = useTranslations('admin.edu.learn.materials')
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [typeFilter, setTypeFilter] = React.useState('all')
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Material | null>(null)
  const [form, setForm] = React.useState<MForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    setPage(1)
  }, [typeFilter])

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'learn', 'materials', page, typeFilter],
    queryFn: () =>
      eduApi<PageData<Material>>(
        `/api/admin/learn/materials${buildQs({ page, pageSize: PAGE_SIZE, type: typeFilter === 'all' ? '' : typeFilter })}`,
      ),
    retry: false,
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title.trim(),
        type: form.type,
        fileUrl: form.fileUrl.trim() || null,
        lessonId: form.lessonId || null,
      }
      if (editing)
        return eduApi(`/api/admin/learn/materials/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      return eduApi(`/api/admin/learn/materials`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'learn', 'materials'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/learn/materials/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'learn', 'materials'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(m: Material) {
    setEditing(m)
    setForm({ title: m.title, type: m.type, fileUrl: m.fileUrl ?? '', lessonId: '' })
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
    if (!form.title.trim()) return setErr(t('titleRequired'))
    saveMut.mutate()
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []
  const noEndpoint = isNotFound(error)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu/learn">
            <ChevronLeft className="h-4 w-4" />
            {t('backToLearn')}
          </Link>
        </Button>
        <div className="w-full max-w-[160px]">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className={selectClass} aria-label={t('typeAriaLabel')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allTypes')}</SelectItem>
              {Object.entries(TYPE_MAP).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {t(v)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openCreate} size="sm" className="ml-auto">
          <Plus className="h-4 w-4" />
          {t('create')}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">{t('colTitle')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colType')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colSize')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colDownloads')}</TableHead>
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
            ) : noEndpoint ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <FolderTree className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('endpointNotConfigured')}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <FolderTree className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('empty')}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((m) => (
                <TableRow key={m.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">{m.title}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-sky-500/10 text-sky-600 dark:text-sky-400',
                      )}
                    >
                      {TYPE_MAP[m.type] ? t(TYPE_MAP[m.type]) : m.type}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    {m.fileSize > 0 ? `${(m.fileSize / 1024).toFixed(1)} KB` : '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1">
                      <Download className="h-3.5 w-3.5 text-muted-foreground" />
                      {m.downloadCount}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(m)}
                        title={t('edit')}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (window.confirm(t('deleteConfirm'))) deleteMut.mutate(m.id)
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
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('totalItems', { total })}</span>
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
      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="m-title">{t('fieldTitle')}</Label>
              <Input
                id="m-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-type">{t('fieldType')}</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className={selectClass} id="m-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_MAP).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {t(v)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-url">{t('fieldFileUrl')}</Label>
              <Input
                id="m-url"
                value={form.fileUrl}
                onChange={(e) => setForm({ ...form, fileUrl: e.target.value })}
                placeholder="https://..."
              />
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
