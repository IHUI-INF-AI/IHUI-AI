'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import {
  api,
  fetchArticles,
  EMPTY_FORM,
  PAGE_SIZE,
  type Article,
  type ArticleForm,
  type Category,
} from './types'

export function useNewsArticles() {
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
    queryFn: () =>
      api<{ list: Category[] }>(`/api/admin/news/categories`).then((d) => d.list ?? []),
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

  return {
    search,
    setSearch,
    categoryId,
    setCategoryId,
    status,
    setStatus,
    page,
    setPage,
    total,
    totalPages,
    articles,
    isLoading,
    error,
    open,
    setOpen,
    editing,
    form,
    setForm,
    err,
    categories,
    saveMut,
    deleteMut,
    openCreate,
    openEdit,
    closeDialog,
    submit,
    handleDelete,
  }
}
