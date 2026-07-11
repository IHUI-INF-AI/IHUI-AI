import { View, Text } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getDeveloperWithdrawalList } from '@/api'
import './withdrawal.css'

export default function DeveloperWithdrawal() {
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res: any = await getDeveloperWithdrawalList()
      setList(res?.list || [])
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
          list.map((item: any) => (
            <View key={item.id} className="withdrawal-item">
              <View className="withdrawal-info">
                <Text className="withdrawal-amount">¥{item.amount}</Text>
                <Text className="withdrawal-time">{item.time || ''}</Text>
              </View>
              <Text className={`withdrawal-status status-${item.status || 'pending'}`}>
                {item.statusText || item.status || '处理中'}
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
