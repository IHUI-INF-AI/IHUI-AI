import { View, Text, Textarea, Button, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, useRouter, useShareAppMessage } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import {
  generateVideoKling,
  generateVideoDoubao,
  generateVideoDashscope,
  soraRequestEnd,
} from '@/api'
import { logger } from '@/utils/logger'
import { useI18n } from '@/i18n'
import VideoPlayer from '@/components/VideoPlayer'
import EmptyState from '@/components/EmptyState'
import ErrorView from '@/components/ErrorView'

type Vendor = 'sora2' | 'kling' | 'doubao' | 'dashscope'
type Status = 'idle' | 'pending' | 'running' | 'succeeded' | 'failed'

interface VendorMeta {
  key: Vendor
  nameKey: string
  descKey: string
  available: boolean
}

const VENDORS: VendorMeta[] = [
  { key: 'sora2', nameKey: 'ai.video.vendors.sora2', descKey: 'ai.video.vendors.sora2Desc', available: false },
  { key: 'kling', nameKey: 'ai.video.vendors.kling', descKey: 'ai.video.vendors.klingDesc', available: true },
  { key: 'doubao', nameKey: 'ai.video.vendors.doubao', descKey: 'ai.video.vendors.doubaoDesc', available: true },
  { key: 'dashscope', nameKey: 'ai.video.vendors.dashscope', descKey: 'ai.video.vendors.dashscopeDesc', available: true },
]

interface ParamMeta {
  labelKey: string
  key: 'duration' | 'resolution' | 'fps'
  options: string[]
}

const PARAMS: ParamMeta[] = [
  { labelKey: 'ai.video.duration', key: 'duration', options: ['5', '10'] },
  { labelKey: 'ai.video.resolution', key: 'resolution', options: ['720p', '1080p'] },
  { labelKey: 'ai.video.fps', key: 'fps', options: ['24', '30'] },
]

const STORAGE_KEY = 'ihui_video_history'

interface HistoryItem {
  id: string
  vendor: Vendor
  prompt: string
  videoUrl?: string
  createdAt: number
  status: Status
}
function loadHistory(): HistoryItem[] {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY)
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

function saveHistory(items: HistoryItem[]): void {
  try {
    Taro.setStorageSync(STORAGE_KEY, items.slice(0, 10))
  } catch {
    // ignore
  }
}

function extractVideoUrl(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const obj = data as Record<string, unknown>
  for (const key of ['url', 'videoUrl', 'video_url', 'downloadUrl', 'output']) {
    const v = obj[key]
    if (typeof v === 'string' && /^https?:\/\//.test(v)) return v
  }
  if (Array.isArray(obj.results) && obj.results.length) return extractVideoUrl(obj.results[0])
  return ''
}

const fmtTime = (ts: number) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(ts)

const API_MAP: Record<Vendor, (data: unknown) => Promise<unknown>> = {
  sora2: soraRequestEnd,
  kling: generateVideoKling,
  doubao: generateVideoDoubao,
  dashscope: generateVideoDashscope,
}

export default function VideoPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [vendor, setVendor] = useState<Vendor>('kling')
  const [prompt, setPrompt] = useState('')
  const [params, setParams] = useState({ duration: '5', resolution: '720p', fps: '24' })
  const [status, setStatus] = useState<Status>('idle')
  const [resultUrl, setResultUrl] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [history, setHistory] = useState<HistoryItem[]>([])

  useDidShow(() => {
    setHistory(loadHistory())
    const incoming = router.params.prompt
    if (incoming) setPrompt(decodeURIComponent(incoming))
  })

  useShareAppMessage(() => ({
    title: t('ai.video.title'),
    path: '/pages/ai/video',
  }))

  const currentVendor = VENDORS.find((v) => v.key === vendor)!

  const statusText = useMemo(() => {
    switch (status) {
      case 'pending':
        return t('ai.video.pending')
      case 'running':
        return t('ai.video.generating')
      case 'succeeded':
        return t('ai.video.succeeded')
      case 'failed':
        return t('ai.video.failed')
      default:
        return ''
    }
  }, [status, t])

  const onGenerate = useCallback(async () => {
    if (!prompt || status === 'pending' || status === 'running') return
    if (!currentVendor.available) {
      Taro.showToast({ title: t('ai.video.modelUnavailable'), icon: 'none' })
      return
    }
    setStatus('pending')
    setErrorMsg('')
    setResultUrl('')
    const payload = { prompt, ...params }
    try {
      const res = (await API_MAP[vendor](payload)) as unknown
      setStatus('running')
      const url = extractVideoUrl(res)
      if (url) {
        setStatus('succeeded')
        setResultUrl(url)
        const item: HistoryItem = {
          id: `${Date.now()}`,
          vendor,
          prompt,
          videoUrl: url,
          createdAt: Date.now(),
          status: 'succeeded',
        }
        const next = [item, ...loadHistory()].slice(0, 10)
        setHistory(next)
        saveHistory(next)
      } else {
        Taro.showToast({ title: t('ai.video.taskSubmitted'), icon: 'none' })
      }
    } catch (e) {
      logger.error('ai/video', '生成视频', e)
      setStatus('failed')
      setErrorMsg(e instanceof Error ? e.message : t('ai.video.generateFailed'))
    }
  }, [prompt, status, currentVendor, vendor, params, t])

  const replayHistory = useCallback((item: HistoryItem) => {
    setVendor(item.vendor)
    setPrompt(item.prompt)
    if (item.videoUrl) {
      setResultUrl(item.videoUrl)
      setStatus('succeeded')
    }
  }, [])

  const onDownload = useCallback(async () => {
    if (!resultUrl) return
    try {
      const res = await Taro.downloadFile({ url: resultUrl })
      await Taro.saveVideoToPhotosAlbum({ filePath: res.tempFilePath })
      Taro.showToast({ title: t('ai.video.downloadSuccess'), icon: 'success' })
    } catch (e) {
      logger.error('ai/video', '下载视频', e)
      Taro.showToast({ title: t('ai.video.downloadFailed'), icon: 'none' })
    }
  }, [resultUrl, t])

  const onShare = useCallback(() => {
    Taro.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline'],
    } as Parameters<typeof Taro.showShareMenu>[0])
  }, [])

  return (
    <View className="min-h-screen bg-background">
      <ScrollView scrollY className="h-screen">
        <View className="flex gap-2 px-3 py-3 bg-card">
          {VENDORS.map((v) => (
            <View
              key={v.key}
              className={`flex-1 py-2 text-center text-sm rounded-md transition-colors ${
                vendor === v.key ? 'bg-primary text-white' : 'bg-muted text-foreground'
              }`}
              onClick={() => setVendor(v.key)}
            >
              <Text className="block">{t(v.nameKey)}</Text>
              {!v.available ? (
                <Text className="block text-[10px] opacity-70">{t('ai.video.notAvailable')}</Text>
              ) : null}
            </View>
          ))}
        </View>

        <View className="mx-3 mt-2 bg-card rounded-lg p-3">
          <Text className="block text-xs text-muted-foreground mb-2">{t(currentVendor.descKey)}</Text>
          <Textarea
            className="w-full min-h-[120rpx] p-2 text-sm bg-background rounded-md box-border"
            placeholder={t('ai.video.promptPlaceholder')}
            maxlength={500}
            value={prompt}
            onInput={(e) => setPrompt(e.detail.value)}
          />
          <View className="flex gap-2 mt-3">
            {PARAMS.map((p) => (
              <View key={p.key} className="flex-1">
                <Text className="block text-xs text-muted-foreground mb-1">{t(p.labelKey)}</Text>
                <View className="flex gap-1">
                  {p.options.map((opt) => (
                    <Text
                      key={opt}
                      className={`flex-1 py-1 text-center text-xs rounded ${
                        params[p.key] === opt
                          ? 'bg-primary text-white'
                          : 'bg-muted text-foreground'
                      }`}
                      onClick={() => setParams((prev) => ({ ...prev, [p.key]: opt }))}
                    >
                      {opt}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </View>
          <Button
            className="mt-3 w-full text-sm rounded-md !bg-primary !text-white"
            disabled={!prompt || status === 'pending' || status === 'running'}
            onClick={onGenerate}
          >
            {status === 'pending' || status === 'running' ? statusText : t('ai.video.generate')}
          </Button>
        </View>

        {status !== 'idle' && status !== 'failed' ? (
          <View className="mx-3 mt-2 bg-card rounded-lg p-3">
            <Text className="block text-sm font-medium text-foreground mb-2">{statusText}</Text>
            {resultUrl ? (
              <VideoPlayer src={resultUrl} />
            ) : (
              <View className="h-[210px] flex items-center justify-center bg-black rounded-md">
                <Text className="text-sm text-muted-foreground">{statusText}</Text>
              </View>
            )}
            {resultUrl ? (
              <View className="flex gap-2 mt-3">
                <Button
                  className="flex-1 text-sm rounded-md !bg-muted !text-foreground"
                  onClick={onDownload}
                >
                  {t('ai.video.download')}
                </Button>
                <Button
                  className="flex-1 text-sm rounded-md !bg-muted !text-foreground"
                  onClick={onShare}
                  openType="share"
                >
                  {t('ai.video.share')}
                </Button>
              </View>
            ) : null}
          </View>
        ) : null}

        {status === 'failed' ? (
          <View className="mx-3 mt-2">
            <ErrorView title={t('ai.video.failed')} desc={errorMsg} onRetry={onGenerate} />
          </View>
        ) : null}

        <View className="mx-3 mt-3 mb-6 bg-card rounded-lg p-3">
          <Text className="block text-sm font-medium text-foreground mb-2">
            {t('ai.video.history')}
          </Text>
          {history.length ? (
            <View className="flex flex-col gap-2">
              {history.map((h) => (
                <View
                  key={h.id}
                  className="flex items-center py-2 bg-background rounded-md px-2"
                  onClick={() => replayHistory(h)}
                >
                  <Text className="flex-1 text-xs text-foreground truncate">{h.prompt}</Text>
                  <Text className="text-[10px] text-muted-foreground ml-2">
                    {t(VENDORS.find((v) => v.key === h.vendor)?.nameKey ?? '')} · {fmtTime(h.createdAt)}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <EmptyState text={t('ai.video.emptyHistory')} />
          )}
        </View>
      </ScrollView>
    </View>
  )
}
