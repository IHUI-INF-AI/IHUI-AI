'use client'

import * as React from 'react'
import Image from 'next/image'
import { Download, Loader2 } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { extractMediaUrls } from '@/lib/ai-media'

const TEXTAREA_CLS =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const ImageEditQwen = React.memo(function ImageEditQwen() {
  const t = useTranslations('aiGeneration')
  const [prompt, setPrompt] = React.useState('')
  const [imageUrl, setImageUrl] = React.useState('')
  const [maskUrl, setMaskUrl] = React.useState('')

  const mutation = useMutation({
    mutationFn: async (payload: { prompt: string; imageUrl: string; maskUrl?: string }) => {
      const res = await fetchApi<unknown>('/api/ai/dashscope/image-edit', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => toast.success(t('generateSuccess')),
    onError: (err: Error) => toast.error(err.message),
  })

  const images = mutation.data ? extractMediaUrls(mutation.data) : []

  const onSubmit = () => {
    if (!prompt.trim() || !imageUrl.trim()) {
      toast.error(t('promptRequired'))
      return
    }
    const payload: { prompt: string; imageUrl: string; maskUrl?: string } = {
      prompt: prompt.trim(),
      imageUrl: imageUrl.trim(),
    }
    if (maskUrl.trim()) payload.maskUrl = maskUrl.trim()
    mutation.mutate(payload)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('qwenImageEditTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('qwenImageEditSubtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="qwen-edit-prompt">{t('prompt')}</Label>
          <textarea
            id="qwen-edit-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('promptPlaceholder')}
            rows={3}
            className={TEXTAREA_CLS}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="qwen-edit-url">{t('imageUrl')}</Label>
          <Input
            id="qwen-edit-url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder={t('imageUrlPlaceholder')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="qwen-edit-mask">{t('maskUrl')}</Label>
          <Input
            id="qwen-edit-mask"
            value={maskUrl}
            onChange={(e) => setMaskUrl(e.target.value)}
            placeholder={t('imageUrlPlaceholder')}
          />
        </div>
        <Button onClick={onSubmit} disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {mutation.isPending ? t('generating') : t('generate')}
        </Button>

        {mutation.isPending ? <div className="h-64 animate-pulse rounded-md bg-muted" /> : null}

        {images.length > 0 ? (
          <div className="space-y-2">
            {images.map((url) => (
              <div key={url} className="space-y-1">
                <Image
                  src={url}
                  alt={prompt}
                  width={800}
                  height={600}
                  unoptimized
                  className="h-auto w-full rounded-md border"
                />
                <a
                  href={url}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Download className="h-3 w-3" />
                  {t('download')}
                </a>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
})

export default ImageEditQwen
