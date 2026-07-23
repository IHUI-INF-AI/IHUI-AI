import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import type { StudyRecord } from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

export default function MyStudy() {
  const { t } = useI18n()
  const [list, setList] = useState<StudyRecord[]>([])
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getStudyRecords({ page: 1, pageSize: 20 })
      setList(res?.list || [])
    } catch (e) {
      logger.error('unknown', '加载我的课程', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    loadData()
  })

  const onItemClick = useCallback((id: string) => {
    Taro.navigateTo({ url: `/pages/study/record?id=${id}` })
  }, [])

  return (
    <View className="page-container">
      <View className="page-header">
        <Text className="page-title">{t('study.myStudy.title')}</Text>
      </View>
      <View className="page-content">
        {loading ? (
          <Text>{t('common.loading')}</Text>
        ) : list.length ? (
          list.map((item) => (
            <View
              key={item.id}
              className="list-item"
              onClick={() => onItemClick(item.courseId || item.id)}
            >
              <Text>{item.courseTitle || t('study.myStudy.courseFallback')}</Text>
            </View>
          ))
        ) : (
          <Text className="empty">{t('study.myStudy.empty')}</Text>
        )}
      </View>
    </View>
  )
}
