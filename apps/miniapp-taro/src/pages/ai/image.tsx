import { logger } from '@/utils/logger'
import { View, Text, Textarea, Button, Image } from '@tarojs/components'
import Taro, { useDidShow, useRouter, useShareAppMessage } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { generateImage } from '@/api'
import { useI18n } from '@/i18n'
import EmptyState from '@/components/EmptyState'
import './image.css'

interface HistoryItem {
  id: string
  prompt: string
  url: string
  size: string
  style: string
  createdAt: number
}

const STORAGE_KEY = 'ihui_image_history'
const FAVORITE_KEY = 'ihui_image_favorites'

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
    Taro.setStorageSync(STORAGE_KEY, items.slice(0, 12))
  } catch {
    // ignore
  }
}

function loadFavorites(): Set<string> {
  try {
    const raw = Taro.getStorageSync(FAVORITE_KEY)
    return Array.isArray(raw) ? new Set(raw as string[]) : new Set()
  } catch {
    return new Set()
  }
}

function saveFavorites(set: Set<string>): void {
  try {
    Taro.setStorageSync(FAVORITE_KEY, Array.from(set).slice(0, 50))
  } catch {
    // ignore
  }
}

const fmtTime = (ts: number) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(ts)

export default function ImagePage() {
  const { t, tList } = useI18n()
  const router = useRouter()
  const sizes = [
    { value: '512x512', label: '512' },
    { value: '1024x1024', label: '1024' },
    { value: '1024x1792', label: t('ai.image.vertical') },
  ]
  const examples = tList('ai.image.examples')
  const styles = tList('ai.image.styles')
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState('1024x1024')
  const [style, setStyle] = useState(styles[0] || '')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [favorites, setFavorites] = useState<Set<string>>(new Set())

  useDidShow(() => {
    setHistory(loadHistory())
    setFavorites(loadFavorites())
    const incoming = router.params.prompt
    if (incoming) setPrompt(decodeURIComponent(incoming))
  })

  useShareAppMessage(() => ({
    title: t('ai.image.title'),
    path: '/pages/ai/image',
  }))

  const onGenerate = useCallback(async () => {
    if (!prompt || loading) return
    setLoading(true)
    try {
      const res = await generateImage({ prompt, size })
      setResult(res.url)
      const item: HistoryItem = {
        id: `${Date.now()}`,
        prompt,
        url: res.url,
        size,
        style,
        createdAt: Date.now(),
      }
      const next = [item, ...loadHistory()].slice(0, 12)
      setHistory(next)
      saveHistory(next)
    } catch (e) {
      logger.error('ai/image', '生成图片', e)
      Taro.showToast({ title: t('ai.image.generateFailed'), icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [prompt, size, style, loading, t])

  const onDownload = useCallback(async () => {
    if (!result) return
    try {
      const res = await Taro.downloadFile({ url: result })
      await Taro.saveImageToPhotosAlbum({ filePath: res.tempFilePath })
      Taro.showToast({ title: t('ai.image.downloadSuccess'), icon: 'success' })
    } catch (e) {
      logger.error('ai/image', '下载图片', e)
      Taro.showToast({ title: t('ai.image.downloadFailed'), icon: 'none' })
    }
  }, [result, t])

  const onToggleFavorite = useCallback(() => {
    if (!result) return
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(result)) {
        next.delete(result)
        Taro.showToast({ title: t('ai.image.favoriteRemoved'), icon: 'none' })
      } else {
        next.add(result)
        Taro.showToast({ title: t('ai.image.favoriteAdded'), icon: 'success' })
      }
      saveFavorites(next)
      return next
    })
  }, [result, t])

  const replayHistory = useCallback((item: HistoryItem) => {
    setPrompt(item.prompt)
    setSize(item.size)
    setStyle(item.style)
    setResult(item.url)
  }, [])

  const isFavorited = !!result && favorites.has(result)

  return (
    <View className="page">
      {result ? (
        <View className="canvas">
          <Image className="result-img" src={result} mode="aspectFit" />
        </View>
      ) : (
        <View className="empty">
          <Text className="empty-icon">🎨</Text>
          <Text className="empty-text">{t('ai.image.emptyHint')}</Text>
        </View>
      )}
      {result ? (
        <View className="flex gap-2 px-4 pb-2">
          <Button className="flex-1 text-sm rounded-md !bg-muted !text-foreground" onClick={onDownload}>
            {t('ai.image.download')}
          </Button>
          <Button
            className="flex-1 text-sm rounded-md !bg-muted !text-foreground"
            openType="share"
          >
            {t('ai.image.share')}
          </Button>
          <Button
            className={`flex-1 text-sm rounded-md ${
              isFavorited ? '!bg-primary !text-white' : '!bg-muted !text-foreground'
            }`}
            onClick={onToggleFavorite}
          >
            {isFavorited ? t('ai.image.favorited') : t('ai.image.favorite')}
          </Button>
        </View>
      ) : null}
      {!result ? (
        <View className="examples">
          <Text className="ex-title">{t('ai.image.tryThese')}</Text>
          <View className="ex-list">
            {examples.map((ex) => (
              <Text key={ex} className="ex-item" onClick={() => setPrompt(ex)}>
                {ex}
              </Text>
            ))}
          </View>
        </View>
      ) : null}
      <View className="form">
        <Textarea
          className="input"
          value={prompt}
          placeholder={t('ai.image.placeholder')}
          maxlength={500}
          onInput={(e) => setPrompt(e.detail.value)}
        />
        <View className="form-row">
          <View className="size-selector">
            {sizes.map((s) => (
              <Text
                key={s.value}
                className={`size${size === s.value ? ' active' : ''}`}
                onClick={() => setSize(s.value)}
              >
                {s.label}
              </Text>
            ))}
          </View>
        </View>
        {styles.length ? (
          <View className="flex gap-2 mt-2 flex-wrap">
            {styles.map((s) => (
              <Text
                key={s}
                className={`px-3 py-1 text-xs rounded-md ${
                  style === s ? 'bg-primary text-white' : 'bg-muted text-foreground'
                }`}
                onClick={() => setStyle(s)}
              >
                {s}
              </Text>
            ))}
          </View>
        ) : null}
        <Button className="btn mt-3 w-full" onClick={onGenerate} disabled={!prompt || loading}>
          {loading ? t('ai.image.generating') : t('ai.image.generate')}
        </Button>
      </View>

      <View className="mx-3 mt-3 mb-6 bg-card rounded-lg p-3">
        <Text className="block text-sm font-medium text-foreground mb-2">
          {t('ai.image.history')}
        </Text>
        {history.length ? (
          <View className="flex flex-col gap-2">
            {history.map((h) => (
              <View
                key={h.id}
                className="flex items-center py-2 bg-background rounded-md px-2"
                onClick={() => replayHistory(h)}
              >
                <Image
                  className="w-10 h-10 rounded-md mr-2"
                  src={h.url}
                  mode="aspectFill"
                />
                <Text className="flex-1 text-xs text-foreground truncate">{h.prompt}</Text>
                <Text className="text-[10px] text-muted-foreground ml-2">{fmtTime(h.createdAt)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState text={t('ai.image.empty')} />
        )}
      </View>
    </View>
  )
}
