'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { api } from '../helpers'
import { AskEditForm } from './AskEditForm'

export default function AskCreatePage() {
  const router = useRouter()
  const qc = useQueryClient()
  const [title, setTitle] = React.useState('')
  const [content, setContent] = React.useState('')
  const [tagsText, setTagsText] = React.useState('')
  const [formError, setFormError] = React.useState<string | null>(null)

  const createMut = useMutation({
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
      return api<{ ask: { id: string } }>(`/api/asks`, {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), content: content.trim(), tags }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asks'] })
      router.push('/asks')
    },
    onError: (e: Error) => setFormError(e.message),
  })

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Link
        href="/asks"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回问答列表
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">发布问题</h1>
      <AskEditForm
        title={title}
        setTitle={setTitle}
        content={content}
        setContent={setContent}
        tagsText={tagsText}
        setTagsText={setTagsText}
        formError={formError}
        pending={createMut.isPending}
        onSubmit={() => createMut.mutate()}
        onCancel={() => router.push('/asks')}
        isEdit={false}
      />
    </div>
  )
}
