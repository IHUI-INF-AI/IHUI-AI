import { View, Text } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getTokenBalance, getTokenRecords } from '@/api'
import './balance.css'

export default function TokenBalance() {
  const [balance, setBalance] = useState<any>(null)
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [bal, rec]: any = await Promise.all([getTokenBalance(), getTokenRecords(1)])
      setBalance(bal)
      setRecords(rec?.list || [])
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
          {loading ? '--' : (balance?.amount ?? balance?.balance ?? 0)}
        </Text>
      </View>
      <View className="records-section">
        <Text className="section-title">变动记录</Text>
        <View className="record-list">
          {loading ? (
            <Text className="loading-text">加载中...</Text>
          ) : records.length ? (
            records.map((r: any) => (
              <View key={r.id} className="record-item">
                <View className="record-info">
                  <Text className="record-title">{r.title || r.type || '变动'}</Text>
                  <Text className="record-time">{r.time || ''}</Text>
                </View>
                <Text className={`record-amount ${r.amount >= 0 ? 'plus' : 'minus'}`}>
                  {r.amount >= 0 ? '+' : ''}
                  {r.amount}
                </Text>
              </View>
            ))
          ) : (
            <Text className="empty-text">暂无记录</Text>
          )}
        </View>
      </View>
    </View>
  )
}
