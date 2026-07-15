'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { ArticleTable } from './ArticleTable'
import { ArticleDialog } from './ArticleDialog'
import {
  api,
  EMPTY_FORM,
  fetchArticles,
  type Article,
  type ArticleForm,
  type ArticleStatus,
} from './types'

export default function AdminArticlesPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [status, setStatus] = React.useState<'all' | ArticleStatus>('all')
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

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'articles', debounced, status, page],
    queryFn: () => fetchArticles({ page, search: debounced, status }),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title.trim(),
        authorName: form.authorName.trim() || undefined,
        summary: form.summary.trim() || undefined,
        content: form.content,
        status: (form.published ? 'published' : 'draft') as ArticleStatus,
      }
      return editing
        ? api<Article>(`/api/admin/articles/${editing.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : api<Article>(`/api/admin/articles`, {
            method: 'POST',
            body: JSON.stringify(body),
          })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '创建成功')
      qc.invalidateQueries({ queryKey: ['admin', 'articles'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/articles/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'articles'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const toggleMut = useMutation({
    mutationFn: (a: Article) =>
      api<Article>(`/api/admin/articles/${a.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: (a.status === 'published' ? 'draft' : 'published') as ArticleStatus,
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'articles'] }),
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function openEdit(a: Article) {
    setEditing(a)
    setForm({
      title: a.title,
      authorName: a.authorName ?? '',
      summary: a.summary ?? '',
      content: a.content ?? '',
      published: a.status === 'published',
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
      setErr('请输入文章标题')
      return
    }
    saveMut.mutate()
  }
  function handleDelete(a: Article) {
    if (!window.confirm('确认删除该文章?')) return
    deleteMut.mutate(a.id)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">文章管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">管理文章内容、发布状态与分类</p>
      </div>

      <ArticleTable
        search={search}
        setSearch={setSearch}
        status={status}
        setStatus={setStatus}
        page={page}
        setPage={setPage}
        total={data?.total ?? 0}
        articles={data?.list ?? []}
        isLoading={isLoading}
        error={error as Error | null}
        togglePending={toggleMut.isPending}
        deletePending={deleteMut.isPending}
        onToggle={(a) => toggleMut.mutate(a)}
        onDelete={handleDelete}
        onEdit={openEdit}
        onCreate={openCreate}
      />

      <ArticleDialog
        open={open}
        setOpen={setOpen}
        editing={!!editing}
        form={form}
        setForm={setForm}
        err={err}
        saving={saveMut.isPending}
        onClose={closeDialog}
        onSubmit={submit}
      />
    </div>
  )
}
