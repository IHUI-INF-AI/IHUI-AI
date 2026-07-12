'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, Loader2, ChevronLeft, CalendarClock } from 'lucide-react'
import { eduApi, buildQs, selectClass } from '@/lib/edu'
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

interface Paper {
  id: string
  title: string
}
interface Arrangement {
  id: string
  paperId: string
  paperTitle?: string
  startTime: string
  endTime: string
  room: string
  invigilator: string
  status: string
}
interface PageData<T> {
  list: T[]
  total: number
}

interface AForm {
  paperId: string
  startTime: string
  endTime: string
  room: string
  invigilator: string
  status: string
}
const EMPTY: AForm = {
  paperId: '',
  startTime: '',
  endTime: '',
  room: '',
  invigilator: '',
  status: 'scheduled',
}

export default function EduExamArrangementsPage() {
  const t = useTranslations('admin.edu.exam.arrangements')
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Arrangement | null>(null)
  const [form, setForm] = React.useState<AForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const { data: papersData } = useQuery({
    queryKey: ['edu', 'exam', 'papers', 'all'],
    queryFn: () => eduApi<{ list: Paper[] }>(`/api/admin/exam/papers?page=1&pageSize=100`),
  })
  const papers = papersData?.list ?? []

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'exam', 'arrangements', page],
    queryFn: () =>
      eduApi<PageData<Arrangement>>(
        `/api/admin/edu/exam/arrangements${buildQs({ page, pageSize: 10 })}`,
      ),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = { ...form }
      if (editing)
        return eduApi(`/api/admin/edu/exam/arrangements/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      return eduApi(`/api/admin/edu/exam/arrangements`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'exam', 'arrangements'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      eduApi(`/api/admin/edu/exam/arrangements/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'exam', 'arrangements'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(a: Arrangement) {
    setEditing(a)
    setForm({
      paperId: a.paperId,
      startTime: a.startTime,
      endTime: a.endTime,
      room: a.room,
      invigilator: a.invigilator,
      status: a.status,
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
    if (!form.paperId) return setErr(t('paperRequired'))
    saveMut.mutate()
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / 10))
  const rows = data?.list ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu/exam">
            <ChevronLeft className="h-4 w-4" />
            {t('backToExam')}
          </Link>
        </Button>
        <Button onClick={openCreate} size="sm" className="ml-auto">
          <Plus className="h-4 w-4" />
          {t('create')}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">{t('colPaper')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colStartTime')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colEndTime')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colRoom')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colInvigilator')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
              <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
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
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <CalendarClock className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noDataError')}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <CalendarClock className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noData')}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((a) => (
                <TableRow key={a.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5">
                    {a.paperTitle ??
                      papers.find((p) => p.id === a.paperId)?.title ??
                      a.paperId.slice(0, 8)}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-xs">{a.startTime}</TableCell>
                  <TableCell className="px-4 py-2.5 text-xs">{a.endTime}</TableCell>
                  <TableCell className="px-4 py-2.5">{a.room}</TableCell>
                  <TableCell className="px-4 py-2.5">{a.invigilator}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{a.status}</span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(a)}
                        title={t('edit')}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (window.confirm(t('deleteConfirm'))) deleteMut.mutate(a.id)
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
              <Label htmlFor="a-paper">{t('fieldPaper')}</Label>
              <Select value={form.paperId} onValueChange={(v) => setForm({ ...form, paperId: v })}>
                <SelectTrigger className={selectClass} id="a-paper">
                  <SelectValue placeholder={t('selectPaperPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {papers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="a-start">{t('fieldStartTime')}</Label>
                <Input
                  id="a-start"
                  type="datetime-local"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="a-end">{t('fieldEndTime')}</Label>
                <Input
                  id="a-end"
                  type="datetime-local"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="a-room">{t('fieldRoom')}</Label>
                <Input
                  id="a-room"
                  value={form.room}
                  onChange={(e) => setForm({ ...form, room: e.target.value })}
                  placeholder={t('roomPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="a-inv">{t('fieldInvigilator')}</Label>
                <Input
                  id="a-inv"
                  value={form.invigilator}
                  onChange={(e) => setForm({ ...form, invigilator: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-status">{t('fieldStatus')}</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className={selectClass} id="a-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">{t('statusScheduled')}</SelectItem>
                  <SelectItem value="ongoing">{t('statusOngoing')}</SelectItem>
                  <SelectItem value="finished">{t('statusFinished')}</SelectItem>
                  <SelectItem value="cancelled">{t('statusCancelled')}</SelectItem>
                </SelectContent>
              </Select>
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
