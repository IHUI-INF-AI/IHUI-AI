import { View, Text } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getDeveloperIncome } from '@/api'
import { useI18n } from '@/i18n'
import './income.css'

// 开发者收入明细项
interface IncomeRecordItem {
  id: string
  title?: string
  time?: string
  amount: number
}

// 开发者收入信息(getDeveloperIncome 后端未类型化,按页面使用字段定义)
interface DeveloperIncomeInfo {
  total?: number
  available?: number
  withdrawn?: number
  list?: IncomeRecordItem[]
}

export default function DeveloperIncome() {
  const { t } = useI18n()
  const [info, setInfo] = useState<DeveloperIncomeInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = (await getDeveloperIncome()) as DeveloperIncomeInfo
      setInfo(res)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(load)

  const list = info?.list || []

  return (
    <View className="income-page">
      <View className="page-header">
        <Text className="page-title">{t('developer.income.title')}</Text>
      </View>
      <View className="summary-card">
        <View className="summary-item">
          <Text className="summary-label">{t('developer.income.total')}</Text>
          <Text className="summary-value">¥{loading ? '--' : (info?.total ?? 0)}</Text>
        </View>
        <View className="summary-item">
          <Text className="summary-label">{t('developer.income.available')}</Text>
          <Text className="summary-value">
            ¥{loading ? '--' : (info?.available ?? 0)}
          </Text>
        </View>
        <View className="summary-item">
          <Text className="summary-label">{t('developer.income.withdrawn')}</Text>
          <Text className="summary-value">
            ¥{loading ? '--' : (info?.withdrawn ?? 0)}
          </Text>
        </View>
      </View>
      {list.length ? (
        <View className="record-section">
          <Text className="section-title">{t('developer.income.details')}</Text>
          {list.map((r) => (
            <View key={r.id} className="record-item">
              <View className="record-info">
                <Text className="record-title">
                  {r.title || t('developer.income.income')}
                </Text>
                <Text className="record-time">{r.time || ''}</Text>
              </View>
              <Text className="record-amount">+¥{r.amount}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}
