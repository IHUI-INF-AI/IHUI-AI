import { View, Text } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getDeveloperIncome } from '@/api'
import './income.css'

export default function DeveloperIncome() {
  const [info, setInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res: any = await getDeveloperIncome()
      setInfo(res)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(load)

  return (
    <View className="income-page">
      <View className="page-header">
        <Text className="page-title">开发者收入</Text>
      </View>
      <View className="summary-card">
        <View className="summary-item">
          <Text className="summary-label">总收入</Text>
          <Text className="summary-value">¥{loading ? '--' : (info?.total ?? 0)}</Text>
        </View>
        <View className="summary-item">
          <Text className="summary-label">可提现</Text>
          <Text className="summary-value">¥{loading ? '--' : (info?.available ?? 0)}</Text>
        </View>
        <View className="summary-item">
          <Text className="summary-label">已提现</Text>
          <Text className="summary-value">¥{loading ? '--' : (info?.withdrawn ?? 0)}</Text>
        </View>
      </View>
      {info?.list?.length ? (
        <View className="record-section">
          <Text className="section-title">收入明细</Text>
          {info.list.map((r: any) => (
            <View key={r.id} className="record-item">
              <View className="record-info">
                <Text className="record-title">{r.title || '收入'}</Text>
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
