'use client'

import * as React from 'react'
import { Download, Loader2 } from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
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
import { type AsyncTask, extractMediaUrls } from '@/lib/ai-media'

const SIZES = ['1024*1024', '1280*720', '720*1280'] as const
const COUNTS = ['1', '2', '3', '4'] as const

const TEXTAREA_CLS =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export function ImageGenQwen() {
  const t = useTranslations('aiGeneration')
  const [prompt, setPrompt] = React.useState('')
  const [size, setSize] = React.useState<string>(SIZES[0])
  const [count, setCount] = React.useState<string>(COUNTS[0])
  const [taskId, setTaskId] = React.useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async (payload: { prompt: string; model: string; size: string; n: number }) => {
      const res = await fetchApi<{ taskId: string; status: string }>(
        '/api/ai/dashscope/image',
        { method: 'POST', body: JSON.stringify(payload) },
      )
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
    mutation.mutate({ prompt: prompt.trim(), model: 'wanx-v1', size, n: Number(count) })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('qwenImageTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('qwenImageSubtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="qwen-img-prompt">{t('prompt')}</Label>
          <textarea
            id="qwen-img-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('promptPlaceholder')}
            rows={3}
            className={TEXTAREA_CLS}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('size')}</Label>
            <Select value={size} onValueChange={setSize}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIZES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace('*', 'x')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('count')}</Label>
            <Select value={count} onValueChange={setCount}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
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
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default ImageGenQwen
