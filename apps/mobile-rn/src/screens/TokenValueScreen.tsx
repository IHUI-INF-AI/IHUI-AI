import { useCallback, useEffect, useState } from 'react'
import { Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  getTokenBalance,
  getTokenFlows,
  getTopUpRecords,
  type TokenBalance,
} from '@ihui/api-client'
import {
  TokenValueScreen as SharedTokenValueScreen,
  type TokenRecordType,
  type TokenValueBalance,
  type TokenValuePackage,
  type TokenValueRecord,
} from '@ihui/rn-app'
import { formatShortDateTime } from '../utils/date-utils'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

function formatToken(n: number): string {
  if (Math.abs(n) >= 100000000) return `${(n / 100000000).toFixed(2)}亿`
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(1)}万`
  return `${n}`
}

export default function TokenValueScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [tab, setTab] = useState<TokenRecordType>('all')
  const [balance, setBalance] = useState<TokenValueBalance | null>(null)
  const [records, setRecords] = useState<TokenValueRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [balRes, flowRes, topUpRes] = await Promise.all([
        getTokenBalance(),
        getTokenFlows({ page: 1, pageSize: 50 }),
        getTopUpRecords({ page: 1, pageSize: 50 }),
      ])

      if (balRes.success) {
        const bal: TokenBalance = balRes.data
        // TokenBalance API 不返回 frozen 字段,占位 0(保留 UI 结构)
        setBalance({ balance: bal.balance, frozen: 0, totalUsed: bal.totalUsed })
      }

      const flowItems = flowRes.success ? flowRes.data.list ?? [] : []
      const topUpItems = topUpRes.success ? topUpRes.data.list ?? [] : []

      // 用 ISO 时间戳排序,合并消耗与充值记录(倒序)
      const tagged: Array<{ iso: string; rec: TokenValueRecord }> = []
      for (const f of flowItems) {
        tagged.push({
          iso: f.createdAt,
          rec: {
            id: f.id,
            type: 'cost',
            title: `${f.agentName} · ${f.modelName}`,
            amount: -f.token,
            time: formatShortDateTime(f.createdAt),
          },
        })
      }
      for (const r of topUpItems) {
        tagged.push({
          iso: r.createdAt,
          rec: {
            id: r.orderId,
            type: 'recharge',
            title: `${t('tokenValue.rechargeLabel')} ¥${r.amount}`,
            amount: r.amount,
            time: formatShortDateTime(r.createdAt),
          },
        })
      }
      tagged.sort((a, b) => (a.iso < b.iso ? 1 : a.iso > b.iso ? -1 : 0))
      setRecords(tagged.map((item) => item.rec))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('tokenValue.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = () => {
    setRefreshing(true)
    void load()
  }

  const handleRecharge = (p: TokenValuePackage) =>
    Alert.alert(
      t('tokenValue.recharge.title'),
      t('tokenValue.recharge.message', { tokens: formatToken(p.tokens), price: p.price }),
      [
        { text: t('common.cancel') },
        {
          text: t('tokenValue.recharge.payBtn'),
          onPress: () =>
            Alert.alert(
              t('tokenValue.recharge.success.title'),
              t('tokenValue.recharge.success.message', {
                tokens: formatToken(p.tokens + p.bonus),
              }),
            ),
        },
      ],
    )

  return (
    <SharedTokenValueScreen
      t={t}
      balance={balance}
      records={records}
      loading={loading}
      refreshing={refreshing}
      error={error}
      activeTab={tab}
      onSelectTab={setTab}
      onRefresh={onRefresh}
      onRecharge={handleRecharge}
      onBack={() => navigation.goBack()}
    />
  )
}
