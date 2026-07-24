'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { Input, Textarea, Select } from '@/components/form'
import { ImageUpload } from '@/components/form/ImageUpload'

interface CircleItem {
  id: string
  name: string
}
interface CirclesData {
  list: CircleItem[]
  total: number
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function CirclePostPage() {
  const t = useTranslations('circles')
  const tc = useTranslations('common')
  const router = useRouter()
  const qc = useQueryClient()
  const [circleId, setCircleId] = React.useState('')
  const [title, setTitle] = React.useState('')
  const [content, setContent] = React.useState('')
  const [images, setImages] = React.useState<string[]>([])
  const [formError, setFormError] = React.useState<string | null>(null)

  const { data: circlesData } = useQuery({
    queryKey: ['circles', 'for-post'],
    queryFn: () => api<CirclesData>(`/api/circles?page=1&pageSize=100`),
  })

  const createMut = useMutation({
    mutationFn: async () => {
      setFormError(null)
      if (!circleId) {
        setFormError(t('post.errorCircleRequired'))
        throw new Error(t('post.errorCircleRequired'))
      }
      if (!title.trim() || !content.trim()) {
        setFormError(t('post.errorTitleContentRequired'))
        throw new Error(t('post.errorTitleContentRequired'))
      }
      return api<{ post: { id: string } }>(`/api/circles/${circleId}/posts`, {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          images: images.length > 0 ? images : undefined,
        }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['circle-posts'] })
      qc.invalidateQueries({ queryKey: ['circles'] })
      router.push(`/circles/${circleId}`)
    },
    onError: (e: Error) => setFormError(e.message),
  })

  const circleOptions = (circlesData?.list ?? []).map((c) => ({ label: c.name, value: c.id }))

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Link
        href="/circles"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {tc('back')}
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('post.cardTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            label={t('post.selectCircle')}
            options={circleOptions}
            value={circleId}
            onChange={(v) => setCircleId(v as string)}
            placeholder={t('post.selectCirclePlaceholder')}
          />
          <Input
            label={t('post.titleLabel')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('post.titlePlaceholder')}
            maxLength={200}
          />
          <Textarea
            label={t('post.contentLabel')}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('post.contentPlaceholder')}
            rows={8}
          />
          <div className="space-y-1.5">
            <span className="text-sm font-medium leading-none">{t('post.images')}</span>
            <ImageUpload
              value={images}
              onChange={(v) => setImages(v as string[])}
              multiple
              maxCount={9}
            />
          </div>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
              {createMut.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {tc('submit')}
            </Button>
            <Button variant="outline" onClick={() => router.push('/circles')}>
              {tc('cancel')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
