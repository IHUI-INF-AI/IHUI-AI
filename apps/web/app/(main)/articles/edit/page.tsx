'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Edit, Loader2, Send } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import type { ArticleDetail } from '../types'

interface ArticleCategory {
  id: string
  name: string
}

interface ArticleForm {
  title: string
  summary: string
  content: string
  categoryId: string
  coverImage: string
}

const EMPTY_FORM: ArticleForm = {
  title: '',
  summary: '',
  content: '',
  categoryId: '',
  coverImage: '',
}

const selectClass =
  'h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

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
      api<{ list: ArticleCategory[] }>(`/api/article/categories`).then((d) => d.list ?? []),
  })

  const { data: existing, isLoading: loadingDetail } = useQuery({
    queryKey: ['article', 'detail', editId],
    queryFn: () => api<ArticleDetail>(`/api/article/${editId}`),
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('editFormTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="a-title">{t('titleField')}</Label>
              <Input
                id="a-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={t('titlePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="a-summary">{t('summaryField')}</Label>
              <Input
                id="a-summary"
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                placeholder={t('summaryPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="a-cover">{t('coverField')}</Label>
              <Input
                id="a-cover"
                value={form.coverImage}
                onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
                placeholder={t('coverPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="a-category">{t('categoryField')}</Label>
              <Select
                value={form.categoryId}
                onValueChange={(v) => setForm({ ...form, categoryId: v })}
              >
                <SelectTrigger className={selectClass} id="a-category">
                  <SelectValue placeholder={t('categoryPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="a-content">{t('contentField')}</Label>
              <textarea
                id="a-content"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={12}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder={t('contentPlaceholder')}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(isEdit && editId ? `/articles/${editId}` : '/articles')}
                disabled={saveMut.isPending}
              >
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-1 h-4 w-4" />
                )}
                {isEdit ? t('save', { default: '保存' }) : t('publish')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
