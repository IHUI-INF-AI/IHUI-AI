import { View, Text } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getDeveloperWithdrawalList } from '@/api'
import { useI18n } from '@/i18n'
import './withdrawal.css'

// 开发者提现记录项(getDeveloperWithdrawalList 后端未类型化,按页面使用字段定义)
interface WithdrawalItem {
  id: string
  amount: number
  time?: string
  status?: string
  statusText?: string
}

// 开发者提现列表响应
interface WithdrawalListResponse {
  list?: WithdrawalItem[]
}

export default function DeveloperWithdrawal() {
  const { t } = useI18n()
  const [list, setList] = useState<WithdrawalItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = (await getDeveloperWithdrawalList()) as WithdrawalListResponse
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
        <Text className="page-title">{t('developer.withdrawal.title')}</Text>
      </View>
      <View className="withdrawal-list">
        {loading ? (
          <Text className="loading-text">{t('common.loading')}</Text>
        ) : list.length ? (
          list.map((item) => (
            <View key={item.id} className="withdrawal-item">
              <View className="withdrawal-info">
                <Text className="withdrawal-amount">¥{item.amount}</Text>
                <Text className="withdrawal-time">{item.time || ''}</Text>
              </View>
              <Text className={`withdrawal-status status-${item.status || 'pending'}`}>
                {item.statusText ||
                  item.status ||
                  t('developer.withdrawal.processing')}
              </Text>
            </View>
          ))
        ) : (
          <Text className="empty-text">{t('developer.withdrawal.empty')}</Text>
        )}
      </View>
    </View>
  )
}
