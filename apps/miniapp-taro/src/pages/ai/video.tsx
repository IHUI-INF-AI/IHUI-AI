// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
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
import VideoPlayer from '@/components/VideoPlayer'
import EmptyState from '@/components/EmptyState'
import ErrorView from '@/components/ErrorView'
import { formatDateByTemplate } from '@ihui/shared'
import ThemeRoot from '@/components/ThemeRoot'

type Vendor = 'sora2' | 'kling' | 'doubao' | 'dashscope'
type Status = 'idle' | 'pending' | 'running' | 'succeeded' | 'failed'

interface VendorMeta {
  key: Vendor
  nameKey: string
  descKey: string
  available: boolean
}

const VENDORS: VendorMeta[] = [
  {
    key: 'sora2',
    nameKey: 'ai.video.vendors.sora2',
    descKey: 'ai.video.vendors.sora2Desc',
    available: false,
  },
  {
    key: 'kling',
    nameKey: 'ai.video.vendors.kling',
    descKey: 'ai.video.vendors.klingDesc',
    available: true,
  },
  {
    key: 'doubao',
    nameKey: 'ai.video.vendors.doubao',
    descKey: 'ai.video.vendors.doubaoDesc',
    available: true,
  },
  {
    key: 'dashscope',
    nameKey: 'ai.video.vendors.dashscope',
    descKey: 'ai.video.vendors.dashscopeDesc',
    available: true,
  },
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

const fmtTime = (ts: number) => formatDateByTemplate(ts, 'MM-DD HH:mm')

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
    <ThemeRoot className="min-h-screen bg-[var(--color-screen-canvas)]">
      <ScrollView scrollY className="h-screen">
        <View className="flex gap-[16rpx] px-[24rpx] py-[24rpx]">
          {VENDORS.map((v) => (
            <View
              key={v.key}
              className={`flex-1 py-[12rpx] text-center rounded-[12rpx] ${
                vendor === v.key ? 'bg-[var(--color-brand-orange)]' : 'bg-secondary'
              }`}
              onClick={() => setVendor(v.key)}
              hoverClass="opacity-60"
            >
              <Text
                className={`block text-[24rpx] ${vendor === v.key ? 'text-[var(--color-surface-light)]' : 'text-muted-foreground'}`}
              >
                {t(v.nameKey)}
              </Text>
              {!v.available ? (
                <Text className="block text-[20rpx] opacity-70 text-muted-foreground">
                  {t('ai.video.notAvailable')}
                </Text>
              ) : null}
            </View>
          ))}
        </View>

        <View className="mx-[24rpx] mt-[16rpx] bg-card rounded-[16rpx] border border-border p-[24rpx]">
          <Text className="block text-[24rpx] text-muted-foreground mb-[16rpx]">
            {t(currentVendor.descKey)}
          </Text>
          <Textarea
            className="w-full min-h-[192rpx] p-[24rpx] text-[24rpx] bg-transparent border border-border rounded-[12rpx] box-border"
            placeholder={t('ai.video.promptPlaceholder')}
            maxlength={500}
            value={prompt}
            onInput={(e) => setPrompt(e.detail.value)}
          />
          <View className="flex gap-[16rpx] mt-[24rpx]">
            {PARAMS.map((p) => (
              <View key={p.key} className="flex-1">
                <Text className="block text-[20rpx] text-muted-foreground mb-[8rpx]">
                  {t(p.labelKey)}
                </Text>
                <View className="flex gap-[8rpx]">
                  {p.options.map((opt) => (
                    <Text
                      key={opt}
                      className={`flex-1 py-[12rpx] text-center text-[20rpx] rounded-[12rpx] ${
                        params[p.key] === opt
                          ? 'bg-[var(--color-brand-orange)] text-[var(--color-surface-light)]'
                          : 'bg-secondary text-muted-foreground'
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
            className="mt-[24rpx] w-full h-[88rpx] leading-[88rpx] rounded-[12rpx] text-[24rpx] font-medium bg-[var(--color-brand-orange)] text-[var(--color-surface-light)] disabled:opacity-60"
            disabled={!prompt || status === 'pending' || status === 'running'}
            onClick={onGenerate}
          >
            {status === 'pending' || status === 'running' ? statusText : t('ai.video.generate')}
          </Button>
        </View>

        {status !== 'idle' && status !== 'failed' ? (
          <View className="mx-[24rpx] mt-[16rpx] bg-card rounded-[16rpx] border border-border p-[24rpx]">
            <Text className="block text-[28rpx] font-medium text-foreground mb-[16rpx]">
              {statusText}
            </Text>
            {resultUrl ? (
              <VideoPlayer src={resultUrl} />
            ) : (
              <View className="h-[420rpx] flex items-center justify-center bg-[var(--color-black-90)] rounded-[12rpx]">
                <Text className="text-[24rpx] text-[var(--color-text-tertiary)]">{statusText}</Text>
              </View>
            )}
            {resultUrl ? (
              <View className="flex gap-[16rpx] mt-[24rpx]">
                <Button
                  className="flex-1 h-[80rpx] leading-[80rpx] text-[24rpx] rounded-[12rpx] border border-border bg-transparent text-muted-foreground"
                  onClick={onDownload}
                >
                  {t('ai.video.download')}
                </Button>
                <Button
                  className="flex-1 h-[80rpx] leading-[80rpx] text-[24rpx] rounded-[12rpx] border border-border bg-transparent text-muted-foreground"
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
          <View className="mx-[24rpx] mt-[16rpx]">
            <ErrorView title={t('ai.video.failed')} desc={errorMsg} onRetry={onGenerate} />
          </View>
        ) : null}

        <View className="mx-[24rpx] mt-[24rpx] mb-[48rpx] bg-card rounded-[16rpx] border border-border p-[24rpx]">
          <Text className="block text-[28rpx] font-medium text-foreground mb-[16rpx]">
            {t('ai.video.history')}
          </Text>
          {history.length ? (
            <View className="flex flex-col gap-[16rpx]">
              {history.map((h) => (
                <View
                  key={h.id}
                  className="flex items-center py-[16rpx] bg-background rounded-[12rpx] px-[16rpx]"
                  onClick={() => replayHistory(h)}
                  hoverClass="opacity-60"
                >
                  <Text className="flex-1 text-[24rpx] text-foreground truncate">{h.prompt}</Text>
                  <Text className="text-[20rpx] text-[var(--color-text-tertiary)] ml-[16rpx]">
                    {t(VENDORS.find((v) => v.key === h.vendor)?.nameKey ?? '')} ·{' '}
                    {fmtTime(h.createdAt)}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <EmptyState text={t('ai.video.emptyHistory')} />
          )}
        </View>
      </ScrollView>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
