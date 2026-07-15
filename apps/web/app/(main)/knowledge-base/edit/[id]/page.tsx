'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Edit, Loader2 } from 'lucide-react'

import { KBArticleForm } from '../KBArticleForm'
import { EMPTY_KB_FORM, api, type KBCategory, type KBArticle, type KBForm } from '../helpers'

export default function KBEditByIdPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()

  const [form, setForm] = React.useState<KBForm>(EMPTY_KB_FORM)
  const [tagInput, setTagInput] = React.useState('')
  const [err, setErr] = React.useState<string | null>(null)
  const [loaded, setLoaded] = React.useState(false)

  const { data: categories = [] } = useQuery({
    queryKey: ['kb', 'categories'],
    queryFn: () =>
      api<{ list: KBCategory[] }>(`/api/knowledge-base/categories`).then((d) => d.list ?? []),
  })
  const { data, isLoading, error } = useQuery({
    queryKey: ['kb', 'detail', id],
    queryFn: () => api<{ article: KBArticle }>(`/api/knowledge-base/${id}`),
  })

  React.useEffect(() => {
    if (data && !loaded) {
      const a = data.article
      setForm({
        title: a.title,
        summary: a.summary ?? '',
        content: a.content,
        categoryId: a.categoryId ?? '',
        tags: a.tags ?? [],
      })
      setLoaded(true)
    }
  }, [data, loaded])

  const saveMut = useMutation({
    mutationFn: () =>
      api(`/api/knowledge-base/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: form.title.trim(),
          summary: form.summary.trim() || undefined,
          content: form.content,
          categoryId: form.categoryId || undefined,
          tags: form.tags.length > 0 ? form.tags : undefined,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb'] })
      router.push(`/knowledge-base/${id}`)
    },
    onError: (e: Error) => setErr(e.message),
  })

  function addTag() {
    const t = tagInput.trim()
    if (t && !form.tags.includes(t)) setForm({ ...form, tags: [...form.tags, t] })
    setTagInput('')
  }
  function removeTag(t: string) {
    setForm({ ...form, tags: form.tags.filter((x) => x !== t) })
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.title.trim()) return setErr('请输入标题')
    if (!form.content.trim()) return setErr('请输入内容')
    saveMut.mutate()
  }

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        加载中...
      </div>
    )

  if (error || !data)
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <Link
          href="/knowledge-base"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error)?.message ?? '文章不存在'}
        </div>
      </div>
    )

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Edit className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">编辑文章</h1>
        </div>
        <p className="text-sm text-muted-foreground">修改知识库文章内容</p>
      </header>

      <Link
        href={`/knowledge-base/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回文章
      </Link>

      <KBArticleForm
        form={form}
        categories={categories}
        tagInput={tagInput}
        err={err}
        submitting={saveMut.isPending}
        submitLabel="保存"
        onFormChange={setForm}
        onTagInputChange={setTagInput}
        onAddTag={addTag}
        onRemoveTag={removeTag}
        onSubmit={submit}
        onCancel={() => router.push(`/knowledge-base/${id}`)}
      />
    </div>
  )
}
