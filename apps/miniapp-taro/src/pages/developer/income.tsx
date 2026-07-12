import { View, Text } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getDeveloperIncome } from '@/api'
import './income.css'

export default function DeveloperIncome() {
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
        <Text className="page-title">开发者收入</Text>
      </View>
      <View className="summary-card">
        <View className="summary-item">
          <Text className="summary-label">总收入</Text>
          <Text className="summary-value">¥{loading ? '--' : ((info?.total as number) ?? 0)}</Text>
        </View>
        <View className="summary-item">
          <Text className="summary-label">可提现</Text>
          <Text className="summary-value">
            ¥{loading ? '--' : ((info?.available as number) ?? 0)}
          </Text>
        </View>
        <View className="summary-item">
          <Text className="summary-label">已提现</Text>
          <Text className="summary-value">
            ¥{loading ? '--' : ((info?.withdrawn as number) ?? 0)}
          </Text>
        </View>
      </View>
      {list.length ? (
        <View className="record-section">
          <Text className="section-title">收入明细</Text>
          {list.map((r) => (
            <View key={r.id as string} className="record-item">
              <View className="record-info">
                <Text className="record-title">{(r.title as string) || '收入'}</Text>
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
