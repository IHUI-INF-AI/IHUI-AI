import { logger } from '@/utils/logger'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { clearCacheSize, clearCache } from '@/api'
import { useI18n } from '@/i18n'
import './cache.css'

export default function CachePage() {
  const { t } = useI18n()
  const [size, setSize] = useState('0KB')

  const load = useCallback(async () => {
    try {
      setSize((await clearCacheSize()).size)
    } catch (e) {
      logger.error('setting/cache', '获取缓存大小', e)
      Taro.showToast({ title: t('setting.cache.failed'), icon: 'none' })
    }
  }, [t])

  const onClear = useCallback(async () => {
    try {
      await clearCache()
      Taro.showToast({ title: t('setting.cache.cleared'), icon: 'success' })
      load()
    } catch (e) {
      logger.error('setting/cache', '清理缓存', e)
      Taro.showToast({ title: t('setting.cache.failed'), icon: 'none' })
    }
  }, [load, t])

  const onClearAll = useCallback(() => {
    onClear()
  }, [onClear])

  useDidShow(() => load())

  return (
    <View className="page">
      <View className="card">
        <View className="row" onClick={onClear}>
          <Text className="label">{t('setting.cache.current')}</Text>
          <Text className="value">{size}</Text>
        </View>
        <View className="row" onClick={onClear}>
          <Text className="label">{t('setting.cache.clearImage')}</Text>
          <Text className="arrow">›</Text>
        </View>
        <View className="row" onClick={onClear}>
          <Text className="label">{t('setting.cache.clearFile')}</Text>
          <Text className="arrow">›</Text>
        </View>
      </View>

      <Button className="btn" onClick={onClearAll}>
        {t('setting.cache.clearAll')}
      </Button>

      <View className="tips">
        <Text>{t('setting.cache.tip1')}</Text>
        <Text>{t('setting.cache.tip2')}</Text>
      </View>
    </View>
  )
}
