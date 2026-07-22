import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getProtocol } from '@/api'
import { useI18n } from '@/i18n'

export default function ProtocolPage() {
  const { t } = useI18n()
  const [content, setContent] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await getProtocol()
      setContent(res.content)
    } catch (e) {
      logger.error('about/protocol', '获取协议内容', e)
      Taro.showToast({ title: t('aboutProtocol.loadFailed'), icon: 'none' })
    }
  }, [t])

  useDidShow(() => {
    load()
  })

  return (
    <View className="min-h-screen bg-card p-[16px]">
      <Text className="text-[14px] text-foreground leading-[24px]">{content}</Text>
    </View>
  )
}
