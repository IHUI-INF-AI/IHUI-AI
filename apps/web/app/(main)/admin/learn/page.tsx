'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  FolderTree,
  ListOrdered,
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
  Switch,
  Card,
  CardContent,
} from '@ihui/ui'

interface Lesson {
  id: string
  title: string
  coverImage: string | null
  intro: string | null
  categoryId: string | null
  categoryName: string | null
  lecturerId: string | null
  lecturerName: string | null
  price: string
  originalPrice: string | null
  isFree: boolean
  isPublished: boolean
  sort: number
  viewCount: number
  signupCount: number
  status: number
  createdAt: string
  updatedAt: string
}

interface Category {
  id: string
  name: string
  sort: number
  status: number
}

interface LessonsData {
  list: Lesson[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 10

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function fetchLessons(params: { page: number; search: string; categoryId: string }): Promise<LessonsData> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) })
  if (params.search) qs.set('search', params.search)
  if (params.categoryId && params.categoryId !== 'all') qs.set('categoryId', params.categoryId)
  return api<LessonsData>(`/api/admin/learn/lessons?${qs.toString()}`)
}

interface LessonForm {
  title: string
  categoryId: string
  intro: string
  lecturerName: string
  price: string
  isFree: boolean
  isPublished: boolean
  sort: string
}

const EMPTY_FORM: LessonForm = {
  title: '',
  categoryId: '',
  intro: '',
  lecturerName: '',
  price: '0',
  isFree: false,
  isPublished: false,
  sort: '0',
}

function StatCard({
  icon: Icon,
  label,
  value,
  gradient,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  gradient: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={cn(
            'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-white',
            gradient,
          )}
        >
          <Icon className="h-7 w-7" />
        </div>
        <div className="min-w-0">
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminLearnPage() {
  const t = useTranslations('admin.learn')
  const qc = useQueryClient()

  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [categoryId, setCategoryId] = React.useState('all')
  const [page, setPage] = React.useState(1)

  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Lesson | null>(null)
  const [form, setForm] = React.useState<LessonForm>(EMPTY_FORM)
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
  }, [categoryId])

  const { data: categoriesData } = useQuery({
    queryKey: ['admin', 'learn', 'categories', 'all'],
    queryFn: () => api<{ list: Category[] }>(`/api/admin/learn/categories`).then((d) => d.list ?? []),
  })
  const categories = categoriesData ?? []

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'learn', 'lessons', debounced, categoryId, page],
    queryFn: () => fetchLessons({ page, search: debounced, categoryId }),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title.trim(),
        categoryId: form.categoryId || null,
        intro: form.intro.trim() || null,
        lecturerName: form.lecturerName.trim() || null,
        price: form.price,
        isFree: form.isFree,
        isPublished: form.isPublished,
        sort: Number(form.sort) || 0,
      }
      if (editing) {
        return api<{ lesson: Lesson }>(`/api/admin/learn/lessons/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      }
      return api<{ lesson: Lesson }>(`/api/admin/learn/lessons`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'learn', 'lessons'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/learn/lessons/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'learn', 'lessons'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }

  function openEdit(lesson: Lesson) {
    setEditing(lesson)
    setForm({
      title: lesson.title,
      categoryId: lesson.categoryId ?? '',
      intro: lesson.intro ?? '',
      lecturerName: lesson.lecturerName ?? '',
      price: lesson.price,
      isFree: lesson.isFree,
      isPublished: lesson.isPublished,
      sort: String(lesson.sort),
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
    if (!form.title.trim()) {
      setErr(t('titleRequired'))
      return
    }
    saveMut.mutate()
  }

  function handleDelete(lesson: Lesson) {
    if (!window.confirm(t('deleteConfirm'))) return
    deleteMut.mutate(lesson.id)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const lessons = data?.list ?? []

  const lessonTotal = total
  const categoryTotal = categories.length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/learn/categories">
              <FolderTree className="h-4 w-4" />
              {t('categories')}
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          icon={BookOpen}
          label={t('statLessonTotal')}
          value={lessonTotal}
          gradient="bg-gradient-to-br from-indigo-500 to-purple-700"
        />
        <StatCard
          icon={FolderTree}
          label={t('statCategoryTotal')}
          value={categoryTotal}
          gradient="bg-gradient-to-br from-sky-500 to-blue-500"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="h-9 pl-8"
            aria-label={t('search')}
          />
        </div>
        <div className="w-full max-w-[200px]">
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className={selectClass} aria-label={t('allCategories')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allCategories')}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
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
              <TableHead className="px-4 py-2.5">{t('colCategory')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colSort')}</TableHead>
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
            ) : lessons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <BookOpen className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noData')}
                </TableCell>
              </TableRow>
            ) : (
              lessons.map((lesson) => {
                const published = lesson.isPublished
                return (
                  <TableRow key={lesson.id} className="hover:bg-muted/30">
                    <TableCell className="px-4 py-2.5">
                      <div className="font-medium">{lesson.title}</div>
                      {lesson.intro ? (
                        <div className="max-w-xs truncate text-xs text-muted-foreground">
                          {lesson.intro}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      {lesson.categoryName ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <div className="flex flex-col gap-1">
                        <span
                          className={cn(
                            'inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                            published
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          <span
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              published ? 'bg-emerald-500' : 'bg-muted-foreground',
                            )}
                          />
                          {published ? t('published') : t('unpublished')}
                        </span>
                        <span
                          className={cn(
                            'inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium',
                            lesson.isFree
                              ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                          )}
                        >
                          {lesson.isFree ? t('free') : t('paid')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-2.5">{lesson.sort}</TableCell>
                    <TableCell className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild variant="ghost" size="sm" title={t('chapters')}>
                          <Link href={`/admin/learn/chapters?lessonId=${lesson.id}`}>
                            <ListOrdered className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(lesson)}
                          title={t('edit')}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(lesson)}
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
        <DialogContent className="max-w-xl">
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
              <Label htmlFor="lesson-title">{t('fieldTitle')}</Label>
              <Input
                id="lesson-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={t('titlePlaceholder')}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="lesson-category">{t('fieldCategory')}</Label>
                <Select
                  value={form.categoryId || 'none'}
                  onValueChange={(v) => setForm({ ...form, categoryId: v === 'none' ? '' : v })}
                >
                  <SelectTrigger className={selectClass} id="lesson-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('noCategory')}</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lesson-lecturer">{t('fieldLecturer')}</Label>
                <Input
                  id="lesson-lecturer"
                  value={form.lecturerName}
                  onChange={(e) => setForm({ ...form, lecturerName: e.target.value })}
                  placeholder={t('lecturerPlaceholder')}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lesson-intro">{t('fieldIntro')}</Label>
              <Input
                id="lesson-intro"
                value={form.intro}
                onChange={(e) => setForm({ ...form, intro: e.target.value })}
                placeholder={t('introPlaceholder')}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="lesson-price">{t('fieldPrice')}</Label>
                <Input
                  id="lesson-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder={t('pricePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lesson-sort">{t('fieldSort')}</Label>
                <Input
                  id="lesson-sort"
                  type="number"
                  min="0"
                  value={form.sort}
                  onChange={(e) => setForm({ ...form, sort: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="lesson-free"
                  checked={form.isFree}
                  onCheckedChange={(v) => setForm({ ...form, isFree: v })}
                />
                <Label htmlFor="lesson-free">{t('fieldFree')}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="lesson-published"
                  checked={form.isPublished}
                  onCheckedChange={(v) => setForm({ ...form, isPublished: v })}
                />
                <Label htmlFor="lesson-published">{t('fieldPublished')}</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog} disabled={saveMut.isPending}>
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
