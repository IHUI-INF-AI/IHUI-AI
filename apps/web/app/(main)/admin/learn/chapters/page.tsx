'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Plus,
  Edit,
  Trash2,
  Loader2,
  ListOrdered,
  ChevronLeft,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
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

interface Lesson {
  id: string
  title: string
  isPublished: boolean
}

interface Chapter {
  id: string
  lessonId: string
  title: string
  sortOrder: number
  createdAt: string
}

interface LessonsData {
  list: Lesson[]
  total: number
}

interface ChaptersData {
  list: Chapter[]
}

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

interface ChapterForm {
  title: string
  sortOrder: string
}

const EMPTY_FORM: ChapterForm = {
  title: '',
  sortOrder: '0',
}

function ChaptersContent() {
  const t = useTranslations('admin.learn')
  const router = useRouter()
  const searchParams = useSearchParams()
  const qc = useQueryClient()

  const initialLessonId = searchParams.get('lessonId') ?? ''
  const [lessonId, setLessonId] = React.useState(initialLessonId)

  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Chapter | null>(null)
  const [form, setForm] = React.useState<ChapterForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  const { data: lessonsData } = useQuery({
    queryKey: ['admin', 'learn', 'lessons', 'all'],
    queryFn: () =>
      api<LessonsData>(`/api/admin/learn/lessons?page=1&pageSize=100`).then((d) => d),
  })
  const lessons = lessonsData?.list ?? []

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'learn', 'chapters', lessonId],
    queryFn: () =>
      api<ChaptersData>(`/api/admin/learn/lessons/${lessonId}/chapters`).then((d) => d.list ?? []),
    enabled: !!lessonId,
  })

  const createMut = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title.trim(),
        sortOrder: Number(form.sortOrder) || 0,
      }
      return api(`/api/admin/learn/lessons/${lessonId}/chapters`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'learn', 'chapters', lessonId] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const updateMut = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title.trim(),
        sortOrder: Number(form.sortOrder) || 0,
      }
      return api(
        `/api/admin/learn/lessons/${lessonId}/chapters/${editing?.id}`,
        {
          method: 'PUT',
          body: JSON.stringify(body),
        },
      )
    },
    onSuccess: () => {
      toast.success(t('updateSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'learn', 'chapters', lessonId] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      api(`/api/admin/learn/lessons/${lessonId}/chapters/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'learn', 'chapters', lessonId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }

  function openEdit(ch: Chapter) {
    setEditing(ch)
    setForm({
      title: ch.title,
      sortOrder: String(ch.sortOrder),
    })
    setErr(null)
    setOpen(true)
  }

  function closeDialog() {
    if (createMut.isPending || updateMut.isPending) return
    setOpen(false)
    setEditing(null)
    setErr(null)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!lessonId) {
      setErr(t('selectLessonPlaceholder'))
      return
    }
    if (!form.title.trim()) {
      setErr(t('titleRequired'))
      return
    }
    if (editing) updateMut.mutate()
    else createMut.mutate()
  }

  function handleDelete(ch: Chapter) {
    if (!window.confirm(t('deleteConfirm'))) return
    deleteMut.mutate(ch.id)
  }

  function onLessonChange(v: string) {
    setLessonId(v)
    const params = new URLSearchParams(searchParams.toString())
    if (v) params.set('lessonId', v)
    else params.delete('lessonId')
    router.replace(`/admin/learn/chapters?${params.toString()}`)
  }

  const chapters = data ?? []
  const saving = createMut.isPending || updateMut.isPending

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('chaptersTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('chaptersSubtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/learn">
            <ChevronLeft className="h-4 w-4" />
            {t('backToLearn')}
          </Link>
        </Button>
        <div className="w-full max-w-sm">
          <Select value={lessonId} onValueChange={onLessonChange}>
            <SelectTrigger className={selectClass} aria-label={t('selectLesson')}>
              <SelectValue placeholder={t('selectLessonPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {lessons.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.title}
                  {!l.isPublished ? `（${t('unpublished')}）` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openCreate} size="sm" className="ml-auto" disabled={!lessonId}>
          <Plus className="h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">{t('colTitle')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colSort')}</TableHead>
              <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {!lessonId ? (
              <TableRow>
                <TableCell colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                  <ListOrdered className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noLessonSelected')}
                </TableCell>
              </TableRow>
            ) : isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={3} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : chapters.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                  <ListOrdered className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noData')}
                </TableCell>
              </TableRow>
            ) : (
              chapters.map((ch) => (
                <TableRow key={ch.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">{ch.title}</TableCell>
                  <TableCell className="px-4 py-2.5">{ch.sortOrder}</TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(ch)}
                        title={t('edit')}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(ch)}
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
              <Label htmlFor="ch-title">{t('fieldTitle')}</Label>
              <Input
                id="ch-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={t('titlePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch-sort">{t('fieldSort')}</Label>
              <Input
                id="ch-sort"
                type="number"
                min="0"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog} disabled={saving}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('saveBtn')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function AdminLearnChaptersPage() {
  const t = useTranslations('admin.learn')
  return (
    <React.Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      }
    >
      <ChaptersContent />
    </React.Suspense>
  )
}
