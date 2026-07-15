import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

export default function LearnDevelop() {
  const { t } = useI18n()
  const [list, setList] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = (await api.getCourseList({ page: 1, pageSize: 20 })) as Record<string, unknown>
      setList((res?.list as Record<string, unknown>[]) || [])
    } catch (e) {
      logger.error('unknown', '加载课程', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    loadData()
  })

  const onItemClick = useCallback((id: string) => {
    Taro.navigateTo({ url: `/pages/course/detail?id=${id}` })
  }, [])

  return (
    <View className="page-container">
      <View className="page-header">
        <Text className="page-title">{t('learnDevelop.title')}</Text>
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
              <Text>{(item.title as string) || t('learnDevelop.course')}</Text>
            </View>
          ))
        ) : (
          <Text className="empty">{t('learnDevelop.empty')}</Text>
        )}
      </View>
    </View>
  )
}
