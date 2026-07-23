import { logger } from '@/utils/logger'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { clearCache } from '@/api'
import { useI18n } from '@/i18n'
import './cache.css'

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
    <View className="page">
      <View className="card">
        <View className="row last">
          <Text className="label">{t('setting.cache.current')}</Text>
          <Text className="value">{size}</Text>
        </View>
      </View>

      {clearing ? (
        <View className="progress-card">
          <View className="progress-bar">
            <View className="progress-fill" style={{ width: `${progress}%` }} />
          </View>
          <Text className="progress-text">
            {tt('setting.cache.clearing', '清理中')} {progress}%
          </Text>
        </View>
      ) : null}

      <View className="card">
        <View className="row" onClick={onClearImage}>
          <Text className="label">{t('setting.cache.clearImage')}</Text>
          <Text className="arrow">›</Text>
        </View>
        <View className="row" onClick={onClearFile}>
          <Text className="label">{t('setting.cache.clearFile')}</Text>
          <Text className="arrow">›</Text>
        </View>
      </View>

      <Button
        className="btn"
        onClick={onClearAll}
        disabled={clearing}
        loading={clearing}
      >
        {t('setting.cache.clearAll')}
      </Button>

      <View className="tips">
        <Text>{t('setting.cache.tip1')}</Text>
        <Text>{t('setting.cache.tip2')}</Text>
      </View>
    </View>
  )
}
