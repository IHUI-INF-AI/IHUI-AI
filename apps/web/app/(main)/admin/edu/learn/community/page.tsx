'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, Loader2, ChevronLeft, ChevronRight, Users, Search } from 'lucide-react'
import { eduApi, buildQs, selectClass, textareaClass, type PageData } from '@/lib/edu'
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

interface Topic {
  id: string
  userId: string
  userName: string | null
  lessonId: string | null
  lessonTitle: string | null
  title: string
  content: string | null
  replyCount: number
  viewCount: number
  isPinned: boolean
  createdAt: string
  status: string
}
interface TForm {
  title: string
  content: string
  lessonId: string
  status: string
  isPinned: boolean
}
const EMPTY: TForm = { title: '', content: '', lessonId: '', status: 'published', isPinned: false }

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  published: {
    label: 'statusPublished',
    cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  },
  draft: { label: 'statusDraft', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  hidden: { label: 'statusHidden', cls: 'bg-muted text-muted-foreground' },
}

const PAGE_SIZE = 10

export default function EduLearnCommunityPage() {
  const t = useTranslations('admin.edu.learn.community')
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Topic | null>(null)
  const [form, setForm] = React.useState<TForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'learn', 'community', debounced, page],
    queryFn: () =>
      eduApi<PageData<Topic>>(
        `/api/admin/learn/topics${buildQs({ page, pageSize: PAGE_SIZE, search: debounced })}`,
      ),
    retry: false,
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title.trim(),
        content: form.content.trim() || null,
        lessonId: form.lessonId || null,
        status: form.status,
        isPinned: form.isPinned,
      }
      if (editing)
        return eduApi(`/api/admin/learn/topics/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      return eduApi(`/api/admin/learn/topics`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'learn', 'community'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/learn/topics/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'learn', 'community'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(t: Topic) {
    setEditing(t)
    setForm({
      title: t.title,
      content: t.content ?? '',
      lessonId: t.lessonId ?? '',
      status: t.status,
      isPinned: t.isPinned,
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
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="h-9 pl-8"
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
              <TableHead className="px-4 py-2.5">{t('colAuthor')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colReplies')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colViews')}</TableHead>
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
            ) : noEndpoint ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('endpointNotConfigured')}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('empty')}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((topic) => {
                const st = STATUS_MAP[topic.status] ?? {
                  label: '',
                  cls: 'bg-muted text-muted-foreground',
                }
                return (
                  <TableRow key={topic.id} className="hover:bg-muted/30">
                    <TableCell className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {topic.isPinned && (
                          <span className="inline-flex items-center rounded bg-amber-500/10 px-1 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                            {t('pinned')}
                          </span>
                        )}
                        <span className="font-medium">{topic.title}</span>
                      </div>
                      {topic.lessonTitle && (
                        <div className="text-xs text-muted-foreground">{topic.lessonTitle}</div>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      {topic.userName ?? topic.userId.slice(0, 8)}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">{topic.replyCount}</TableCell>
                    <TableCell className="px-4 py-2.5">{topic.viewCount}</TableCell>
                    <TableCell className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          st.cls,
                        )}
                      >
                        {st.label ? t(st.label) : topic.status}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(topic)}
                          title={t('edit')}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (window.confirm(t('deleteConfirm'))) deleteMut.mutate(topic.id)
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
              <Label htmlFor="t-title">{t('fieldTitle')}</Label>
              <Input
                id="t-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-content">{t('fieldContent')}</Label>
              <textarea
                id="t-content"
                className={textareaClass}
                rows={5}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="t-status">{t('fieldStatus')}</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className={selectClass} id="t-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="published">{t('statusPublished')}</SelectItem>
                    <SelectItem value="draft">{t('statusDraft')}</SelectItem>
                    <SelectItem value="hidden">{t('statusHidden')}</SelectItem>
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
