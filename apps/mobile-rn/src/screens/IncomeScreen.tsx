/**
 * IncomeScreen — 收益首页(income/index.vue 迁移)
 * 布局:收益统计(今日/累计/余额) + 提现入口 + 收益记录列表。
 */
import { useEffect, useState } from 'react'
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface CommissionItem {
  id: string
  title: string
  amount: number
  time: string
  settled: boolean
}

interface CommissionData {
  total_earnings: string | number
  today_commission: string | number
  balance: string | number
  commission_list: CommissionItem[]
}

function formatAmount(v: string | number | undefined | null): string {
  if (v === null || v === undefined || v === '') return '0.00'
  const n = Number(v)
  if (!Number.isFinite(n)) return '0.00'
  return n.toFixed(2)
}

const MOCK_FALLBACK: CommissionData = {
  total_earnings: '0',
  today_commission: '0',
  balance: '0',
  commission_list: [],
}

export function IncomeScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { token, user } = useAuth()
  const [data, setData] = useState<CommissionData>(MOCK_FALLBACK)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      try {
        const resp = await fetch(`${API_BASE_URL}/api/trader/commission`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(user?.id ? { 'X-User-Id': String(user.id) } : {}),
          },
        })
        if (!resp.ok) throw new Error('http')
        const json = (await resp.json()) as { data?: CommissionData }
        if (cancelled) return
        if (json.data) {
          setData({
            total_earnings: json.data.total_earnings ?? '0',
            today_commission: json.data.today_commission ?? '0',
            balance: json.data.balance ?? '0',
            commission_list: json.data.commission_list ?? [],
          })
        }
      } catch {
        if (!cancelled) setError('加载失败,请稍后重试')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, user?.id])

  const handleWithdraw = () => {
    navigation.navigate('Withdraw' as never)
  }

  if (loading) {
    return (
      <View style={s.center}>
        <Text style={s.mutedText}>加载中...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>{error}</Text>
      </View>
    )
  }

  const stats = [
    { label: '今日收益', value: formatAmount(data.today_commission), tone: 'primary' as const },
    { label: '累计收益', value: formatAmount(data.total_earnings), tone: 'primary' as const },
    { label: '可提现', value: formatAmount(data.balance), tone: 'accent' as const },
  ]

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.header}>
        <Text style={s.headerTitle}>我的佣金</Text>
      </View>

      <View style={s.summaryCard}>
        <View style={s.summaryRow}>
          {stats.map((it) => (
            <View key={it.label} style={s.summaryCol}>
              <Text style={s.summaryLabel}>{it.label}</Text>
              <Text style={[s.summaryValue, it.tone === 'accent' && s.summaryAccent]}>
                ¥ {it.value}
              </Text>
            </View>
          ))}
        </View>
        <Pressable style={s.withdrawBtn} onPress={handleWithdraw} accessibilityLabel="去提现">
          <Text style={s.withdrawText}>提现</Text>
        </Pressable>
      </View>

      <Text style={s.sectionTitle}>收益记录</Text>
      <FlatList
        data={data.commission_list}
        keyExtractor={(item, idx) => item.id ?? String(idx)}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>暂无收益记录</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardHead}>
              <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={[s.cardStatus, item.settled ? s.statusSettled : s.statusPending]}>
                {item.settled ? '已结算' : '待结算'}
              </Text>
            </View>
            <Text style={s.cardTime}>{item.time}</Text>
            <Text style={s.cardAmount}>+¥ {formatAmount(item.amount)}</Text>
          </View>
        )}
      />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  mutedText: { fontSize: 13, color: '#9CA3AF' },
  errorText: { fontSize: 13, color: '#DC2626' },
  header: { paddingVertical: 8, marginBottom: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F5F3FF',
    marginBottom: 16,
  },
  summaryRow: { flexDirection: 'row', marginBottom: 12 },
  summaryCol: { flex: 1 },
  summaryLabel: { fontSize: 12, color: '#6B7280' },
  summaryValue: { marginTop: 4, fontSize: 18, fontWeight: '700', color: '#111827' },
  summaryAccent: { color: '#7B61FF' },
  withdrawBtn: {
    height: 40,
    borderRadius: 10,
    backgroundColor: '#7B61FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  withdrawText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 10 },
  emptyBox: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 13, color: '#9CA3AF' },
  card: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: '#111827', marginRight: 8 },
  cardStatus: { fontSize: 11, fontWeight: '700' },
  statusSettled: { color: '#10B981' },
  statusPending: { color: '#FF6B00' },
  cardTime: { marginTop: 4, fontSize: 11, color: '#9CA3AF' },
  cardAmount: { marginTop: 6, fontSize: 15, fontWeight: '700', color: '#FF6B00' },
})

export default IncomeScreen
