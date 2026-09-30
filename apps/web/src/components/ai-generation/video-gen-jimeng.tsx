// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from '@/components/common'

import { Button, Card, CardContent, CardHeader, CardTitle, Label } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import {
  AdvancedParamsPanel,
  parseParamValues,
  type ParamFieldSpec,
  type ParamValues,
} from './vendor-models'

// 即梦视频官方参数(火山引擎 CVSync2AsyncSubmitTask:req_key/seed/video_quality/duration/aspect_ratio/framespersecond/watermark/i2v_align/image_urls/use_pre_llm/camera_fixed)
const JIMENG_VIDEO_FIELDS: ReadonlyArray<ParamFieldSpec> = [
  {
    key: 'model',
    label: 'model',
    type: 'select',
    options: [
      { value: 'jimeng_t2v_l30', label: 'jimeng_t2v_l30' },
      { value: 'jimeng_t2v_l20', label: 'jimeng_t2v_l20' },
      { value: 'jimeng_i2v_l30', label: 'jimeng_i2v_l30' },
      { value: 'jimeng_i2v_l20', label: 'jimeng_i2v_l20' },
    ],
  },
  {
    key: 'video_quality',
    label: 'videoQuality',
    type: 'select',
    options: [
      { value: '360p', label: '360p' },
      { value: '480p', label: '480p' },
      { value: '720p', label: '720p' },
      { value: '1080p', label: '1080p' },
    ],
  },
  {
    key: 'aspect_ratio',
    label: 'aspectRatio',
    type: 'select',
    options: [
      { value: '16:9', label: '16:9' },
      { value: '9:16', label: '9:16' },
      { value: '1:1', label: '1:1' },
      { value: '4:3', label: '4:3' },
      { value: '3:4', label: '3:4' },
      { value: '21:9', label: '21:9' },
      { value: 'keep_ratio', label: 'keep_ratio' },
    ],
  },
  { key: 'duration', label: 'duration', type: 'number', step: 1, placeholder: '5' },
  { key: 'framespersecond', label: 'frameRate', type: 'number', step: 1, placeholder: '24' },
  { key: 'seed', label: 'seed', type: 'number', step: 1, placeholder: '-' },
  { key: 'watermark', label: 'watermark', type: 'boolean', placeholder: '-' },
  { key: 'use_pre_llm', label: 'usePreLlm', type: 'boolean', placeholder: '-' },
  { key: 'camera_fixed', label: 'cameraFixed', type: 'boolean', placeholder: '-' },
  { key: 'i2v_align', label: 'i2vAlign', type: 'text', placeholder: '-' },
  { key: 'image_urls', label: 'imageUrls', type: 'text', placeholder: '-' },
]

const TEXTAREA_CLS =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

/** 即梦视频任务行(videoGenerationTasks 表,日期字段序列化为字符串) */
interface JimengVideoTask {
  id: number
  taskId: string
  status: string
  message: string | null
  result: string | null
}

export function VideoGenJimeng() {
  const t = useTranslations('aiGeneration')
  const [prompt, setPrompt] = React.useState('')
  const [advanced, setAdvanced] = React.useState<ParamValues>({})
  const [taskId, setTaskId] = React.useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetchApi<{ taskId: string; status: string }>('/api/ai/jimeng4/video', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: (data) => {
      setTaskId(String(data.taskId))
      toast.success(t('taskSubmitted'))
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const { data: task } = useQuery({
    queryKey: ['jimeng-video-task', taskId],
    queryFn: async () => {
      const res = await fetchApi<{ task: JimengVideoTask }>(
        `/api/ai/jimeng4/video/tasks/${taskId}`,
      )
      if (!res.success) throw new Error(res.error)
      return res.data.task
    },
    enabled: !!taskId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'success' || status === 'failed' ? false : 4000
    },
  })

  const videos = React.useMemo(() => {
    if (task?.status !== 'success' || !task.result) return []
    try {
      const parsed = JSON.parse(task.result) as { video_urls?: string[] }
      return parsed.video_urls ?? []
    } catch {
      return []
    }
  }, [task])

  const statusLabel = (status?: string): string => {
    switch (status) {
      case 'accepted':
        return t('statusPending')
      case 'running':
        return t('statusRunning')
      case 'success':
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
    const advancedValues = parseParamValues(advanced, JIMENG_VIDEO_FIELDS)
    // image_urls 高级面板输入为逗号分隔文本,转换为官方数组格式
    const { image_urls: imageUrlsRaw, ...rest } = advancedValues
    const payload: Record<string, unknown> = {
      prompt: prompt.trim(),
      ...rest,
    }
    if (typeof imageUrlsRaw === 'string' && imageUrlsRaw.trim()) {
      payload.image_urls = imageUrlsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    }
    mutation.mutate(payload)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('jimengVideoTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('jimengVideoSubtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="jimeng-video-prompt">{t('prompt')}</Label>
          <textarea
            id="jimeng-video-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('promptPlaceholder')}
            rows={3}
            className={TEXTAREA_CLS}
          />
        </div>
        <AdvancedParamsPanel
          fields={JIMENG_VIDEO_FIELDS}
          values={advanced}
          onChange={setAdvanced}
        />
        <Button onClick={onSubmit} disabled={mutation.isPending} aria-busy={mutation.isPending}>
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {mutation.isPending ? t('generating') : t('generate')}
        </Button>

        {taskId && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {t('taskId')}: {taskId} · {t('status')}: {statusLabel(task?.status)}
            </div>
            {task?.status === 'accepted' || task?.status === 'running' ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('polling')}
              </div>
            ) : null}
            {task?.status === 'failed' && task.message ? (
              <p className="text-sm text-destructive">{task.message}</p>
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

export default VideoGenJimeng
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
