// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { clearCache } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

const KEEP_KEYS = ['ihui_token', 'ihui_refresh_token', 'ihui_user_info', 'lang', 'theme']
const IMAGE_KEYS = ['ihui_image_history', 'ihui_image_favorites']
const FILE_KEYS = ['ihui_video_history', 'ihui_sso_code']

function formatSize(kb: number): string {
  if (kb < 1024) return `${kb}KB`
  return `${(kb / 1024).toFixed(2)}MB`
}

function getLocalSize(): { current: number; limit: number } {
  try {
    const info = Taro.getStorageInfoSync()
    return {
      current: info.currentSize || 0,
      limit: info.limitSize || 0,
    }
  } catch {
    return { current: 0, limit: 0 }
  }
}

function getKeysByPattern(patterns: string[]): string[] {
  try {
    const info = Taro.getStorageInfoSync()
    return info.keys.filter((k) => patterns.some((p) => k === p || k.startsWith(p)))
  } catch {
    return []
  }
}

function getAllClearableKeys(): string[] {
  try {
    const info = Taro.getStorageInfoSync()
    return info.keys.filter((k) => !KEEP_KEYS.includes(k))
  } catch {
    return []
  }
}

type ClearType = 'image' | 'file' | 'all'

export default function CachePage() {
  const { t } = useI18n()
  const [size, setSize] = useState('0KB')
  const [clearing, setClearing] = useState(false)
  const [progress, setProgress] = useState(0)
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )

  const loadSize = useCallback(() => {
    const { current } = getLocalSize()
    setSize(formatSize(current))
  }, [])

  const doClear = useCallback(
    async (type: ClearType) => {
      if (clearing) return
      setClearing(true)
      setProgress(0)
      try {
        let keys: string[] = []
        if (type === 'image') keys = getKeysByPattern(IMAGE_KEYS)
        else if (type === 'file') keys = getKeysByPattern(FILE_KEYS)
        else keys = getAllClearableKeys()

        if (keys.length === 0) {
          setProgress(100)
          Taro.showToast({
            title: tt('setting.cache.alreadyClean', '已是最新状态'),
            icon: 'none',
          })
        } else {
          for (let i = 0; i < keys.length; i++) {
            const key = keys[i]
            if (key) {
              try {
                Taro.removeStorageSync(key)
              } catch {
                // ignore single key failure
              }
            }
            setProgress(Math.round(((i + 1) / keys.length) * 100))
            await new Promise((resolve) => setTimeout(resolve, 10))
          }
          if (type === 'all') {
            try {
              await clearCache()
            } catch {
              // 后端清理失败不阻塞本地结果
            }
          }
          Taro.showToast({
            title: tt('setting.cache.cleared', '缓存已清除'),
            icon: 'success',
          })
        }
        loadSize()
      } catch (e) {
        logger.error('setting/cache', '清理缓存', e)
        Taro.showToast({ title: tt('setting.cache.failed', '清除失败'), icon: 'none' })
      } finally {
        setClearing(false)
        setProgress(0)
      }
    },
    [clearing, tt, loadSize],
  )

  const onClearImage = useCallback(() => doClear('image'), [doClear])
  const onClearFile = useCallback(() => doClear('file'), [doClear])
  const onClearAll = useCallback(() => doClear('all'), [doClear])

  useDidShow(() => loadSize())

  return (
    <ThemeRoot>
      {/* 根容器背景对齐 RN SettingsScreen container(pageBg=surface.bg → --color-background);
          上下留白对齐 body paddingTop 12dp→24rpx / paddingBottom 24dp→48rpx */}
      <View className="min-h-screen bg-background pt-[24rpx] pb-[48rpx]">
        {/* 当前缓存卡片对齐 RN sectionCard(圆角 8dp→16rpx + divider 底 + 行间 2rpx)
            + plainRow(minHeight 60dp→120rpx / py 14dp→28rpx / px 12dp→24rpx) */}
        <View className="mx-[20rpx] flex flex-col gap-[2rpx] overflow-hidden rounded-[16rpx] bg-[color:var(--color-border)]">
          <View className="flex min-h-[120rpx] items-center justify-between bg-card px-[24rpx] py-[28rpx] dark:bg-muted">
            {/* rowLabel 对齐 RN: 16dp→32rpx + text.medium 语义映射 muted-foreground */}
            <Text className="text-[32rpx] text-muted-foreground">{t('setting.cache.current')}</Text>
            <Text className="text-[32rpx] text-foreground">{size}</Text>
          </View>
        </View>

        {clearing ? (
          <View className="mx-[20rpx] mt-[32rpx] rounded-[16rpx] bg-card p-[24rpx] dark:bg-muted">
            <View className="h-[12rpx] w-full overflow-hidden rounded-[6rpx] bg-border">
              <View
                className="h-full bg-primary transition-[width] duration-100"
                style={{ width: `${progress}%` }}
              />
            </View>
            <Text className="mt-[16rpx] block text-center text-[24rpx] text-muted-foreground">
              {tt('setting.cache.clearing', '清理中')} {progress}%
            </Text>
          </View>
        ) : null}

        <View className="mx-[20rpx] mt-[32rpx] flex flex-col gap-[2rpx] overflow-hidden rounded-[16rpx] bg-[color:var(--color-border)]">
          <View
            className="flex min-h-[120rpx] items-center justify-between bg-card px-[24rpx] py-[28rpx] dark:bg-muted"
            onClick={onClearImage}
            hoverClass="opacity-60">
            <Text className="text-[32rpx] text-muted-foreground">{t('setting.cache.clearImage')}</Text>
            {/* arrow 对齐 RN: 20dp→40rpx + text.tertiary */}
            <Text className="text-[40rpx] text-[color:var(--color-text-tertiary)]">›</Text>
          </View>
          <View
            className="flex min-h-[120rpx] items-center justify-between bg-card px-[24rpx] py-[28rpx] dark:bg-muted"
            onClick={onClearFile}
            hoverClass="opacity-60">
            <Text className="text-[32rpx] text-muted-foreground">{t('setting.cache.clearFile')}</Text>
            <Text className="text-[40rpx] text-[color:var(--color-text-tertiary)]">›</Text>
          </View>
        </View>

        {/* 清空按钮对齐 RN NotificationSettingsScreen saveBtn: 高 50dp→100rpx + 圆角 12dp→24rpx
            + brand(--color-primary)底;文字 16dp→32rpx semibold;
            文字色用 --color-primary-foreground 修正 RN surface.light 在暗色 brand 白底下不可读 */}
        <Button
          className="mx-[20rpx] mt-[32rpx] flex h-[100rpx] items-center justify-center rounded-[24rpx] bg-primary text-[32rpx] font-semibold disabled:opacity-60"
          style={{ color: 'var(--color-primary-foreground)' }}
          onClick={onClearAll}
          disabled={clearing}
          loading={clearing}
        >
          {t('setting.cache.clearAll')}
        </Button>

        {/* 提示文字对齐 RN versionText: 12dp→24rpx + text.tertiary + 居中;marginTop 4dp→8rpx */}
        <View className="mx-[20rpx] mt-[32rpx]">
          <Text className="block text-center text-[24rpx] leading-[1.8] text-[color:var(--color-text-tertiary)]">
            {t('setting.cache.tip1')}
          </Text>
          <Text className="mt-[8rpx] block text-center text-[24rpx] leading-[1.8] text-[color:var(--color-text-tertiary)]">
            {t('setting.cache.tip2')}
          </Text>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
