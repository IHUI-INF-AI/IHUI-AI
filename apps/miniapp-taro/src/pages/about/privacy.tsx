import { logger } from '@/utils/logger'
import { View, Text, RichText } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getPrivacy } from '@/api'
import { useI18n } from '@/i18n'
import './privacy.css'

export default function PrivacyPage() {
  const { t } = useI18n()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await getPrivacy()
      setContent(res.content)
    } catch (e) {
      logger.error('about/privacy', '获取隐私政策', e)
      Taro.showToast({ title: t('aboutProtocol.loadFailed'), icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [t])

  useDidShow(() => load())

  return (
    <View className="page">
      {loading ? (
        <View className="loading"><Text>{t('common.loading')}</Text></View>
      ) : (
        <View className="content">
          <RichText nodes={content} />
        </View>
      )}
    </View>
  )
}
