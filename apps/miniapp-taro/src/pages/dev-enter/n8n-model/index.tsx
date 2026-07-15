import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

export default function N8nModel() {
  const { t } = useI18n()
  const [list, setList] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = (await api.getN8nWorkflows()) as Record<string, unknown>
      setList((res?.list as Record<string, unknown>[]) || [])
    } catch (e) {
      logger.error('unknown', '加载N8N智能体', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    loadData()
  })

  const onItemClick = useCallback((id: string) => {
    Taro.navigateTo({ url: `/pages/ai-assistant-n8n/index?id=${id}` })
  }, [])

  return (
    <View className="page-container">
      <View className="page-header">
        <Text className="page-title">{t('devEnter.n8nModel.title')}</Text>
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
              <Text>
                {(item.name as string) ||
                  (item.title as string) ||
                  t('devEnter.n8nModel.defaultName')}
              </Text>
            </View>
          ))
        ) : (
          <Text className="empty">{t('devEnter.n8nModel.empty')}</Text>
        )}
      </View>
    </View>
  )
}
