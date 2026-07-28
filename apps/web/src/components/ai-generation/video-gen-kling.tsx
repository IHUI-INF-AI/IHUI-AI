'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { type AsyncTask, extractMediaUrls } from '@/lib/ai-media'

const DURATIONS = ['5', '10'] as const
const RESOLUTIONS = ['720p', '1080p'] as const

const TEXTAREA_CLS =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export function VideoGenKling() {
  const t = useTranslations('aiGeneration')
  const [prompt, setPrompt] = React.useState('')
  const [duration, setDuration] = React.useState<string>(DURATIONS[0])
  const [resolution, setResolution] = React.useState<string>(RESOLUTIONS[0])
  const [image, setImage] = React.useState('')
  const [taskId, setTaskId] = React.useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async (payload: {
      prompt: string
      duration: string
      resolution: string
      image?: string
    }) => {
      const res = await fetchApi<{ taskId: string; status: string }>(
        '/api/ai/kling/video/generate',
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

  const videos = task?.status === 'succeeded' ? extractMediaUrls(task.result) : []

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
    const payload: { prompt: string; duration: string; resolution: string; image?: string } = {
      prompt: prompt.trim(),
      duration,
      resolution,
    }
    if (image.trim()) payload.image = image.trim()
    setTaskId(null)
    mutation.mutate(payload)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('klingVideoTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('klingVideoSubtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="kling-prompt">{t('prompt')}</Label>
          <textarea
            id="kling-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('promptPlaceholder')}
            rows={3}
            className={TEXTAREA_CLS}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('duration')}</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}s
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('resolution')}</Label>
            <Select value={resolution} onValueChange={setResolution}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESOLUTIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="kling-image">{t('imageToVideo')}</Label>
          <Input
            id="kling-image"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder={t('imageUrlPlaceholder')}
          />
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
            {videos.map((url) => (
              <video key={url} src={url} controls className="w-full rounded-md border">
                <track kind="captions" />
              </video>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default VideoGenKling
