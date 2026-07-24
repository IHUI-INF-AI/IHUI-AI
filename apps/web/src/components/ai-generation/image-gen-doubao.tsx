'use client'

import * as React from 'react'
import Image from 'next/image'
import { Download, Loader2 } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { extractMediaUrls } from '@/lib/ai-media'

const SIZES = ['1024x1024', '1280x720', '720x1280'] as const
const MODELS = [
  { value: 'doubao-pro', labelKey: 'modelDoubaoPro' as const },
  { value: 'doubao-lite', labelKey: 'modelDoubaoLite' as const },
] as const

const TEXTAREA_CLS =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const ImageGenDoubao = React.memo(function ImageGenDoubao() {
  const t = useTranslations('aiGeneration')
  const [prompt, setPrompt] = React.useState('')
  const [size, setSize] = React.useState<string>(SIZES[0])
  const [model, setModel] = React.useState<string>(MODELS[0].value)

  const mutation = useMutation({
    mutationFn: async (payload: { prompt: string; model: string; size: string }) => {
      const res = await fetchApi<unknown>('/api/ai/doubao/image', {
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
    if (!prompt.trim()) {
      toast.error(t('promptRequired'))
      return
    }
    mutation.mutate({ prompt: prompt.trim(), model, size })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('doubaoImageTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('doubaoImageSubtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="doubao-img-prompt">{t('prompt')}</Label>
          <textarea
            id="doubao-img-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('promptPlaceholder')}
            rows={3}
            className={TEXTAREA_CLS}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('model')}</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {t(m.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('size')}</Label>
            <Select value={size} onValueChange={setSize}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIZES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={onSubmit} disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {mutation.isPending ? t('generating') : t('generate')}
        </Button>

        {mutation.isPending ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={`skel-${i}`} className="h-40 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : null}

        {images.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
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

export default ImageGenDoubao
