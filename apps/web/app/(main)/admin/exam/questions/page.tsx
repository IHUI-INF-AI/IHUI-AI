'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Plus,
  Edit,
  Trash2,
  Loader2,
  ListChecks,
  ChevronLeft,
} from 'lucide-react'
import Link from 'next/link'

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

type QuestionType =
  | 'single_choice'
  | 'multi_choice'
  | 'judgment'
  | 'fill_blank'
  | 'subjective'

const TYPE_BADGE: Record<QuestionType, string> = {
  single_choice: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  multi_choice: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  judgment: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  fill_blank: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  subjective: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
}

interface ExamPaper {
  id: string
  title: string
  isPublished: boolean
}

interface Question {
  id: string
  paperId: string
  type: QuestionType
  title: string
  options: unknown
  score: string
  sortOrder: number
  answer?: unknown
  analysis?: string
}

interface PapersData {
  list: ExamPaper[]
  total: number
}

interface QuestionsData {
  list: Question[]
}

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

interface QuestionForm {
  type: QuestionType
  title: string
  score: string
  sortOrder: string
  options: string
  answer: string
  analysis: string
}

const EMPTY_FORM: QuestionForm = {
  type: 'single_choice',
  title: '',
  score: '5',
  sortOrder: '0',
  options: '',
  answer: '',
  analysis: '',
}

function QuestionsContent() {
  const t = useTranslations('admin.exam')
  const router = useRouter()
  const searchParams = useSearchParams()
  const qc = useQueryClient()

  function answerPlaceholder(type: QuestionType): string {
    switch (type) {
      case 'single_choice':
        return t('answerPlaceholderSingle')
      case 'multi_choice':
        return t('answerPlaceholderMulti')
      case 'judgment':
        return t('answerPlaceholderJudge')
      case 'fill_blank':
        return t('answerPlaceholderFill')
      case 'subjective':
        return t('answerPlaceholderSubjective')
    }
  }

  const typeLabel: Record<QuestionType, string> = {
    single_choice: t('typeSingle'),
    multi_choice: t('typeMulti'),
    judgment: t('typeJudgment'),
    fill_blank: t('typeFill'),
    subjective: t('typeSubjective'),
  }
  const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
    { value: 'single_choice', label: typeLabel.single_choice },
    { value: 'multi_choice', label: typeLabel.multi_choice },
    { value: 'judgment', label: typeLabel.judgment },
    { value: 'fill_blank', label: typeLabel.fill_blank },
    { value: 'subjective', label: typeLabel.subjective },
  ]

  const initialPaperId = searchParams.get('paperId') ?? ''
  const [paperId, setPaperId] = React.useState(initialPaperId)

  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Question | null>(null)
  const [form, setForm] = React.useState<QuestionForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  const { data: papersData } = useQuery({
    queryKey: ['admin', 'exam', 'papers', 'all'],
    queryFn: () =>
      api<PapersData>(`/api/admin/exam/papers?page=1&pageSize=100`).then((d) => d),
  })
  const papers = papersData?.list ?? []

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'exam', 'questions', paperId],
    queryFn: () =>
      api<QuestionsData>(`/api/admin/exam/papers/${paperId}/questions`).then((d) => d.list ?? []),
    enabled: !!paperId,
  })

  const createMut = useMutation({
    mutationFn: () => {
      const body = buildBody()
      return api(`/api/admin/exam/papers/${paperId}/questions`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'exam', 'questions', paperId] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const updateMut = useMutation({
    mutationFn: () => {
      const body = buildBody()
      return api(`/api/admin/exam/questions/${editing?.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(t('updateSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'exam', 'questions', paperId] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/exam/questions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'exam', 'questions', paperId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function buildBody(): Record<string, unknown> {
    const body: Record<string, unknown> = {
      type: form.type,
      title: form.title.trim(),
      score: form.score,
      sortOrder: Number(form.sortOrder) || 0,
    }
    if (form.options.trim()) body.options = JSON.parse(form.options)
    if (form.answer.trim()) body.answer = JSON.parse(form.answer)
    if (form.analysis.trim()) body.analysis = form.analysis.trim()
    return body
  }

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }

  function openEdit(q: Question) {
    setEditing(q)
    setForm({
      type: q.type,
      title: q.title,
      score: q.score,
      sortOrder: String(q.sortOrder),
      options: q.options ? JSON.stringify(q.options, null, 2) : '',
      answer: q.answer ? JSON.stringify(q.answer, null, 2) : '',
      analysis: q.analysis || '',
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
    if (!paperId) {
      setErr(t('selectPaperPlaceholder'))
      return
    }
    if (!form.title.trim()) {
      setErr(t('titleRequired'))
      return
    }
    // 校验 JSON
    if (form.options.trim()) {
      try {
        JSON.parse(form.options)
      } catch (e) {
        setErr(t('jsonInvalid', { msg: (e as Error).message }))
        return
      }
    }
    if (form.answer.trim()) {
      try {
        JSON.parse(form.answer)
      } catch (e) {
        setErr(t('jsonInvalid', { msg: (e as Error).message }))
        return
      }
    }
    if (editing) updateMut.mutate()
    else createMut.mutate()
  }

  function handleDelete(q: Question) {
    if (!window.confirm(t('deleteConfirm'))) return
    deleteMut.mutate(q.id)
  }

  function onPaperChange(v: string) {
    setPaperId(v)
    const params = new URLSearchParams(searchParams.toString())
    if (v) params.set('paperId', v)
    else params.delete('paperId')
    router.replace(`/admin/exam/questions?${params.toString()}`)
  }

  const questions = data ?? []
  const saving = createMut.isPending || updateMut.isPending

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('questionsTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('questionsSubtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/exam">
            <ChevronLeft className="h-4 w-4" />
            {t('backToExam')}
          </Link>
        </Button>
        <div className="w-full max-w-sm">
          <Select value={paperId} onValueChange={onPaperChange}>
            <SelectTrigger className={selectClass} aria-label={t('selectPaper')}>
              <SelectValue placeholder={t('selectPaperPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {papers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                  {!p.isPublished ? `（${t('unpublished')}）` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openCreate} size="sm" className="ml-auto" disabled={!paperId}>
          <Plus className="h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">{t('colType')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colTitle')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colScore')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colSort')}</TableHead>
              <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {!paperId ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <ListChecks className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noPaperSelected')}
                </TableCell>
              </TableRow>
            ) : isLoading ? (
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
            ) : questions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <ListChecks className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noData')}
                </TableCell>
              </TableRow>
            ) : (
              questions.map((q) => (
                <TableRow key={q.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        TYPE_BADGE[q.type],
                      )}
                    >
                      {typeLabel[q.type]}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-md truncate px-4 py-2.5">{q.title}</TableCell>
                  <TableCell className="px-4 py-2.5">{Number(q.score)}</TableCell>
                  <TableCell className="px-4 py-2.5">{q.sortOrder}</TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(q)}
                        title={t('edit')}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(q)}
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
        <DialogContent className="max-w-2xl">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? t('editTitle') : t('createTitle')}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="q-type">{t('fieldType')}</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v as QuestionType })}
                >
                  <SelectTrigger className={selectClass} id="q-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUESTION_TYPES.map((qt) => (
                      <SelectItem key={qt.value} value={qt.value}>
                        {qt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="q-score">{t('fieldScore')}</Label>
                <Input
                  id="q-score"
                  type="number"
                  min="0"
                  value={form.score}
                  onChange={(e) => setForm({ ...form, score: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="q-title">{t('fieldTitle')}</Label>
              <textarea
                id="q-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={t('titlePlaceholder')}
                rows={2}
                className={cn(textareaClass, 'font-sans')}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="q-options">{t('fieldOptions')}</Label>
                <textarea
                  id="q-options"
                  value={form.options}
                  onChange={(e) => setForm({ ...form, options: e.target.value })}
                  placeholder={t('optionsPlaceholder')}
                  rows={4}
                  className={textareaClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="q-answer">{t('fieldAnswer')}</Label>
                <textarea
                  id="q-answer"
                  value={form.answer}
                  onChange={(e) => setForm({ ...form, answer: e.target.value })}
                  placeholder={answerPlaceholder(form.type)}
                  rows={4}
                  className={textareaClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="q-sort">{t('fieldSort')}</Label>
                <Input
                  id="q-sort"
                  type="number"
                  min="0"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="q-analysis">{t('fieldAnalysis')}</Label>
                <Input
                  id="q-analysis"
                  value={form.analysis}
                  onChange={(e) => setForm({ ...form, analysis: e.target.value })}
                  placeholder={t('analysisPlaceholder')}
                />
              </div>
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

export default function AdminExamQuestionsPage() {
  const t = useTranslations('admin.exam')
  return (
    <React.Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      }
    >
      <QuestionsContent />
    </React.Suspense>
  )
}
