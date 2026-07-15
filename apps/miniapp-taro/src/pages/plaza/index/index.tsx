import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

export default function PlazaIndex() {
  const { t } = useI18n()
  const [list, setList] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = (await api.getModelPlazaList()) as
        Record<string, unknown> | Record<string, unknown>[]
      setList(
        Array.isArray(res)
          ? res
          : ((res as Record<string, unknown>)?.list as Record<string, unknown>[]) || [],
      )
    } catch (e) {
      logger.error('unknown', '加载广场数据', e)
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
        <Text className="page-title">{t('plaza.index.title')}</Text>
      </View>
      <View className="page-content">
        {loading ? (
          <Text>{t('common.loading')}</Text>
        ) : list.length ? (
          list.map((item) => (
            <View key={(item.id as string) || (item.name as string)} className="list-item">
              <Text>
                {(item.name as string) || (item.title as string) || t('plaza.index.model')}
              </Text>
            </View>
          ))
        ) : (
          <Text className="empty">{t('plaza.index.empty')}</Text>
        )}
      </View>
    </View>
  )
}
