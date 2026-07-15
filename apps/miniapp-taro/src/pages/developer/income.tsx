import { View, Text } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getDeveloperIncome } from '@/api'
import { useI18n } from '@/i18n'
import './income.css'

export default function DeveloperIncome() {
  const { t } = useI18n()
  const [info, setInfo] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = (await getDeveloperIncome()) as Record<string, unknown>
      setInfo(res)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(load)

  const list = (info?.list as Record<string, unknown>[]) || []

  return (
    <View className="income-page">
      <View className="page-header">
        <Text className="page-title">{t('developer.income.title')}</Text>
      </View>
      <View className="summary-card">
        <View className="summary-item">
          <Text className="summary-label">{t('developer.income.total')}</Text>
          <Text className="summary-value">¥{loading ? '--' : ((info?.total as number) ?? 0)}</Text>
        </View>
        <View className="summary-item">
          <Text className="summary-label">{t('developer.income.available')}</Text>
          <Text className="summary-value">
            ¥{loading ? '--' : ((info?.available as number) ?? 0)}
          </Text>
        </View>
        <View className="summary-item">
          <Text className="summary-label">{t('developer.income.withdrawn')}</Text>
          <Text className="summary-value">
            ¥{loading ? '--' : ((info?.withdrawn as number) ?? 0)}
          </Text>
        </View>
      </View>
      {list.length ? (
        <View className="record-section">
          <Text className="section-title">{t('developer.income.details')}</Text>
          {list.map((r) => (
            <View key={r.id as string} className="record-item">
              <View className="record-info">
                <Text className="record-title">
                  {(r.title as string) || t('developer.income.income')}
                </Text>
                <Text className="record-time">{(r.time as string) || ''}</Text>
              </View>
              <Text className="record-amount">+¥{r.amount as number}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}
