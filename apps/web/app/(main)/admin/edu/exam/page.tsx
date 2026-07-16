'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight, FileText, ListChecks, Settings2 } from 'lucide-react'
import { eduApi, buildQs, type PageData } from '@/lib/edu'
import { cn } from '@/lib/utils'
import { Card, CardContent, Button } from '@ihui/ui'

import { EMPTY, PAGE_SIZE, API } from './helpers'
import type { Paper, PaperForm } from './types'
import { ExamFilter } from './ExamFilter'
import { ExamTable } from './ExamTable'
import { ExamDialog } from './ExamDialog'

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

export default function EduExamPage() {
  const t = useTranslations('admin.edu.exam.index')
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Paper | null>(null)
  const [form, setForm] = React.useState<PaperForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'exam', 'papers', debounced, page],
    queryFn: () =>
      eduApi<PageData<Paper>>(`${API}${buildQs({ page, pageSize: PAGE_SIZE, search: debounced })}`),
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
        isRandom: form.isRandom,
        status: form.status ? 1 : 0,
        paperType: form.paperType,
        questionDisordered: form.questionDisordered,
        optionDisordered: form.optionDisordered,
        difficulty: form.difficulty,
        categoryId: form.cidList[0] || null,
        cidList: form.cidList,
        questionIdList: form.questionIdList,
      }
      return editing
        ? eduApi(`${API}/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : eduApi(API, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'exam', 'papers'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`${API}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'exam', 'papers'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(p: Paper) {
    setEditing(p)
    setForm({
      title: p.title,
      description: p.description ?? '',
      totalScore: p.totalScore,
      passScore: p.passScore,
      duration: String(p.duration),
      isPublished: p.isPublished,
      isRandom: p.isRandom,
      status: p.status !== 0,
      cidList: p.cidList ?? [],
      questionIdList: p.questionIdList ?? [],
      questionDisordered: p.questionDisordered ?? false,
      optionDisordered: p.optionDisordered ?? false,
      difficulty: p.difficulty ?? 2,
      paperType: p.paperType ?? 'normal',
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
    if (!form.title.trim()) return setErr(t('titleRequired'))
    saveMut.mutate()
  }
  function handleDelete(p: Paper) {
    if (!window.confirm(t('confirmDelete'))) return
    deleteMut.mutate(p.id)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const papers = data?.list ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={FileText}
          label={t('totalPapers')}
          value={total}
          gradient="bg-gradient-to-br from-indigo-500 to-purple-700"
        />
        <StatCard
          icon={ListChecks}
          label={t('published')}
          value={papers.filter((p) => p.isPublished).length}
          gradient="bg-gradient-to-br from-emerald-500 to-green-400"
        />
        <StatCard
          icon={Settings2}
          label={t('random')}
          value={papers.filter((p) => p.isRandom).length}
          gradient="bg-gradient-to-br from-teal-500 to-emerald-600"
        />
        <StatCard
          icon={FileText}
          label={t('currentPage')}
          value={papers.length}
          gradient="bg-gradient-to-br from-pink-500 to-rose-500"
        />
      </div>

      <ExamFilter search={search} onSearchChange={setSearch} onCreate={openCreate} />

      <ExamTable
        rows={papers}
        isLoading={isLoading}
        error={error as Error | null}
        onEdit={openEdit}
        onDelete={handleDelete}
        deletePending={deleteMut.isPending}
      />

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

      <ExamDialog
        open={open}
        editing={editing}
        form={form}
        onFormChange={(patch) => setForm({ ...form, ...patch })}
        onClose={closeDialog}
        onSubmit={submit}
        pending={saveMut.isPending}
        err={err}
      />
    </div>
  )
}
