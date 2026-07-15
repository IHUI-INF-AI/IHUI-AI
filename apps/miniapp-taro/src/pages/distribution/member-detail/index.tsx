import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

export default function MemberDetail() {
  const { t } = useI18n()
  const [list, setList] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = (await api.getSubordinates()) as Record<string, unknown>
      setList((res?.list as Record<string, unknown>[]) || [])
    } catch (e) {
      logger.error('unknown', '加载团队成员', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    loadData()
  })

  return (
    <View className="page-container">
      <View className="page-header">
        <Text className="page-title">{t('distribution.memberDetail.title')}</Text>
      </View>
      <View className="page-content">
        {loading ? (
          <Text>{t('distribution.memberDetail.loading')}</Text>
        ) : list.length ? (
          list.map((item) => (
            <View key={item.id as string} className="list-item">
              <Text>{(item.nickname as string) || t('distribution.memberDetail.member')}</Text>
            </View>
          ))
        ) : (
          <Text className="empty">{t('distribution.memberDetail.empty')}</Text>
        )}
      </View>
    </View>
  )
}
