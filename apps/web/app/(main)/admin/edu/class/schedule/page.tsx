'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, Loader2, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { eduApi, buildQs, type PageData } from '@/lib/edu'
import { isNotFound } from '@/lib/api-error'
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
} from '@ihui/ui'

interface Schedule {
  id: string
  classId: string
  className: string | null
  title: string
  teacherName: string | null
  startTime: string
  endTime: string
  location: string | null
  status: string
}
interface SForm {
  classId: string
  title: string
  teacherName: string
  startTime: string
  endTime: string
  location: string
}
const EMPTY: SForm = {
  classId: '',
  title: '',
  teacherName: '',
  startTime: '',
  endTime: '',
  location: '',
}

const PAGE_SIZE = 10

export default function EduClassSchedulePage() {
  const t = useTranslations('admin.eduClassSchedule')
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Schedule | null>(null)
  const [form, setForm] = React.useState<SForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'class', 'schedule', page],
    queryFn: () =>
      eduApi<PageData<Schedule>>(
        `/api/admin/edu/classes/schedules${buildQs({ page, pageSize: PAGE_SIZE })}`,
      ),
    retry: false,
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        classId: form.classId,
        title: form.title.trim(),
        teacherName: form.teacherName.trim() || null,
        startTime: form.startTime,
        endTime: form.endTime,
        location: form.location.trim() || null,
      }
      if (editing)
        return eduApi(`/api/admin/edu/classes/schedules/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      return eduApi(`/api/admin/edu/classes/schedules`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'class', 'schedule'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      eduApi(`/api/admin/edu/classes/schedules/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'class', 'schedule'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(s: Schedule) {
    setEditing(s)
    setForm({
      classId: s.classId,
      title: s.title,
      teacherName: s.teacherName ?? '',
      startTime: s.startTime,
      endTime: s.endTime,
      location: s.location ?? '',
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
    if (!form.classId.trim()) return setErr(t('classIdRequired'))
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
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu/class">
            <ChevronLeft className="h-4 w-4" />
            {t('backToClass')}
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
              <TableHead className="px-4 py-2.5">{t('colCourse')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colClass')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colTeacher')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colTime')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colLocation')}</TableHead>
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
            ) : noEndpoint ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <CalendarDays className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('endpointNotConfigured')}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <CalendarDays className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('empty')}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((s) => (
                <TableRow key={s.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">{s.title}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    {s.className ?? s.classId.slice(0, 8)}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">{s.teacherName ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                    {s.startTime} ~ {s.endTime}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">{s.location ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(s)}
                        title={t('edit')}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (window.confirm(t('deleteConfirm'))) deleteMut.mutate(s.id)
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
              <DialogTitle>{editing ? t('dialogEditTitle') : t('dialogCreateTitle')}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="sc-class">{t('fieldClassId')}</Label>
              <Input
                id="sc-class"
                value={form.classId}
                onChange={(e) => setForm({ ...form, classId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sc-title">{t('fieldTitle')}</Label>
              <Input
                id="sc-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="sc-start">{t('fieldStartTime')}</Label>
                <Input
                  id="sc-start"
                  type="datetime-local"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sc-end">{t('fieldEndTime')}</Label>
                <Input
                  id="sc-end"
                  type="datetime-local"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="sc-teacher">{t('fieldTeacher')}</Label>
                <Input
                  id="sc-teacher"
                  value={form.teacherName}
                  onChange={(e) => setForm({ ...form, teacherName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sc-loc">{t('fieldLocation')}</Label>
                <Input
                  id="sc-loc"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>
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
