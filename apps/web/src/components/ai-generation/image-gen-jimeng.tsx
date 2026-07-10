'use client'

import * as React from 'react'
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
} from '@ihui/ui'
import { fetchApi } from '@/lib/api'
import { extractMediaUrls } from '@/lib/ai-media'

const STYLES = [
  { value: 'photo', labelKey: 'stylePhoto' as const },
  { value: 'anime', labelKey: 'styleAnime' as const },
  { value: 'oil', labelKey: 'styleOil' as const },
  { value: 'watercolor', labelKey: 'styleWatercolor' as const },
] as const

const RATIOS = [
  { value: '1:1', w: 1024, h: 1024 },
  { value: '16:9', w: 1280, h: 720 },
  { value: '9:16', w: 720, h: 1280 },
] as const

const TEXTAREA_CLS =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export function ImageGenJimeng() {
  const t = useTranslations('aiGeneration')
  const [prompt, setPrompt] = React.useState('')
  const [style, setStyle] = React.useState<string>(STYLES[0].value)
  const [ratio, setRatio] = React.useState<string>(RATIOS[0].value)

  const mutation = useMutation({
    mutationFn: async (payload: { prompt: string; width: number; height: number }) => {
      const res = await fetchApi<unknown>('/api/ai/jimeng4/image', {
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
    const selected = RATIOS.find((r) => r.value === ratio) ?? RATIOS[0]
    const styleLabel = STYLES.find((s) => s.value === style)?.labelKey
    const prefix = styleLabel ? `${t(styleLabel)} ` : ''
    mutation.mutate({ prompt: `${prefix}${prompt.trim()}`, width: selected.w, height: selected.h })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('jimengImageTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('jimengImageSubtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="jimeng-img-prompt">{t('prompt')}</Label>
          <textarea
            id="jimeng-img-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('promptPlaceholder')}
            rows={3}
            className={TEXTAREA_CLS}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('style')}</Label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STYLES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {t(s.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('aspectRatio')}</Label>
            <Select value={ratio} onValueChange={setRatio}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RATIOS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.value}
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
          <div className="h-64 animate-pulse rounded-md bg-muted" />
        ) : null}

        {images.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {images.map((url) => (
              <div key={url} className="space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={prompt} className="w-full rounded-md border" />
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
}

export default ImageGenJimeng
