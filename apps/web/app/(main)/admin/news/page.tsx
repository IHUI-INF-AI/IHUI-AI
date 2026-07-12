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
  Download,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Newspaper,
  FolderTree,
  Info,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { exportToExcel } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { RichTextEditor } from '@/components/editor/RichTextEditor'
import { DatePicker } from '@/components/form/DatePicker'
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

interface Information {
  id: string
  title: string
  content: string
  type: string | null
  url: string | null
  sourceName: string | null
  sourceUrl: string | null
  sourceCreator: string | null
  sourceTime: string | null
  insertTime: string | null
  browse: number | null
  creator: string | null
  crearedTime: string | null
}

interface InfoData {
  list: Information[]
  total: number
  page: number
  pageSize: number
}

interface InfoForm {
  title: string
  type: string
  url: string
  sourceName: string
  sourceUrl: string
  sourceCreator: string
  sourceTime: string
  insertTime: string
  browse: string
  creator: string
  crearedTime: string
  content: string
}

const PAGE_SIZE = 20
const INFO_PAGE_SIZE = 10

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

const inputSm = 'h-8 text-xs'

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

const EMPTY_INFO: InfoForm = {
  title: '',
  type: '',
  url: '',
  sourceName: '',
  sourceUrl: '',
  sourceCreator: '',
  sourceTime: '',
  insertTime: '',
  browse: '0',
  creator: '',
  crearedTime: '',
  content: '',
}

export default function AdminNewsPage() {
  const t = useTranslations('admin.news')
  const qc = useQueryClient()

  const [tab, setTab] = React.useState<'articles' | 'information'>('articles')

  // ===== Article state (existing) =====
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [categoryId, setCategoryId] = React.useState('all')
  const [status, setStatus] = React.useState('all')
  const [page, setPage] = React.useState(1)

  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Article | null>(null)
  const [form, setForm] = React.useState<ArticleForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  // ===== Information state (new) =====
  const [infoSearch, setInfoSearch] = React.useState({
    title: '',
    url: '',
    sourceName: '',
    sourceUrl: '',
    sourceCreator: '',
    sourceTime: '',
    insertTime: '',
    browse: '',
  })
  const [infoDebounced, setInfoDebounced] = React.useState(infoSearch)
  const [infoPage, setInfoPage] = React.useState(1)
  const [infoOpen, setInfoOpen] = React.useState(false)
  const [editingInfo, setEditingInfo] = React.useState<Information | null>(null)
  const [infoForm, setInfoForm] = React.useState<InfoForm>(EMPTY_INFO)
  const [infoErr, setInfoErr] = React.useState<string | null>(null)

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

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setInfoDebounced(infoSearch)
      setInfoPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [infoSearch])

  const { data: categoriesData } = useQuery({
    queryKey: ['admin', 'news', 'categories', 'all'],
    queryFn: () =>
      api<{ list: Category[] }>(`/api/admin/news/categories`).then((d) => d.list ?? []),
  })
  const categories = categoriesData ?? []

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'news', 'articles', debounced, categoryId, status, page],
    queryFn: () => fetchArticles({ page, search: debounced, categoryId, status }),
  })

  const infoQs = React.useMemo(() => {
    const qs = new URLSearchParams({ page: String(infoPage), pageSize: String(INFO_PAGE_SIZE) })
    if (infoDebounced.title) qs.set('title', infoDebounced.title)
    if (infoDebounced.url) qs.set('url', infoDebounced.url)
    if (infoDebounced.sourceName) qs.set('sourceName', infoDebounced.sourceName)
    if (infoDebounced.sourceUrl) qs.set('sourceUrl', infoDebounced.sourceUrl)
    if (infoDebounced.sourceCreator) qs.set('sourceCreator', infoDebounced.sourceCreator)
    if (infoDebounced.sourceTime) qs.set('sourceTime', infoDebounced.sourceTime)
    if (infoDebounced.insertTime) qs.set('insertTime', infoDebounced.insertTime)
    if (infoDebounced.browse) qs.set('browse', infoDebounced.browse)
    return qs.toString()
  }, [infoDebounced, infoPage])

  const {
    data: infoData,
    isLoading: infoLoading,
    error: infoError,
  } = useQuery({
    queryKey: ['admin', 'news', 'information', infoDebounced, infoPage],
    queryFn: () => api<InfoData>(`/api/admin/news/information?${infoQs}`),
    enabled: tab === 'information',
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

  const saveInfoMut = useMutation({
    mutationFn: () => {
      const body = {
        title: infoForm.title.trim(),
        content: infoForm.content,
        type: infoForm.type.trim() || undefined,
        url: infoForm.url.trim() || undefined,
        sourceName: infoForm.sourceName.trim() || undefined,
        sourceUrl: infoForm.sourceUrl.trim() || undefined,
        sourceCreator: infoForm.sourceCreator.trim() || undefined,
        sourceTime: infoForm.sourceTime || undefined,
        insertTime: infoForm.insertTime || undefined,
        browse: Number(infoForm.browse) || 0,
        creator: infoForm.creator.trim() || undefined,
        crearedTime: infoForm.crearedTime || undefined,
      }
      if (editingInfo) {
        return api(`/api/admin/news/information/${editingInfo.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      }
      return api(`/api/admin/news/information`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(editingInfo ? '更新成功' : '创建成功')
      qc.invalidateQueries({ queryKey: ['admin', 'news', 'information'] })
      closeInfoDialog()
    },
    onError: (e: Error) => setInfoErr(e.message),
  })

  const deleteInfoMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/news/information/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'news', 'information'] })
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

  function openCreateInfo() {
    setEditingInfo(null)
    setInfoForm(EMPTY_INFO)
    setInfoErr(null)
    setInfoOpen(true)
  }

  function openEditInfo(info: Information) {
    setEditingInfo(info)
    setInfoForm({
      title: info.title ?? '',
      type: info.type ?? '',
      url: info.url ?? '',
      sourceName: info.sourceName ?? '',
      sourceUrl: info.sourceUrl ?? '',
      sourceCreator: info.sourceCreator ?? '',
      sourceTime: info.sourceTime ?? '',
      insertTime: info.insertTime ?? '',
      browse: info.browse !== null && info.browse !== undefined ? String(info.browse) : '0',
      creator: info.creator ?? '',
      crearedTime: info.crearedTime ?? '',
      content: info.content ?? '',
    })
    setInfoErr(null)
    setInfoOpen(true)
  }

  function closeInfoDialog() {
    if (saveInfoMut.isPending) return
    setInfoOpen(false)
    setEditingInfo(null)
    setInfoErr(null)
  }

  function submitInfo(e: React.FormEvent) {
    e.preventDefault()
    setInfoErr(null)
    if (!infoForm.title.trim()) {
      setInfoErr('请输入标题')
      return
    }
    saveInfoMut.mutate()
  }

  function handleDeleteInfo(info: Information) {
    if (!window.confirm(`确认删除信息 "${info.title}" 吗?`)) return
    deleteInfoMut.mutate(info.id)
  }

  function handleArticleExport() {
    const list = (articles as unknown as Record<string, unknown>[]).map((r) => ({
      ...r,
      published: (r as { isPublished?: boolean }).isPublished ? '已发布' : '未发布',
    }))
    exportToExcel(
      '新闻文章',
      [
        { key: 'id', title: 'ID' },
        { key: 'title', title: '标题' },
        { key: 'categoryName', title: '分类' },
        { key: 'authorName', title: '作者' },
        { key: 'viewCount', title: '浏览量' },
        { key: 'published', title: '状态' },
        { key: 'createdAt', title: '创建时间' },
      ],
      list,
    )
  }

  function handleInfoExport() {
    const list = (infoData?.list ?? []) as unknown as Record<string, unknown>[]
    exportToExcel(
      'AI信息库',
      [
        { key: 'id', title: 'ID' },
        { key: 'title', title: '标题' },
        { key: 'type', title: '类型' },
        { key: 'url', title: 'URL' },
        { key: 'sourceName', title: '来源名称' },
        { key: 'sourceUrl', title: '来源URL' },
        { key: 'sourceCreator', title: '来源作者' },
        { key: 'sourceTime', title: '来源时间' },
        { key: 'insertTime', title: '录入时间' },
        { key: 'browse', title: '浏览量' },
        { key: 'creator', title: '创建人' },
        { key: 'crearedTime', title: '创建时间' },
      ],
      list,
    )
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const articles = data?.list ?? []

  const infoTotal = infoData?.total ?? 0
  const infoTotalPages = Math.max(1, Math.ceil(infoTotal / INFO_PAGE_SIZE))
  const infoList = infoData?.list ?? []

  const tabCls = (active: boolean) =>
    cn(
      'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
      active
        ? 'bg-background text-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground',
    )

  const hasInfoSearch =
    infoSearch.title ||
    infoSearch.url ||
    infoSearch.sourceName ||
    infoSearch.sourceUrl ||
    infoSearch.sourceCreator ||
    infoSearch.sourceTime ||
    infoSearch.insertTime ||
    infoSearch.browse

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

      <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
        <button onClick={() => setTab('articles')} className={tabCls(tab === 'articles')}>
          <Newspaper className="mr-1 inline h-4 w-4" />
          文章
        </button>
        <button onClick={() => setTab('information')} className={tabCls(tab === 'information')}>
          <Info className="mr-1 inline h-4 w-4" />
          信息库
        </button>
      </div>

      {tab === 'articles' && (
        <>
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
            <HasPermi code="system:news:export">
              <Button variant="outline" size="sm" onClick={handleArticleExport}>
                <Download className="h-4 w-4" />
                导出
              </Button>
            </HasPermi>
            <HasPermi code="system:news:add">
              <Button onClick={openCreate} size="sm" className="ml-auto">
                <Plus className="h-4 w-4" />
                {t('create')}
              </Button>
            </HasPermi>
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
                            <span className="max-w-xs break-words">{article.title}</span>
                          </div>
                          {article.summary ? (
                            <div className="max-w-xs break-words text-xs text-muted-foreground">
                              {article.summary}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="px-4 py-2.5">
                          {article.categoryName ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="px-4 py-2.5">
                          {article.authorName ?? <span className="text-muted-foreground">—</span>}
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
                            <HasPermi code="system:news:edit">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(article)}
                                title={t('edit')}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </HasPermi>
                            <HasPermi code="system:news:remove">
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
                            </HasPermi>
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
        </>
      )}

      {tab === 'information' && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <HasPermi code="ai:information:export">
              <Button variant="outline" size="sm" onClick={handleInfoExport}>
                <Download className="h-4 w-4" />
                导出
              </Button>
            </HasPermi>
            <HasPermi code="ai:information:add">
              <Button size="sm" onClick={openCreateInfo} className="ml-auto">
                <Plus className="h-4 w-4" />
                新增信息
              </Button>
            </HasPermi>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={infoSearch.title}
              onChange={(e) => setInfoSearch({ ...infoSearch, title: e.target.value })}
              placeholder="标题"
              className={cn('w-32', inputSm)}
            />
            <Input
              value={infoSearch.url}
              onChange={(e) => setInfoSearch({ ...infoSearch, url: e.target.value })}
              placeholder="URL"
              className={cn('w-32', inputSm)}
            />
            <Input
              value={infoSearch.sourceName}
              onChange={(e) => setInfoSearch({ ...infoSearch, sourceName: e.target.value })}
              placeholder="来源名称"
              className={cn('w-32', inputSm)}
            />
            <Input
              value={infoSearch.sourceUrl}
              onChange={(e) => setInfoSearch({ ...infoSearch, sourceUrl: e.target.value })}
              placeholder="来源URL"
              className={cn('w-32', inputSm)}
            />
            <Input
              value={infoSearch.sourceCreator}
              onChange={(e) => setInfoSearch({ ...infoSearch, sourceCreator: e.target.value })}
              placeholder="来源作者"
              className={cn('w-28', inputSm)}
            />
            <Input
              value={infoSearch.browse}
              onChange={(e) => setInfoSearch({ ...infoSearch, browse: e.target.value })}
              placeholder="浏览量"
              className={cn('w-24', inputSm)}
            />
            <Input
              type="date"
              value={infoSearch.sourceTime}
              onChange={(e) => setInfoSearch({ ...infoSearch, sourceTime: e.target.value })}
              className={cn('w-36', inputSm)}
              aria-label="来源时间"
            />
            <Input
              type="date"
              value={infoSearch.insertTime}
              onChange={(e) => setInfoSearch({ ...infoSearch, insertTime: e.target.value })}
              className={cn('w-36', inputSm)}
              aria-label="录入时间"
            />
            {hasInfoSearch && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setInfoSearch({
                    title: '',
                    url: '',
                    sourceName: '',
                    sourceUrl: '',
                    sourceCreator: '',
                    sourceTime: '',
                    insertTime: '',
                    browse: '',
                  })
                }
                className="h-8 text-xs"
              >
                重置
              </Button>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="px-3 py-2 text-xs">ID</TableHead>
                  <TableHead className="px-3 py-2 text-xs">标题</TableHead>
                  <TableHead className="px-3 py-2 text-xs">类型</TableHead>
                  <TableHead className="px-3 py-2 text-xs">URL</TableHead>
                  <TableHead className="px-3 py-2 text-xs">来源名称</TableHead>
                  <TableHead className="px-3 py-2 text-xs">来源作者</TableHead>
                  <TableHead className="px-3 py-2 text-xs">来源时间</TableHead>
                  <TableHead className="px-3 py-2 text-xs">浏览量</TableHead>
                  <TableHead className="px-3 py-2 text-xs text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y">
                {infoLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : infoError ? (
                  <TableRow>
                    <TableCell colSpan={9} className="px-3 py-10 text-center text-destructive">
                      {(infoError as Error).message}
                    </TableCell>
                  </TableRow>
                ) : infoList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                      <Info className="mx-auto mb-2 h-8 w-8 opacity-40" />
                      暂无信息
                    </TableCell>
                  </TableRow>
                ) : (
                  infoList.map((info) => (
                    <TableRow key={info.id} className="hover:bg-muted/30">
                      <TableCell className="px-3 py-2 text-xs text-muted-foreground">
                        {info.id}
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <div className="max-w-[200px] truncate font-medium" title={info.title}>
                          {info.title}
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-2 text-xs">
                        {info.type ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-xs">
                        {info.url ? (
                          <a
                            href={info.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                          >
                            {info.url}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-xs">
                        {info.sourceName ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-xs">
                        {info.sourceCreator ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-xs text-muted-foreground">
                        {info.sourceTime ?? '—'}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-xs">{info.browse ?? 0}</TableCell>
                      <TableCell className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <HasPermi code="ai:information:edit">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditInfo(info)}
                              title="编辑"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </HasPermi>
                          <HasPermi code="ai:information:remove">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteInfo(info)}
                              title="删除"
                              className="text-destructive hover:text-destructive"
                              disabled={deleteInfoMut.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </HasPermi>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">共 {infoTotal} 条</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={infoPage <= 1}
                onClick={() => setInfoPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                上一页
              </Button>
              <span className="text-sm text-muted-foreground">
                第 {infoPage} / {infoTotalPages} 页
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={infoPage >= infoTotalPages}
                onClick={() => setInfoPage((p) => p + 1)}
              >
                下一页
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

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

      <Dialog open={infoOpen} onOpenChange={(o) => (o ? setInfoOpen(true) : closeInfoDialog())}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={submitInfo} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editingInfo ? '编辑信息' : '新增信息'}</DialogTitle>
            </DialogHeader>
            {infoErr && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {infoErr}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="info-title">标题 *</Label>
              <Input
                id="info-title"
                value={infoForm.title}
                onChange={(e) => setInfoForm({ ...infoForm, title: e.target.value })}
                placeholder="请输入标题"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="info-type">类型</Label>
                <Input
                  id="info-type"
                  value={infoForm.type}
                  onChange={(e) => setInfoForm({ ...infoForm, type: e.target.value })}
                  placeholder="请输入类型"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="info-url">URL</Label>
                <Input
                  id="info-url"
                  value={infoForm.url}
                  onChange={(e) => setInfoForm({ ...infoForm, url: e.target.value })}
                  placeholder="请输入URL"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="info-sourceName">来源名称</Label>
                <Input
                  id="info-sourceName"
                  value={infoForm.sourceName}
                  onChange={(e) => setInfoForm({ ...infoForm, sourceName: e.target.value })}
                  placeholder="请输入来源名称"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="info-sourceUrl">来源URL</Label>
                <Input
                  id="info-sourceUrl"
                  value={infoForm.sourceUrl}
                  onChange={(e) => setInfoForm({ ...infoForm, sourceUrl: e.target.value })}
                  placeholder="请输入来源URL"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="info-sourceCreator">来源作者</Label>
                <Input
                  id="info-sourceCreator"
                  value={infoForm.sourceCreator}
                  onChange={(e) => setInfoForm({ ...infoForm, sourceCreator: e.target.value })}
                  placeholder="请输入来源作者"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="info-browse">浏览量</Label>
                <Input
                  id="info-browse"
                  type="number"
                  min="0"
                  value={infoForm.browse}
                  onChange={(e) => setInfoForm({ ...infoForm, browse: e.target.value })}
                  placeholder="请输入浏览量"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>来源时间</Label>
                <DatePicker
                  value={infoForm.sourceTime}
                  onChange={(v) => setInfoForm({ ...infoForm, sourceTime: v })}
                  placeholder="选择来源时间"
                />
              </div>
              <div>
                <Label>录入时间</Label>
                <DatePicker
                  value={infoForm.insertTime}
                  onChange={(v) => setInfoForm({ ...infoForm, insertTime: v })}
                  placeholder="选择录入时间"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="info-creator">创建人</Label>
                <Input
                  id="info-creator"
                  value={infoForm.creator}
                  onChange={(e) => setInfoForm({ ...infoForm, creator: e.target.value })}
                  placeholder="请输入创建人"
                />
              </div>
              <div>
                <Label>创建时间</Label>
                <DatePicker
                  value={infoForm.crearedTime}
                  onChange={(v) => setInfoForm({ ...infoForm, crearedTime: v })}
                  placeholder="选择创建时间"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>内容</Label>
              <RichTextEditor
                value={infoForm.content}
                onChange={(html) => setInfoForm({ ...infoForm, content: html })}
                placeholder="请输入内容"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeInfoDialog}
                disabled={saveInfoMut.isPending}
              >
                取消
              </Button>
              <Button type="submit" disabled={saveInfoMut.isPending}>
                {saveInfoMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                确认
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
