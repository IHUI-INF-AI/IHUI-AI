'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Edit, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import type { ArticleDetail } from '../types'
import { ArticleEditForm } from './ArticleEditForm'
import { EMPTY_FORM } from './types'
import type { ArticleForm, ArticleCategoryOption } from './types'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function ArticleEditPage() {
  const t = useTranslations('articles')
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('id')
  const isEdit = !!editId
  const qc = useQueryClient()

  const [form, setForm] = React.useState<ArticleForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  const { data: categories = [] } = useQuery({
    queryKey: ['articles', 'categories'],
    queryFn: () =>
      api<{ list: ArticleCategoryOption[] }>(`/api/article/categories`).then((d) => d.list ?? []),
  })

  const { data: existing, isLoading: loadingDetail } = useQuery({
    queryKey: ['article', 'detail', editId],
    queryFn: () => api<ArticleDetail>(`/api/article/detail/${editId}`),
    enabled: isEdit,
  })

  React.useEffect(() => {
    if (!isEdit || !existing) return
    setForm({
      title: existing.title ?? '',
      summary: existing.summary ?? '',
      content: (existing as ArticleDetail & { content?: string }).content ?? '',
      categoryId: existing.categoryId ?? '',
      coverImage: existing.coverImage ?? '',
    })
  }, [isEdit, existing])

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title.trim(),
        summary: form.summary.trim() || undefined,
        content: form.content,
        categoryId: form.categoryId || undefined,
        coverImage: form.coverImage.trim() || undefined,
      }
      if (isEdit && editId) {
        return api(`/api/article/${editId}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      }
      return api(`/api/article/publish`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['articles'] })
      qc.invalidateQueries({ queryKey: ['articles', 'my'] })
      router.push(isEdit && editId ? `/articles/${editId}` : '/user/articles')
    },
    onError: (e: Error) => setErr(e.message),
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.title.trim()) {
      setErr(t('titleRequired'))
      return
    }
    if (!form.content.trim()) {
      setErr(t('contentRequired'))
      return
    }
    saveMut.mutate()
  }

  if (loadingDetail && isEdit) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Edit className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {isEdit ? t('editTitle', { default: '编辑文章' }) : t('editTitle')}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">{t('editSubtitle')}</p>
      </header>

      <Link
        href={isEdit && editId ? `/articles/${editId}` : '/articles'}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToList')}
      </Link>

      <ArticleEditForm
        form={form}
        categories={categories}
        isEdit={isEdit}
        isPending={saveMut.isPending}
        err={err}
        onFormChange={setForm}
        onSubmit={submit}
        onCancel={() => router.push(isEdit && editId ? `/articles/${editId}` : '/articles')}
      />
    </div>
  )
}
