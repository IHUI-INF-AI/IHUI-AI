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
  Input,
  Label,
} from '@ihui/ui'
import { fetchApi } from '@/lib/api'
import { type AsyncTask, extractMediaUrls } from '@/lib/ai-media'

const TEXTAREA_CLS =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export function Model3dGenHunyuan() {
  const t = useTranslations('aiGeneration')
  const [prompt, setPrompt] = React.useState('')
  const [image, setImage] = React.useState('')
  const [taskId, setTaskId] = React.useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async (payload: {
      Prompt: string
      ImageUrl?: string
      ResultFormat: string
    }) => {
      const res = await fetchApi<{ JobId: string; taskId: string }>(
        '/api/ai/tencent/hunyuan3d/submit',
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

  const models = task?.status === 'succeeded' ? extractMediaUrls(task.result) : []

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
    if (!prompt.trim() && !image.trim()) {
      toast.error(t('promptRequired'))
      return
    }
    const payload: { Prompt: string; ImageUrl?: string; ResultFormat: string } = {
      Prompt: prompt.trim(),
      ResultFormat: 'FBX,GLB,USDZ',
    }
    if (image.trim()) payload.ImageUrl = image.trim()
    setTaskId(null)
    mutation.mutate(payload)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('hunyuan3dTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('hunyuan3dSubtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="hunyuan-prompt">{t('prompt')}</Label>
          <textarea
            id="hunyuan-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('promptPlaceholder')}
            rows={3}
            className={TEXTAREA_CLS}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hunyuan-image">{t('optionalImage')}</Label>
          <Input
            id="hunyuan-image"
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
            {task?.status === 'succeeded' && models.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noResult')}</p>
            ) : null}
            <div className="space-y-2">
              {models.map((url) => (
                <a
                  key={url}
                  href={url}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <Download className="h-4 w-4" />
                  {t('downloadModel')}
                </a>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default Model3dGenHunyuan
