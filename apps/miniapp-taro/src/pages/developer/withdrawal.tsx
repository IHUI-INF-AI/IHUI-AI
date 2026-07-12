import { View, Text } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getDeveloperWithdrawalList } from '@/api'
import './withdrawal.css'

export default function DeveloperWithdrawal() {
  const [list, setList] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = (await getDeveloperWithdrawalList()) as Record<string, unknown>
      setList((res?.list as Record<string, unknown>[]) || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(load)

  return (
    <View className="withdrawal-page">
      <View className="page-header">
        <Text className="page-title">提现记录</Text>
      </View>
      <View className="withdrawal-list">
        {loading ? (
          <Text className="loading-text">加载中...</Text>
        ) : list.length ? (
          list.map((item) => (
            <View key={item.id as string} className="withdrawal-item">
              <View className="withdrawal-info">
                <Text className="withdrawal-amount">¥{item.amount as number}</Text>
                <Text className="withdrawal-time">{(item.time as string) || ''}</Text>
              </View>
              <Text className={`withdrawal-status status-${(item.status as string) || 'pending'}`}>
                {(item.statusText as string) || (item.status as string) || '处理中'}
              </Text>
            </View>
          ))
        ) : (
          <Text className="empty-text">暂无提现记录</Text>
        )}
      </View>
    </View>
  )
}
