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
  Checkbox,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ihui/ui'
import { fetchApi } from '@/lib/api'
import { type AsyncTask, extractMediaUrls } from '@/lib/ai-media'

const STYLES = ['pop', 'rock', 'classical', 'electronic'] as const
const DURATIONS = ['30', '60', '120'] as const

const TEXTAREA_CLS =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export function MusicGenSuno() {
  const t = useTranslations('aiGeneration')
  const [prompt, setPrompt] = React.useState('')
  const [style, setStyle] = React.useState<string>(STYLES[0])
  const [duration, setDuration] = React.useState<string>(DURATIONS[0])
  const [instrumental, setInstrumental] = React.useState(false)
  const [taskId, setTaskId] = React.useState<string | null>(null)

  const styleLabel = (s: string): string => {
    switch (s) {
      case 'pop':
        return t('stylePop')
      case 'rock':
        return t('styleRock')
      case 'classical':
        return t('styleClassical')
      case 'electronic':
        return t('styleElectronic')
      default:
        return s
    }
  }

  const mutation = useMutation({
    mutationFn: async (payload: { prompt: string; duration: number }) => {
      const res = await fetchApi<{ taskId: string; status: string }>('/api/ai/suno/generate', {
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

  const audios = task?.status === 'succeeded' ? extractMediaUrls(task.result) : []

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
    const parts: string[] = [styleLabel(style)]
    if (instrumental) parts.push('instrumental')
    parts.push(prompt.trim())
    const combinedPrompt = parts.join(', ')
    setTaskId(null)
    mutation.mutate({ prompt: combinedPrompt, duration: Number(duration) })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('sunoMusicTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('sunoMusicSubtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="suno-prompt">{t('prompt')}</Label>
          <textarea
            id="suno-prompt"
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
                  <SelectItem key={s} value={s}>
                    {styleLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="suno-instrumental"
            checked={instrumental}
            onCheckedChange={(v) => setInstrumental(v === true)}
          />
          <Label htmlFor="suno-instrumental" className="cursor-pointer text-sm font-normal">
            {t('instrumental')}
          </Label>
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
            {task?.status === 'succeeded' && audios.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noResult')}</p>
            ) : null}
            {audios.map((url) => (
              <audio key={url} src={url} controls className="w-full">
                <track kind="captions" />
              </audio>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default MusicGenSuno
