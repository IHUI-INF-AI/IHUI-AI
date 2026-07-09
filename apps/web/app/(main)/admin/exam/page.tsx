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
  FileText,
  ListChecks,
  Trophy,
  ClipboardList,
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
  Card,
  CardContent,
} from '@ihui/ui'

interface ExamPaper {
  id: string
  title: string
  description: string | null
  categoryId: string | null
  totalScore: string
  passScore: string
  duration: number
  isPublished: boolean
  isRandom: boolean
  questionCount: number
  status: number
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

interface PapersData {
  list: ExamPaper[]
  total: number
  page: number
  pageSize: number
}

interface ExamStatistics {
  examTotal: number
  examPublished: number
  recordTotal: number
  passTotal: number
  passRate: number
}

const PAGE_SIZE = 10

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function fetchPapers(params: { page: number; search: string }): Promise<PapersData> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) })
  if (params.search) qs.set('search', params.search)
  return api<PapersData>(`/api/admin/exam/papers?${qs.toString()}`)
}

interface PaperForm {
  title: string
  description: string
  totalScore: string
  passScore: string
  duration: string
  isPublished: boolean
}

const EMPTY_FORM: PaperForm = {
  title: '',
  description: '',
  totalScore: '100',
  passScore: '60',
  duration: '60',
  isPublished: false,
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

export default function AdminExamPage() {
  const t = useTranslations('admin.exam')
  const qc = useQueryClient()

  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)

  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ExamPaper | null>(null)
  const [form, setForm] = React.useState<PaperForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data: stats } = useQuery({
    queryKey: ['statistics', 'exam'],
    queryFn: () =>
      api<{ statistics: ExamStatistics }>(`/api/statistics/exam`).then((d) => d.statistics),
    retry: 0,
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'exam', 'papers', debounced, page],
    queryFn: () => fetchPapers({ page, search: debounced }),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        totalScore: form.totalScore,
        passScore: form.passScore,
        duration: Number(form.duration) || 60,
        isPublished: form.isPublished,
      }
      if (editing) {
        return api<{ paper: ExamPaper }>(`/api/admin/exam/papers/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      }
      return api<{ paper: ExamPaper }>(`/api/admin/exam/papers`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'exam', 'papers'] })
      qc.invalidateQueries({ queryKey: ['statistics', 'exam'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/exam/papers/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'exam', 'papers'] })
      qc.invalidateQueries({ queryKey: ['statistics', 'exam'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }

  function openEdit(paper: ExamPaper) {
    setEditing(paper)
    setForm({
      title: paper.title,
      description: paper.description ?? '',
      totalScore: paper.totalScore,
      passScore: paper.passScore,
      duration: String(paper.duration),
      isPublished: paper.isPublished,
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

  function handleDelete(paper: ExamPaper) {
    if (!window.confirm(t('deleteConfirm'))) return
    deleteMut.mutate(paper.id)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const papers = data?.list ?? []

  const examTotal = stats?.examTotal ?? 0
  const paperTotal = stats?.examPublished ?? 0
  const signupTotal = stats?.recordTotal ?? 0
  const passRate = stats?.passRate ?? 0

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={FileText}
          label={t('statExamTotal')}
          value={examTotal}
          gradient="bg-gradient-to-br from-indigo-500 to-purple-700"
        />
        <StatCard
          icon={ListChecks}
          label={t('statPaperTotal')}
          value={paperTotal}
          gradient="bg-gradient-to-br from-emerald-500 to-green-400"
        />
        <StatCard
          icon={ClipboardList}
          label={t('statSignupTotal')}
          value={signupTotal}
          gradient="bg-gradient-to-br from-pink-500 to-rose-500"
        />
        <StatCard
          icon={Trophy}
          label={t('statPassRate')}
          value={`${passRate.toFixed(1)}%`}
          gradient="bg-gradient-to-br from-orange-400 to-amber-300"
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
              <TableHead className="px-4 py-2.5">{t('colTotalScore')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colPassScore')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colDuration')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
              <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : papers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noData')}
                </TableCell>
              </TableRow>
            ) : (
              papers.map((paper) => {
                const published = paper.isPublished
                return (
                  <TableRow key={paper.id} className="hover:bg-muted/30">
                    <TableCell className="px-4 py-2.5">
                      <div className="font-medium">{paper.title}</div>
                      {paper.description ? (
                        <div className="max-w-xs truncate text-xs text-muted-foreground">
                          {paper.description}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">{Number(paper.totalScore)}</TableCell>
                    <TableCell className="px-4 py-2.5">{Number(paper.passScore)}</TableCell>
                    <TableCell className="px-4 py-2.5">{paper.duration}</TableCell>
                    <TableCell className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
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
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          title={t('questions')}
                        >
                          <Link href={`/admin/exam/questions?paperId=${paper.id}`}>
                            <ListChecks className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(paper)}
                          title={t('edit')}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(paper)}
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
              <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="paper-title">{t('fieldTitle')}</Label>
              <Input
                id="paper-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={t('titlePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paper-desc">{t('fieldDescription')}</Label>
              <Input
                id="paper-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t('descPlaceholder')}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="paper-total">{t('fieldTotalScore')}</Label>
                <Input
                  id="paper-total"
                  type="number"
                  min="0"
                  value={form.totalScore}
                  onChange={(e) => setForm({ ...form, totalScore: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paper-pass">{t('fieldPassScore')}</Label>
                <Input
                  id="paper-pass"
                  type="number"
                  min="0"
                  value={form.passScore}
                  onChange={(e) => setForm({ ...form, passScore: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paper-duration">{t('fieldDuration')}</Label>
                <Input
                  id="paper-duration"
                  type="number"
                  min="1"
                  max="600"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paper-status">{t('fieldStatus')}</Label>
              <Select
                value={form.isPublished ? 'true' : 'false'}
                onValueChange={(v) => setForm({ ...form, isPublished: v === 'true' })}
              >
                <SelectTrigger className={selectClass} id="paper-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">{t('unpublished')}</SelectItem>
                  <SelectItem value="true">{t('published')}</SelectItem>
                </SelectContent>
              </Select>
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
