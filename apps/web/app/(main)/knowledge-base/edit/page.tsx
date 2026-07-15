'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Edit } from 'lucide-react'

import { KBArticleForm } from './KBArticleForm'
import { EMPTY_KB_FORM, api, type KBCategory, type KBForm } from './helpers'

export default function KBEditPage() {
  const router = useRouter()
  const qc = useQueryClient()

  const [form, setForm] = React.useState<KBForm>(EMPTY_KB_FORM)
  const [tagInput, setTagInput] = React.useState('')
  const [err, setErr] = React.useState<string | null>(null)

  const { data: categories = [] } = useQuery({
    queryKey: ['kb', 'categories'],
    queryFn: () =>
      api<{ list: KBCategory[] }>(`/api/knowledge-base/categories`).then((d) => d.list ?? []),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title.trim(),
        summary: form.summary.trim() || undefined,
        content: form.content,
        categoryId: form.categoryId || undefined,
        tags: form.tags.length > 0 ? form.tags : undefined,
      }
      return api(`/api/knowledge-base`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb'] })
      router.push('/knowledge-base')
    },
    onError: (e: Error) => setErr(e.message),
  })

  function addTag() {
    const t = tagInput.trim()
    if (t && !form.tags.includes(t)) {
      setForm({ ...form, tags: [...form.tags, t] })
    }
    setTagInput('')
  }

  function removeTag(t: string) {
    setForm({ ...form, tags: form.tags.filter((x) => x !== t) })
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.title.trim()) {
      setErr('请输入标题')
      return
    }
    if (!form.content.trim()) {
      setErr('请输入内容')
      return
    }
    saveMut.mutate()
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Edit className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">新建知识库文章</h1>
        </div>
        <p className="text-sm text-muted-foreground">撰写新的知识库文章并发布</p>
      </header>

      <Link
        href="/knowledge-base"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回列表
      </Link>

      <KBArticleForm
        form={form}
        categories={categories}
        tagInput={tagInput}
        err={err}
        submitting={saveMut.isPending}
        onFormChange={setForm}
        onTagInputChange={setTagInput}
        onAddTag={addTag}
        onRemoveTag={removeTag}
        onSubmit={submit}
        onCancel={() => router.push('/knowledge-base')}
      />
    </div>
  )
}
