import { View, Text } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getTokenBalance, getTokenRecords } from '@/api'
import './balance.css'

export default function TokenBalance() {
  const [balance, setBalance] = useState<Record<string, unknown> | null>(null)
  const [records, setRecords] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const result = (await Promise.all([getTokenBalance(), getTokenRecords(1)])) as [
        Record<string, unknown>,
        Record<string, unknown>,
      ]
      setBalance(result[0])
      setRecords((result[1]?.list as Record<string, unknown>[]) || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(load)

  return (
    <View className="token-page">
      <View className="balance-card">
        <Text className="balance-label">智汇值余额</Text>
        <Text className="balance-value">
          {loading ? '--' : ((balance?.amount as number) ?? (balance?.balance as number) ?? 0)}
        </Text>
      </View>
      <View className="records-section">
        <Text className="section-title">变动记录</Text>
        <View className="record-list">
          {loading ? (
            <Text className="loading-text">加载中...</Text>
          ) : records.length ? (
            records.map((r) => {
              const amount = r.amount as number
              return (
                <View key={r.id as string} className="record-item">
                  <View className="record-info">
                    <Text className="record-title">
                      {(r.title as string) || (r.type as string) || '变动'}
                    </Text>
                    <Text className="record-time">{(r.time as string) || ''}</Text>
                  </View>
                  <Text className={`record-amount ${amount >= 0 ? 'plus' : 'minus'}`}>
                    {amount >= 0 ? '+' : ''}
                    {amount}
                  </Text>
                </View>
              )
            })
          ) : (
            <Text className="empty-text">暂无记录</Text>
          )}
        </View>
      </View>
    </View>
  )
}
