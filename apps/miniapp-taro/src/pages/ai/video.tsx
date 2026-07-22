import { View, Text, Textarea, Button, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
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

type Vendor = 'sora2' | 'kling' | 'doubao' | 'dashscope'
type Status = 'idle' | 'pending' | 'running' | 'succeeded' | 'failed'

const VENDORS: Array<{ key: Vendor; name: string; desc: string; available: boolean }> = [
  { key: 'sora2', name: 'Sora2', desc: 'OpenAI 视频模型', available: false },
  { key: 'kling', name: '可灵', desc: '快手可灵视频', available: true },
  { key: 'doubao', name: '豆包', desc: '字节豆包视频', available: true },
  { key: 'dashscope', name: 'Dashscope', desc: '阿里通义万相', available: true },
]

const PARAMS: Array<{ label: string; key: 'duration' | 'resolution' | 'fps'; options: string[] }> =
  [
    { label: '时长(秒)', key: 'duration', options: ['5', '10'] },
    { label: '分辨率', key: 'resolution', options: ['720p', '1080p'] },
    { label: '帧率', key: 'fps', options: ['24', '30'] },
  ]

const STATUS_TEXT: Record<Status, string> = {
  idle: '',
  pending: '排队中...',
  running: '生成中...',
  succeeded: '生成完成',
  failed: '生成失败',
}

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
  const [vendor, setVendor] = useState<Vendor>('kling')
  const [prompt, setPrompt] = useState('')
  const [params, setParams] = useState({ duration: '5', resolution: '720p', fps: '24' })
  const [status, setStatus] = useState<Status>('idle')
  const [resultUrl, setResultUrl] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [history, setHistory] = useState<HistoryItem[]>([])

  useDidShow(() => setHistory(loadHistory()))

  const currentVendor = VENDORS.find((v) => v.key === vendor)!
  const onGenerate = useCallback(async () => {
    if (!prompt || status === 'pending' || status === 'running') return
    if (!currentVendor.available) {
      Taro.showToast({ title: '该模型 API 暂未开放', icon: 'none' })
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
        Taro.showToast({ title: '任务已提交,请稍后查看历史', icon: 'none' })
      }
    } catch (e) {
      logger.error('ai/video', '生成视频', e)
      setStatus('failed')
      setErrorMsg(e instanceof Error ? e.message : '生成失败')
    }
  }, [prompt, status, currentVendor, vendor, params])

  const replayHistory = useCallback((item: HistoryItem) => {
    setVendor(item.vendor)
    setPrompt(item.prompt)
    if (item.videoUrl) {
      setResultUrl(item.videoUrl)
      setStatus('succeeded')
    }
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
              <Text className="block">{v.name}</Text>
              {!v.available ? <Text className="block text-[10px] opacity-70">未开放</Text> : null}
            </View>
          ))}
        </View>

        <View className="mx-3 mt-2 bg-card rounded-lg p-3">
          <Text className="block text-xs text-muted-foreground mb-2">{currentVendor.desc}</Text>
          <Textarea
            className="w-full min-h-[120rpx] p-2 text-sm bg-background rounded-md box-border"
            placeholder="描述你想要生成的视频内容..."
            maxlength={500}
            value={prompt}
            onInput={(e) => setPrompt(e.detail.value)}
          />
          <View className="flex gap-2 mt-3">
            {PARAMS.map((p) => (
              <View key={p.key} className="flex-1">
                <Text className="block text-xs text-muted-foreground mb-1">{p.label}</Text>
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
            {status === 'pending' || status === 'running' ? STATUS_TEXT[status] : '生成视频'}
          </Button>
        </View>

        {status !== 'idle' && status !== 'failed' ? (
          <View className="mx-3 mt-2 bg-card rounded-lg p-3">
            <Text className="block text-sm font-medium text-foreground mb-2">
              {STATUS_TEXT[status]}
            </Text>
            {resultUrl ? (
              <VideoPlayer src={resultUrl} />
            ) : (
              <View className="h-[210px] flex items-center justify-center bg-black rounded-md">
                <Text className="text-sm text-muted-foreground">{STATUS_TEXT[status]}</Text>
              </View>
            )}
          </View>
        ) : null}

        {status === 'failed' ? (
          <View className="mx-3 mt-2">
            <ErrorView title="生成失败" desc={errorMsg} onRetry={onGenerate} />
          </View>
        ) : null}

        <View className="mx-3 mt-3 mb-6 bg-card rounded-lg p-3">
          <Text className="block text-sm font-medium text-foreground mb-2">历史记录</Text>
          {history.length ? (
            history.map((h) => (
              <View
                key={h.id}
                className="flex items-center py-2 border-b border-border last:border-b-0"
                onClick={() => replayHistory(h)}
              >
                <Text className="flex-1 text-xs text-foreground truncate">{h.prompt}</Text>
                <Text className="text-[10px] text-muted-foreground ml-2">
                  {VENDORS.find((v) => v.key === h.vendor)?.name} · {fmtTime(h.createdAt)}
                </Text>
              </View>
            ))
          ) : (
            <EmptyState text="暂无历史记录" />
          )}
        </View>
      </ScrollView>
    </View>
  )
}
