import { View, Text } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getTokenBalance, getTokenRecords } from '@/api'
import { useI18n } from '@/i18n'
import './balance.css'

// Token 记录后端字段未严格类型化,这里枚举常见字段名做容错
interface TokenRecord {
  id?: string
  amount?: number
  // 标题/说明字段:优先 title,其次 description/remark/reason,再回退 type
  title?: string
  description?: string
  remark?: string
  reason?: string
  type?: string
  // 时间字段:优先 time,其次 createdAt/createTime
  time?: string
  createdAt?: string
  createTime?: string
}

interface TokenBalanceInfo {
  amount?: number
  balance?: number
}

interface TokenRecordsResponse {
  list?: TokenRecord[]
  total?: number
}

export default function TokenBalance() {
  const { t } = useI18n()
  const [balance, setBalance] = useState<TokenBalanceInfo | null>(null)
  const [records, setRecords] = useState<TokenRecord[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const result = (await Promise.all([getTokenBalance(), getTokenRecords(1)])) as [
        TokenBalanceInfo,
        TokenRecordsResponse,
      ]
      setBalance(result[0])
      setRecords(result[1]?.list || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(load)

  const balanceValue =
    (balance?.amount as number) ?? (balance?.balance as number) ?? 0

  const recordTitle = useCallback((r: TokenRecord) => {
    return r.title || r.description || r.remark || r.reason || r.type || t('token.balance.change')
  }, [t])

  const recordTime = useCallback((r: TokenRecord) => {
    return r.time || r.createdAt || r.createTime || ''
  }, [])

  return (
    <View className="token-page">
      <View className="balance-card">
        <Text className="balance-label">{t('token.balance.balanceLabel')}</Text>
        <Text className="balance-value">{loading ? '--' : balanceValue}</Text>
      </View>
      <View className="records-section">
        <Text className="section-title">{t('token.balance.recordsTitle')}</Text>
        <View className="record-list">
          {loading ? (
            <Text className="loading-text">{t('common.loading')}</Text>
          ) : records.length ? (
            records.map((r, idx) => {
              const amount = Number(r.amount) || 0
              return (
                <View key={r.id || idx} className="record-item">
                  <View className="record-info">
                    <Text className="record-title">{recordTitle(r)}</Text>
                    <Text className="record-time">{recordTime(r)}</Text>
                  </View>
                  <Text className={`record-amount ${amount >= 0 ? 'plus' : 'minus'}`}>
                    {amount >= 0 ? '+' : ''}
                    {amount}
                  </Text>
                </View>
              )
            })
          ) : (
            <Text className="empty-text">{t('token.balance.empty')}</Text>
          )}
        </View>
      </View>
    </View>
  )
}
