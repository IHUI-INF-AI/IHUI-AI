import { useEffect, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { Card } from '@ihui/ui-native'
import { getBalance, type WalletBalance } from '@ihui/api-client'

function formatAmount(n: number | undefined | null): string {
  if (typeof n !== 'number') return '—'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function WalletScreen() {
  const [balance, setBalance] = useState<WalletBalance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await getBalance()
      if (cancelled) return
      if (res.success) setBalance(res.data)
      else setError(res.error || '加载失败')
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-500">加载中...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-4">
        <Text className="text-red-600">{error}</Text>
      </View>
    )
  }

  if (!balance) return null

  const cards: Array<{ label: string; value: number; tone: 'primary' | 'muted' }> = [
    { label: '可用余额', value: balance.balance, tone: 'primary' },
    { label: '冻结金额', value: balance.frozenBalance, tone: 'muted' },
    { label: '累计充值', value: balance.totalRecharge, tone: 'primary' },
    { label: '累计提现', value: balance.totalWithdraw, tone: 'muted' },
  ]

  return (
    <ScrollView className="flex-1 bg-white dark:bg-black">
      <View className="p-4">
        {cards.map((c) => (
          <View key={c.label} className="mb-3">
            <Card>
              <Text className="text-xs text-neutral-500">{c.label}</Text>
              <Text
                className={
                  c.tone === 'primary'
                    ? 'mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-50'
                    : 'mt-1 text-2xl font-semibold text-neutral-500'
                }
              >
                ¥ {formatAmount(c.value)}
              </Text>
            </Card>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}
