import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { createSrsStream, updateSrsStream, type SrsStream } from '@/api'
import { useI18n } from '@/i18n'

type StreamStatus = 'idle' | 'active' | 'inactive'

interface Product {
  id: string
  name: string
  price: number
}

const MOCK_PRODUCTS: Product[] = [
  { id: '1', name: 'AI 课程包', price: 199 },
  { id: '2', name: '会员年卡', price: 365 },
  { id: '3', name: '实体周边', price: 89 },
]

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

function formatBytes(n: number | null): string {
  if (!n || n <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1)
  return `${(n / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

export default function LiveHost() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const [streamTitle, setStreamTitle] = useState('')
  const [status, setStatus] = useState<StreamStatus>('idle')
  const [stream, setStream] = useState<SrsStream | null>(null)
  const [duration, setDuration] = useState(0)
  const [viewers, setViewers] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status !== 'active') return
    const timer = setInterval(() => {
      setDuration((d) => d + 1)
      setViewers((v) => v + Math.floor(Math.random() * 5))
    }, 1000)
    return () => clearInterval(timer)
  }, [status])

  const startLive = useCallback(async () => {
    if (status !== 'idle' || loading) return
    const title = streamTitle.trim()
    if (!title) {
      Taro.showToast({ title: tt('liveHost.titleRequired', '请输入直播标题'), icon: 'none' })
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await createSrsStream({ title })
      setStream(data)
      setStatus('active')
      setDuration(0)
      setViewers(Math.floor(Math.random() * 20) + 5)
    } catch (e) {
      const msg = e instanceof Error ? e.message : tt('liveHost.startFailed', '开启直播失败')
      setError(msg)
      Taro.showToast({ title: msg, icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [status, loading, streamTitle, tt])

  const endLive = useCallback(async () => {
    if (status !== 'active' || loading || !stream) return
    setLoading(true)
    setError('')
    try {
      await updateSrsStream(stream.id, { status: 'inactive' })
      setStatus('inactive')
      Taro.showModal({
        title: tt('liveHost.endLiveAlert', '直播已结束'),
        content: `${tt('liveHost.endLiveDurationPrefix', '本次直播时长:')}${formatDuration(duration)}`,
        showCancel: false,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : tt('liveHost.endFailed', '结束直播失败')
      setError(msg)
      Taro.showToast({ title: msg, icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [status, loading, stream, duration, tt])

  const copyText = useCallback(
    (text: string) => {
      if (!text) return
      Taro.setClipboardData({ data: text })
      Taro.showToast({ title: tt('liveHost.copySuccess', '已复制到剪贴板'), icon: 'success' })
    },
    [tt],
  )

  const badgeCls = status === 'active' ? 'bg-emerald-500' : 'bg-neutral-400'
  const badgeText =
    status === 'active'
      ? tt('liveHost.statusActive', '直播中')
      : status === 'inactive'
        ? tt('liveHost.statusInactive', '已结束')
        : tt('liveHost.statusIdle', '未开始')

  const stats: { label: string; value: string; valueCls?: string }[] = [
    { label: tt('liveHost.duration', '直播时长'), value: formatDuration(duration) },
    {
      label: tt('liveHost.viewers', '观众数'),
      value: String(viewers),
      valueCls: 'text-emerald-600',
    },
    { label: tt('liveHost.recvBytes', '收到字节'), value: formatBytes(stream?.recvBytes ?? null) },
    { label: tt('liveHost.sendBytes', '发送字节'), value: formatBytes(stream?.sendBytes ?? null) },
  ]

  return (
    <View className="min-h-screen p-3">
      <View className="flex items-center justify-end mb-2">
        <View className={`px-2 py-0.5 rounded-md ${badgeCls}`}>
          <Text className="text-xs text-white">{badgeText}</Text>
        </View>
      </View>

      {error ? (
        <View className="mb-2">
          <Text className="text-xs text-red-600">{error}</Text>
        </View>
      ) : null}

      <View className="h-44 rounded-xl bg-neutral-900 flex items-center justify-center mb-3">
        <Text className="text-sm text-neutral-400">
          {status === 'active'
            ? tt('liveHost.cameraPreviewActive', '直播推流中')
            : tt('liveHost.cameraPreview', '摄像头预览')}
        </Text>
      </View>

      <View className="p-3 rounded-xl border border-border mb-3">
        <Text className="text-xs text-muted-foreground mb-1">
          {tt('liveHost.streamTitle', '直播标题')}
        </Text>
        <Input
          className="rounded-lg border border-border px-3 py-2 text-sm text-foreground"
          value={streamTitle}
          onInput={(e) => setStreamTitle(e.detail.value)}
          placeholder={tt('liveHost.streamTitlePlaceholder', '请输入直播标题')}
          disabled={status !== 'idle'}
        />
        {stream ? (
          <View className="mt-2">
            <View onClick={() => stream.pushUrl && copyText(stream.pushUrl)}>
              <Text className="text-xs text-muted-foreground">
                {tt('liveHost.pushUrl', '推流地址')}:{stream.pushUrl || '—'}
              </Text>
            </View>
            <View className="mt-1" onClick={() => copyText(stream.streamKey)}>
              <Text className="text-xs text-muted-foreground">
                {tt('liveHost.streamKey', '流密钥')}:{stream.streamKey}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <View className="flex gap-3 mb-3">
        <View
          className={`flex-1 rounded-lg py-3 items-center ${status === 'idle' ? 'bg-emerald-500' : 'bg-muted'}`}
          onClick={startLive}
        >
          <Text className="text-sm font-semibold text-white">
            {loading && status === 'idle'
              ? tt('liveHost.starting', '开启中...')
              : tt('liveHost.startLive', '开始直播')}
          </Text>
        </View>
        <View
          className={`flex-1 rounded-lg py-3 items-center ${status === 'active' ? 'bg-red-500' : 'bg-muted'}`}
          onClick={endLive}
        >
          <Text className="text-sm font-semibold text-white">
            {loading && status === 'active'
              ? tt('liveHost.ending', '结束中...')
              : tt('liveHost.endLive', '结束直播')}
          </Text>
        </View>
      </View>

      <View className="p-3 rounded-xl border border-border mb-3">
        <Text className="text-sm font-semibold text-foreground mb-2">
          {tt('liveHost.liveData', '直播数据')}
        </Text>
        <View className="flex flex-wrap">
          {stats.map((s) => (
            <View key={s.label} className="w-1/2 mb-2">
              <Text className="text-xs text-muted-foreground">{s.label}</Text>
              <Text className={`text-sm font-semibold text-foreground ${s.valueCls || ''}`}>
                {s.value}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View className="p-3 rounded-xl border border-border mb-8">
        <View className="flex items-center justify-between mb-2">
          <Text className="text-sm font-semibold text-foreground">
            {tt('liveHost.productManagement', '商品管理')}
          </Text>
          <View
            className="rounded-lg bg-muted px-2 py-1"
            onClick={() =>
              Taro.showToast({
                title: tt('liveHost.addProductToast', '商品添加功能待接入'),
                icon: 'none',
              })
            }
          >
            <Text className="text-xs text-emerald-600">
              {tt('liveHost.addProduct', '+ 添加商品')}
            </Text>
          </View>
        </View>
        {MOCK_PRODUCTS.length === 0 ? (
          <Text className="text-xs text-muted-foreground py-2 text-center">暂无商品</Text>
        ) : (
          MOCK_PRODUCTS.map((item) => (
            <View key={item.id} className="flex items-center justify-between py-2">
              <Text className="flex-1 text-sm text-foreground">{item.name}</Text>
              <Text className="text-sm font-semibold text-red-500">¥{item.price}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  )
}
