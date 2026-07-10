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
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ihui/ui'
import { fetchApi } from '@/lib/api'
import { type AsyncTask, extractMediaUrls } from '@/lib/ai-media'

const DURATIONS = ['5', '10', '20'] as const
const RESOLUTIONS = ['720p', '1080p', '4K'] as const

const SIZE_MAP: Record<string, string> = {
  '720p': '1280x720',
  '1080p': '1920x1080',
  '4K': '3840x2160',
}

const TEXTAREA_CLS =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export function VideoGenSora2() {
  const t = useTranslations('aiGeneration')
  const [prompt, setPrompt] = React.useState('')
  const [duration, setDuration] = React.useState<string>(DURATIONS[0])
  const [resolution, setResolution] = React.useState<string>(RESOLUTIONS[0])
  const [taskId, setTaskId] = React.useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async (payload: {
      prompt: string
      duration: number
      size: string
    }) => {
      const res = await fetchApi<{ taskId: string; status: string }>(
        '/api/ai/sora2/generate',
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
    setTaskId(null)
    mutation.mutate({
      prompt: prompt.trim(),
      duration: Number(duration),
      size: SIZE_MAP[resolution] ?? '1280x720',
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('sora2VideoTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('sora2VideoSubtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sora2-prompt">{t('prompt')}</Label>
          <textarea
            id="sora2-prompt"
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
            {task?.status === 'succeeded' && videos.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noResult')}</p>
            ) : null}
            {videos.map((url) => (
              <video key={url} src={url} controls className="w-full rounded-md border" />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default VideoGenSora2
