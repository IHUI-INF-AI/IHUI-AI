import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

export default function AiChatDetail() {
  const { t } = useI18n()
  const [list, setList] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = (await api.getChatHistory({ page: 1, pageSize: 20 })) as Record<string, unknown>
      setList((res?.list as Record<string, unknown>[]) || [])
    } catch (e) {
      logger.error('unknown', '加载聊天记录', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    loadData()
  })

  const onItemClick = useCallback((id: string) => {
    Taro.navigateTo({ url: `/pages/ai/chat?sessionId=${id}` })
  }, [])

  return (
    <View className="page-container">
      <View className="page-header">
        <Text className="page-title">{t('aiChatDetail.title')}</Text>
      </View>
      <View className="page-content">
        {loading ? (
          <Text>{t('common.loading')}</Text>
        ) : list.length ? (
          list.map((item) => (
            <View
              key={item.id as string}
              className="list-item"
              onClick={() => onItemClick(item.id as string)}
            >
              <Text>{(item.title as string) || t('aiChatDetail.chat')}</Text>
            </View>
          ))
        ) : (
          <Text className="empty">{t('aiChatDetail.empty')}</Text>
        )}
      </View>
    </View>
  )
}
