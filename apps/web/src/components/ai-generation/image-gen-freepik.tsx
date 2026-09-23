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
import { extractMediaUrls } from '@/lib/ai-media'

const MODELS = ['mystic', 'classic', 'realism'] as const

const TEXTAREA_CLS =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

interface FreepikSubmitResult {
  data?: { task_id?: string }
  poll_model?: string
}

interface FreepikTaskResult {
  data?: { status?: string }
}

export function ImageGenFreepik() {
  const t = useTranslations('aiGeneration')
  const [prompt, setPrompt] = React.useState('')
  const [model, setModel] = React.useState<string>(MODELS[0])
  const [poll, setPoll] = React.useState<{ taskId: string; model: string } | null>(null)

  const mutation = useMutation({
    mutationFn: async (payload: { prompt: string; model: string }) => {
      const res = await fetchApi<FreepikSubmitResult>('/api/ai/freepik/generate', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (!res.success) throw new Error(res.error)
      const taskId = res.data?.data?.task_id
      if (!taskId) throw new Error(t('noResult'))
      return { taskId, model: res.data?.poll_model ?? payload.model }
    },
    onSuccess: ({ taskId, model: pollModel }) => {
      setPoll({ taskId, model: pollModel })
      toast.success(t('taskSubmitted'))
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const { data: task } = useQuery({
    queryKey: ['freepik-task', poll?.taskId, poll?.model],
    queryFn: async () => {
      const res = await fetchApi<FreepikTaskResult>(
        `/api/ai/freepik/tasks/${poll?.taskId}?model=${encodeURIComponent(poll?.model ?? '')}`,
        { method: 'GET' },
      )
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    enabled: !!poll,
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status
      return status === 'COMPLETED' || status === 'FAILED' ? false : 5000
    },
  })

  const status = task?.data?.status
  const images = status === 'COMPLETED' && task ? extractMediaUrls(task) : []

  const statusLabel = (s?: string): string => {
    switch (s) {
      case 'COMPLETED':
        return t('statusSucceeded')
      case 'FAILED':
        return t('statusFailed')
      case 'CREATED':
      case 'IN_PROGRESS':
        return t('statusRunning')
      default:
        return t('polling')
    }
  }

  const onSubmit = () => {
    if (!prompt.trim()) {
      toast.error(t('promptRequired'))
      return
    }
    setPoll(null)
    mutation.mutate({ prompt: prompt.trim(), model })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('freepikImageTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('freepikImageSubtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="freepik-img-prompt">{t('prompt')}</Label>
          <textarea
            id="freepik-img-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('promptPlaceholder')}
            rows={3}
            className={TEXTAREA_CLS}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('model')}</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODELS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={onSubmit} disabled={mutation.isPending} aria-busy={mutation.isPending}>
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {mutation.isPending ? t('generating') : t('generate')}
        </Button>

        {poll && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {t('taskId')}: {poll.taskId} · {t('status')}: {statusLabel(status)}
            </div>
            {status !== 'COMPLETED' && status !== 'FAILED' ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('polling')}
              </div>
            ) : null}
            {status === 'FAILED' ? (
              <p className="text-sm text-destructive">{t('statusFailed')}</p>
            ) : null}
            {status === 'COMPLETED' && images.length === 0 ? (
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
}

export default ImageGenFreepik
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
