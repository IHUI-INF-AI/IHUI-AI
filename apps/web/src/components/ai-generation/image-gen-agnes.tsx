// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import * as React from 'react'
import Image from 'next/image'
import { Download, Loader2 } from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from '@/components/common'

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
import { type AsyncTask, extractMediaUrls } from '@/lib/ai-media'
import { ModelSelect, NumImagesSelect, useVendorModels } from './vendor-models'

// Agnes 生图模型 fallback(动态拉取失败时使用):agnes-image-2.5-flash(最新,默认)/ 2.1 / 2.0
const MODELS = ['agnes-image-2.5-flash', 'agnes-image-2.1-flash', 'agnes-image-2.0-flash'] as const
// Agnes 官方推荐 size 档位(1K/2K/3K/4K)
const SIZES = ['1K', '2K', '3K', '4K'] as const
// Agnes 支持的宽高比
const RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9'] as const

const TEXTAREA_CLS =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const ImageGenAgnes = React.memo(function ImageGenAgnes() {
  const t = useTranslations('aiGeneration')
  const [prompt, setPrompt] = React.useState('')
  const [model, setModel] = React.useState<string>(MODELS[0])
  const [size, setSize] = React.useState<string>(SIZES[0])
  const [ratio, setRatio] = React.useState<string>(RATIOS[0])
  const [numImages, setNumImages] = React.useState<string>('1')
  const [taskId, setTaskId] = React.useState<string | null>(null)
  const { models, isDynamic, isLoading } = useVendorModels('agnes', MODELS, (id) =>
    id.startsWith('agnes-image-'),
  )

  const mutation = useMutation({
    mutationFn: async (payload: {
      prompt: string
      model: string
      size: string
      ratio: string
      n?: number
    }) => {
      const res = await fetchApi<{ taskId: string; status: string }>('/api/ai/agnes/image', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: (data) => {
      setTaskId(data.taskId)
      toast.success(t('taskSubmitted'))
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const { data: task } = useQuery({
    queryKey: ['ai-task', taskId],
    queryFn: async () => {
      const res = await fetchApi<AsyncTask>(`/api/ai/tasks/${taskId}`)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    enabled: !!taskId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'succeeded' || status === 'failed' ? false : 3000
    },
  })

  const images = task?.status === 'succeeded' ? extractMediaUrls(task.result) : []

  const statusLabel = (status?: string): string => {
    switch (status) {
      case 'pending':
        return t('statusPending')
      case 'running':
        return t('statusRunning')
      case 'succeeded':
        return t('statusSucceeded')
      case 'failed':
        return t('statusFailed')
      default:
        return t('polling')
    }
  }

  const onSubmit = () => {
    if (!prompt.trim()) {
      toast.error(t('promptRequired'))
      return
    }
    setTaskId(null)
    const n = Number(numImages)
    mutation.mutate({
      prompt: prompt.trim(),
      model,
      size,
      ratio,
      ...(Number.isFinite(n) && n > 1 ? { n: Math.min(4, Math.floor(n)) } : {}),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('agnesImageTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('agnesImageSubtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="agnes-img-prompt">{t('prompt')}</Label>
          <textarea
            id="agnes-img-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('promptPlaceholder')}
            rows={3}
            className={TEXTAREA_CLS}
          />
        </div>
        <ModelSelect
          models={models}
          value={model}
          onChange={setModel}
          isDynamic={isDynamic}
          isLoading={isLoading}
        />
        <div className="grid grid-cols-3 gap-4">
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
          <div className="space-y-2">
            <Label>{t('aspectRatio')}</Label>
            <Select value={ratio} onValueChange={setRatio}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RATIOS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <NumImagesSelect value={numImages} onChange={setNumImages} />
        </div>
        <Button onClick={onSubmit} disabled={mutation.isPending} aria-busy={mutation.isPending}>
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {mutation.isPending ? t('generating') : t('generate')}
        </Button>

        {taskId && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {t('taskId')}: {taskId} · {t('status')}: {statusLabel(task?.status)}
            </div>
            {task?.status === 'pending' || task?.status === 'running' ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('polling')}
              </div>
            ) : null}
            {task?.status === 'failed' && task.error ? (
              <p className="text-sm text-destructive">{task.error}</p>
            ) : null}
            {task?.status === 'succeeded' && images.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noResult')}</p>
            ) : null}
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
          </div>
        )}
      </CardContent>
    </Card>
  )
})

export default ImageGenAgnes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
