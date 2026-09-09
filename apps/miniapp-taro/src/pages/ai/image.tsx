// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Textarea, Button, Image } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'
import Taro, { useDidShow, useRouter, useShareAppMessage } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { generateImage } from '@/api'
import EmptyState from '@/components/EmptyState'
import { formatDateByTemplate } from '@ihui/shared'
import ThemeRoot from '@/components/ThemeRoot'

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

const fmtTime = (ts: number) => formatDateByTemplate(ts, 'MM-DD HH:mm')

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
    <ThemeRoot className="min-h-screen bg-[var(--color-screen-canvas)] flex flex-col">
      {result ? (
        <View className="flex-1 flex items-center justify-center p-[32rpx]">
          <Image
            className="max-w-full max-h-[600rpx] rounded-[16rpx]"
            src={result}
            mode="aspectFit"
          />
        </View>
      ) : (
        <View className="flex-1 flex flex-col items-center justify-center">
          <LineIcon name="palette" size={120} color="var(--color-text-tertiary)" />
          <Text className="text-[26rpx] text-muted-foreground mt-[24rpx]">
            {t('ai.image.emptyHint')}
          </Text>
        </View>
      )}
      {result ? (
        <View className="flex gap-[16rpx] px-[32rpx] pb-[16rpx]">
          <Button
            className="flex-1 text-[24rpx] rounded-[12rpx] h-[80rpx] leading-[80rpx] border border-border bg-transparent text-muted-foreground"
            onClick={onDownload}
          >
            {t('ai.image.download')}
          </Button>
          <Button
            className="flex-1 text-[24rpx] rounded-[12rpx] h-[80rpx] leading-[80rpx] border border-border bg-transparent text-muted-foreground"
            openType="share"
          >
            {t('ai.image.share')}
          </Button>
          <Button
            className={`flex-1 text-[24rpx] rounded-[12rpx] h-[80rpx] leading-[80rpx] ${
              isFavorited
                ? 'bg-primary text-[var(--color-surface-light)]'
                : 'border border-border bg-transparent text-muted-foreground'
            }`}
            onClick={onToggleFavorite}
          >
            {isFavorited ? t('ai.image.favorited') : t('ai.image.favorite')}
          </Button>
        </View>
      ) : null}
      {!result ? (
        <View className="px-[32rpx] pb-[24rpx]">
          <Text className="text-[24rpx] text-muted-foreground">{t('ai.image.tryThese')}</Text>
          <View className="flex flex-wrap gap-[16rpx] mt-[16rpx]">
            {examples.map((ex) => (
              <Text
                key={ex}
                className="py-[12rpx] px-[24rpx] bg-muted rounded-[12rpx] text-[24rpx] text-muted-foreground"
                onClick={() => setPrompt(ex)}
              >
                {ex}
              </Text>
            ))}
          </View>
        </View>
      ) : null}
      <View className="py-[24rpx] px-[32rpx]">
        <Textarea
          className="w-full min-h-[192rpx] p-[24rpx] bg-transparent border border-border rounded-[12rpx] text-[24rpx] box-border"
          value={prompt}
          placeholder={t('ai.image.placeholder')}
          maxlength={500}
          onInput={(e) => setPrompt(e.detail.value)}
        />
        <View className="flex items-center mt-[24rpx] gap-[16rpx]">
          <View className="flex gap-[16rpx] flex-1">
            {sizes.map((s) => (
              <Text
                key={s.value}
                className={`py-[12rpx] px-[24rpx] rounded-[12rpx] text-[20rpx] ${
                  size === s.value
                    ? 'bg-[var(--color-brand-orange)] text-[var(--color-surface-light)]'
                    : 'bg-secondary text-muted-foreground'
                }`}
                onClick={() => setSize(s.value)}
              >
                {s.label}
              </Text>
            ))}
          </View>
        </View>
        {styles.length ? (
          <View className="flex gap-[16rpx] mt-[16rpx] flex-wrap">
            {styles.map((s) => (
              <Text
                key={s}
                className={`px-[24rpx] py-[12rpx] text-[20rpx] rounded-[12rpx] ${
                  style === s
                    ? 'bg-[var(--color-brand-orange)] text-[var(--color-surface-light)]'
                    : 'bg-secondary text-muted-foreground'
                }`}
                onClick={() => setStyle(s)}
              >
                {s}
              </Text>
            ))}
          </View>
        ) : null}
        <Button
          className="bg-[var(--color-brand-orange)] text-[var(--color-surface-light)] rounded-[12rpx] text-[20rpx] font-medium mt-[32rpx] w-full h-[88rpx] leading-[88rpx] disabled:opacity-60"
          onClick={onGenerate}
          disabled={!prompt || loading}
        >
          {loading ? t('ai.image.generating') : t('ai.image.generate')}
        </Button>
      </View>

      <View className="mx-[24rpx] mt-[24rpx] mb-[48rpx] bg-card rounded-[16rpx] border border-border p-[24rpx]">
        <Text className="block text-[28rpx] font-medium text-foreground mb-[16rpx]">
          {t('ai.image.history')}
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
                <Image
                  className="w-[80rpx] h-[80rpx] rounded-[12rpx] mr-[16rpx]"
                  src={h.url}
                  mode="aspectFill"
                />
                <Text className="flex-1 text-[24rpx] text-foreground truncate">{h.prompt}</Text>
                <Text className="text-[20rpx] text-[var(--color-text-tertiary)] ml-[16rpx]">
                  {fmtTime(h.createdAt)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState text={t('ai.image.empty')} />
        )}
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
