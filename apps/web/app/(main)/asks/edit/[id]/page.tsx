'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { api } from '../../helpers'
import { AskEditForm } from '../AskEditForm'

interface AskDetail {
  id: string
  title: string
  content: string
  tags?: string[] | null
}

export default function AskEditByIdPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [title, setTitle] = React.useState('')
  const [content, setContent] = React.useState('')
  const [tagsText, setTagsText] = React.useState('')
  const [formError, setFormError] = React.useState<string | null>(null)

  const { isLoading } = useQuery({
    queryKey: ['ask', 'edit', params.id],
    queryFn: async () => {
      const r = await fetchApi<{ ask: AskDetail }>(`/api/asks/${params.id}`)
      if (!r.success) return null
      setTitle(r.data.ask.title ?? '')
      setContent(r.data.ask.content ?? '')
      setTagsText((r.data.ask.tags ?? []).join(', '))
      return r.data
    },
    enabled: !!params.id,
  })

  const updateMut = useMutation({
    mutationFn: async () => {
      setFormError(null)
      if (!title.trim() || !content.trim()) {
        setFormError('标题和内容不能为空')
        throw new Error('标题和内容不能为空')
      }
      const tags = tagsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      return api(`/api/asks/${params.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: title.trim(), content: content.trim(), tags }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asks'] })
      qc.invalidateQueries({ queryKey: ['ask', params.id] })
      router.push(`/asks/${params.id}`)
    },
    onError: (e: Error) => setFormError(e.message),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        加载中...
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Link
        href={`/asks/${params.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回问题详情
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">编辑问题</h1>
      <AskEditForm
        title={title}
        setTitle={setTitle}
        content={content}
        setContent={setContent}
        tagsText={tagsText}
        setTagsText={setTagsText}
        formError={formError}
        pending={updateMut.isPending}
        onSubmit={() => updateMut.mutate()}
        onCancel={() => router.push(`/asks/${params.id}`)}
        isEdit={true}
      />
    </div>
  )
}
