import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

export default function DistributionPlan() {
  const { t } = useI18n()
  const [info, setInfo] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = (await api.getDistributionInfo()) as unknown as Record<string, unknown>
      setInfo(res)
    } catch (e) {
      logger.error('unknown', '加载分佣计划', e)
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
        <Text className="page-title">{t('distribution.plan.title')}</Text>
      </View>
      <View className="page-content">
        {loading ? (
          <Text>{t('distribution.plan.loading')}</Text>
        ) : info ? (
          <View className="info-card">
            <View className="info-row">
              <Text className="info-label">{t('distribution.plan.level')}</Text>
              <Text className="info-value">{(info.level as string) ?? '-'}</Text>
            </View>
            <View className="info-row">
              <Text className="info-label">{t('distribution.plan.totalCommission')}</Text>
              <Text className="info-value">{(info.totalCommission as number) ?? 0}</Text>
            </View>
            <View className="info-row">
              <Text className="info-label">{t('distribution.plan.available')}</Text>
              <Text className="info-value">{(info.available as number) ?? 0}</Text>
            </View>
            <View className="info-row">
              <Text className="info-label">{t('distribution.plan.withdrawn')}</Text>
              <Text className="info-value">{(info.withdrawn as number) ?? 0}</Text>
            </View>
            <View className="info-row">
              <Text className="info-label">{t('distribution.plan.teamCount')}</Text>
              <Text className="info-value">{(info.teamCount as number) ?? 0}</Text>
            </View>
          </View>
        ) : (
          <Text className="empty">{t('distribution.plan.empty')}</Text>
        )}
      </View>
    </View>
  )
}
