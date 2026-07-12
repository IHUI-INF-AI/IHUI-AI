'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Plus,
  Edit,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Search,
} from 'lucide-react'
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
  Card,
  CardContent,
} from '@ihui/ui'

interface Student {
  id: string
  nickname: string | null
  phone: string | null
  email: string | null
  level: number
  status: number
  signupCount: number
  learnHours: number
  createdAt: string
}
interface SForm {
  nickname: string
  phone: string
  email: string
  level: string
  status: number
}
const EMPTY: SForm = { nickname: '', phone: '', email: '', level: '1', status: 1 }

const LEVEL_MAP: Record<number, string> = {
  1: 'beginner',
  2: 'intermediate',
  3: 'advanced',
  4: 'expert',
}
const PAGE_SIZE = 10

export default function EduStudentPage() {
  const t = useTranslations('admin.edu.student')
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [levelFilter, setLevelFilter] = React.useState('all')
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Student | null>(null)
  const [form, setForm] = React.useState<SForm>(EMPTY)
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
  }, [levelFilter])

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'student', debounced, levelFilter, page],
    queryFn: () =>
      eduApi<PageData<Student>>(
        `/api/admin/users${buildQs({ page, pageSize: PAGE_SIZE, search: debounced, role: 'student', level: levelFilter === 'all' ? '' : levelFilter })}`,
      ),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        nickname: form.nickname.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        level: Number(form.level),
        status: form.status,
      }
      if (editing)
        return eduApi(`/api/admin/users/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      return eduApi(`/api/admin/users`, {
        method: 'POST',
        body: JSON.stringify({ ...body, role: 'student' }),
      })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'student'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'student'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(s: Student) {
    setEditing(s)
    setForm({
      nickname: s.nickname ?? '',
      phone: s.phone ?? '',
      email: s.email ?? '',
      level: String(s.level),
      status: s.status,
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
    if (!form.nickname.trim()) return setErr(t('nicknameRequired'))
    saveMut.mutate()
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">{t('totalStudents')}</div>
            <div className="mt-1 text-2xl font-semibold">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">{t('currentPageSignups')}</div>
            <div className="mt-1 text-2xl font-semibold">
              {rows.reduce((a, s) => a + s.signupCount, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">{t('currentPageLearnHours')}</div>
            <div className="mt-1 text-2xl font-semibold">
              {rows.reduce((a, s) => a + s.learnHours, 0)}h
            </div>
          </CardContent>
        </Card>
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
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className={selectClass} aria-label={t('ariaLevel')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allLevels')}</SelectItem>
              {Object.entries(LEVEL_MAP).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {t(`level.${v}`)}
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
              <TableHead className="px-4 py-2.5">{t('colNickname')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colContact')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colLevel')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colSignup')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colLearnHours')}</TableHead>
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
                <TableCell colSpan={7} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <GraduationCap className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('empty')}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((s) => (
                <TableRow key={s.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">
                    {s.nickname ?? s.id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-xs">{s.phone ?? s.email ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span className="inline-flex items-center rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-600 dark:text-sky-400">
                      {LEVEL_MAP[s.level] ? t(`level.${LEVEL_MAP[s.level]}`) : `L${s.level}`}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5">{s.signupCount}</TableCell>
                  <TableCell className="px-4 py-2.5">{s.learnHours}h</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        s.status === 1
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {s.status === 1 ? t('statusActive') : t('statusDisabled')}
                    </span>
                  </TableCell>
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
              <Label htmlFor="s-nick">{t('fieldNickname')}</Label>
              <Input
                id="s-nick"
                value={form.nickname}
                onChange={(e) => setForm({ ...form, nickname: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="s-phone">{t('fieldPhone')}</Label>
                <Input
                  id="s-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-email">{t('fieldEmail')}</Label>
                <Input
                  id="s-email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="s-level">{t('fieldLevel')}</Label>
                <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                  <SelectTrigger className={selectClass} id="s-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LEVEL_MAP).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {t(`level.${v}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-status">{t('fieldStatus')}</Label>
                <Select
                  value={String(form.status)}
                  onValueChange={(v) => setForm({ ...form, status: Number(v) })}
                >
                  <SelectTrigger className={selectClass} id="s-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">{t('statusActive')}</SelectItem>
                    <SelectItem value="0">{t('statusDisabled')}</SelectItem>
                  </SelectContent>
                </Select>
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
