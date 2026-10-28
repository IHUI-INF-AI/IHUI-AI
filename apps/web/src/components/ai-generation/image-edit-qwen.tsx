// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Image from 'next/image'
import { Download, Loader2 } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from '@/components/common'

import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { extractMediaUrls } from '@/lib/ai-media'
import {
  AdvancedParamsPanel,
  parseParamValues,
  type ParamFieldSpec,
  type ParamValues,
} from './vendor-models'

// DashScope 图片编辑官方参数(model/negative_prompt/seed/watermark/n)
const QWEN_EDIT_FIELDS: ReadonlyArray<ParamFieldSpec> = [
  {
    key: 'model',
    label: 'model',
    type: 'select',
    options: [
      { value: 'wan2.6-image', label: 'wan2.6-image' },
      { value: 'wanx-x-paintlava', label: 'wanx-x-paintlava' },
    ],
  },
  { key: 'negative_prompt', label: 'negativePrompt', type: 'text', placeholder: '-' },
  { key: 'seed', label: 'seed', type: 'number', step: 1, placeholder: '-' },
  { key: 'watermark', label: 'watermark', type: 'boolean', placeholder: '-' },
  { key: 'n', label: 'numImages', type: 'number', min: 1, max: 4, step: 1, placeholder: '1' },
]

const TEXTAREA_CLS =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const ImageEditQwen = React.memo(function ImageEditQwen() {
  const t = useTranslations('aiGeneration')
  const [prompt, setPrompt] = React.useState('')
  const [imageUrl, setImageUrl] = React.useState('')
  const [maskUrl, setMaskUrl] = React.useState('')
  const [advanced, setAdvanced] = React.useState<ParamValues>({})

  const mutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
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
    const payload: Record<string, unknown> = {
      prompt: prompt.trim(),
      imageUrl: imageUrl.trim(),
      ...parseParamValues(advanced, QWEN_EDIT_FIELDS),
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
        <AdvancedParamsPanel fields={QWEN_EDIT_FIELDS} values={advanced} onChange={setAdvanced} />
        <Button onClick={onSubmit} disabled={mutation.isPending} aria-busy={mutation.isPending}>
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
