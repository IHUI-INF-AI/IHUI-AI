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
  Newspaper,
  FolderTree,
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
  Switch,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'

interface Article {
  id: string
  categoryId: string | null
  title: string
  summary: string | null
  content: string
  coverImage: string | null
  authorId: string | null
  authorName: string | null
  isPublished: boolean
  isPinned: boolean
  viewCount: number
  sort: number
  status: number
  publishedAt: string | null
  createdAt: string
  categoryName?: string | null
}

interface Category {
  id: string
  name: string
  sort: number
  status: number
}

interface ArticlesData {
  list: Article[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 20

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function fetchArticles(params: {
  page: number
  search: string
  categoryId: string
  status: string
}): Promise<ArticlesData> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) })
  if (params.search) qs.set('search', params.search)
  if (params.categoryId && params.categoryId !== 'all') qs.set('categoryId', params.categoryId)
  if (params.status && params.status !== 'all') qs.set('status', params.status)
  return api<ArticlesData>(`/api/admin/news/articles?${qs.toString()}`)
}

interface ArticleForm {
  title: string
  summary: string
  content: string
  categoryId: string
  coverImage: string
  authorName: string
  isPublished: boolean
  isPinned: boolean
  sort: string
  status: boolean
}

const EMPTY_FORM: ArticleForm = {
  title: '',
  summary: '',
  content: '',
  categoryId: '',
  coverImage: '',
  authorName: '',
  isPublished: false,
  isPinned: false,
  sort: '0',
  status: true,
}

export default function AdminNewsPage() {
  const t = useTranslations('admin.news')
  const qc = useQueryClient()

  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [categoryId, setCategoryId] = React.useState('all')
  const [status, setStatus] = React.useState('all')
  const [page, setPage] = React.useState(1)

  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Article | null>(null)
  const [form, setForm] = React.useState<ArticleForm>(EMPTY_FORM)
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
  }, [categoryId, status])

  const { data: categoriesData } = useQuery({
    queryKey: ['admin', 'news', 'categories', 'all'],
    queryFn: () => api<{ list: Category[] }>(`/api/admin/news/categories`).then((d) => d.list ?? []),
  })
  const categories = categoriesData ?? []

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'news', 'articles', debounced, categoryId, status, page],
    queryFn: () => fetchArticles({ page, search: debounced, categoryId, status }),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title.trim(),
        summary: form.summary.trim() || undefined,
        content: form.content,
        categoryId: form.categoryId || undefined,
        coverImage: form.coverImage.trim() || undefined,
        authorName: form.authorName.trim() || undefined,
        isPublished: form.isPublished,
        isPinned: form.isPinned,
        sort: Number(form.sort) || 0,
        status: form.status ? 1 : 0,
      }
      if (editing) {
        return api<{ article: Article }>(`/api/admin/news/articles/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      }
      return api<{ article: Article }>(`/api/admin/news/articles`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'news', 'articles'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/news/articles/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'news', 'articles'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }

  function openEdit(article: Article) {
    setEditing(article)
    setForm({
      title: article.title,
      summary: article.summary ?? '',
      content: article.content,
      categoryId: article.categoryId ?? '',
      coverImage: article.coverImage ?? '',
      authorName: article.authorName ?? '',
      isPublished: article.isPublished,
      isPinned: article.isPinned,
      sort: String(article.sort),
      status: article.status === 1,
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

  function handleDelete(article: Article) {
    if (!window.confirm(t('deleteConfirm'))) return
    deleteMut.mutate(article.id)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const articles = data?.list ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('articlesTitle')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('articlesSubtitle')}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/news/categories">
            <FolderTree className="h-4 w-4" />
            {t('categoriesTitle')}
          </Link>
        </Button>
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
        <div className="w-full max-w-[180px]">
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
        <div className="w-full max-w-[160px]">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className={selectClass} aria-label={t('allStatus')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allStatus')}</SelectItem>
              <SelectItem value="1">{t('published')}</SelectItem>
              <SelectItem value="0">{t('unpublished')}</SelectItem>
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
              <TableHead className="px-4 py-2.5">{t('colAuthor')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colViewCount')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colCreatedAt')}</TableHead>
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
            ) : articles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <Newspaper className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noData')}
                </TableCell>
              </TableRow>
            ) : (
              articles.map((article) => {
                const published = article.isPublished
                return (
                  <TableRow key={article.id} className="hover:bg-muted/30">
                    <TableCell className="px-4 py-2.5">
                      <div className="flex items-center gap-2 font-medium">
                        {article.isPinned ? (
                          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-500">
                            {t('pinned')}
                          </span>
                        ) : null}
                        <span className="max-w-xs truncate">{article.title}</span>
                      </div>
                      {article.summary ? (
                        <div className="max-w-xs truncate text-xs text-muted-foreground">
                          {article.summary}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      {article.categoryName ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      {article.authorName ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">{article.viewCount}</TableCell>
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
                    <TableCell className="px-4 py-2.5 text-muted-foreground">
                      {new Date(article.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(article)}
                          title={t('edit')}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(article)}
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
            <div className="space-y-2">
              <Label htmlFor="art-title">{t('fieldTitle')}</Label>
              <Input
                id="art-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={t('titlePlaceholder')}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="art-category">{t('fieldCategory')}</Label>
                <Select
                  value={form.categoryId || 'none'}
                  onValueChange={(v) => setForm({ ...form, categoryId: v === 'none' ? '' : v })}
                >
                  <SelectTrigger className={selectClass} id="art-category">
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
                <Label htmlFor="art-author">{t('fieldAuthorName')}</Label>
                <Input
                  id="art-author"
                  value={form.authorName}
                  onChange={(e) => setForm({ ...form, authorName: e.target.value })}
                  placeholder={t('authorNamePlaceholder')}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="art-summary">{t('fieldSummary')}</Label>
              <Input
                id="art-summary"
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                placeholder={t('summaryPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="art-cover">{t('fieldCoverImage')}</Label>
              <Input
                id="art-cover"
                value={form.coverImage}
                onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
                placeholder={t('coverImagePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="art-content">{t('fieldContent')}</Label>
              <textarea
                id="art-content"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder={t('contentPlaceholder')}
                className="min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="art-sort">{t('fieldSort')}</Label>
                <Input
                  id="art-sort"
                  type="number"
                  min="0"
                  value={form.sort}
                  onChange={(e) => setForm({ ...form, sort: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2 pt-7">
                <Switch
                  id="art-published"
                  checked={form.isPublished}
                  onCheckedChange={(v) => setForm({ ...form, isPublished: v })}
                />
                <Label htmlFor="art-published">{t('fieldPublished')}</Label>
              </div>
              <div className="flex items-center gap-2 pt-7">
                <Switch
                  id="art-pinned"
                  checked={form.isPinned}
                  onCheckedChange={(v) => setForm({ ...form, isPinned: v })}
                />
                <Label htmlFor="art-pinned">{t('fieldPinned')}</Label>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="art-status"
                checked={form.status}
                onCheckedChange={(v) => setForm({ ...form, status: v })}
              />
              <Label htmlFor="art-status">{t('fieldStatus')}</Label>
              <span className="text-sm text-muted-foreground">
                {form.status ? t('enabled') : t('disabled')}
              </span>
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
