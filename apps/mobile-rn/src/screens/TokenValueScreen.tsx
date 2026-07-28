import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native'
import {
  getTokenBalance,
  getTokenFlows,
  getTopUpRecords,
  type TokenBalance,
} from '@ihui/api-client'
import { formatShortDateTime } from '../utils/date-utils'
import { useI18n } from '../i18n'

type RecordType = 'all' | 'cost' | 'recharge'

interface Package {
  id: string
  tokens: number
  price: number
  bonus: number
  popular?: boolean
}

interface Record {
  id: string
  type: 'cost' | 'recharge'
  title: string
  amount: number
  time: string
}

// 套餐价格是产品配置,非业务数据,保留前端静态
const PACKAGES: Package[] = [
  { id: '1', tokens: 100000, price: 9.9, bonus: 0 },
  { id: '2', tokens: 500000, price: 39.9, bonus: 50000 },
  { id: '3', tokens: 1000000, price: 68, bonus: 150000, popular: true },
  { id: '4', tokens: 5000000, price: 298, bonus: 1000000 },
]

const TABS: { id: RecordType; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'cost', label: '消耗' },
  { id: 'recharge', label: '充值' },
]

function formatToken(n: number): string {
  if (Math.abs(n) >= 100000000) return `${(n / 100000000).toFixed(2)}亿`
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(1)}万`
  return `${n}`
}

export default function TokenValueScreen() {
  const { t } = useI18n()
  const [tab, setTab] = useState<RecordType>('all')
  const [balance, setBalance] = useState<TokenBalance | null>(null)
  const [records, setRecords] = useState<Record[]>([])
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

      if (balRes.success) setBalance(balRes.data)

      const flowItems = flowRes.success ? flowRes.data.list ?? [] : []
      const topUpItems = topUpRes.success ? topUpRes.data.list ?? [] : []

      // 用 ISO 时间戳排序,合并消耗与充值记录(倒序)
      const tagged: Array<{ iso: string; rec: Record }> = []
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
            title: `充值 ¥${r.amount}`,
            amount: r.amount,
            time: formatShortDateTime(r.createdAt),
          },
        })
      }
      tagged.sort((a, b) => (a.iso < b.iso ? 1 : a.iso > b.iso ? -1 : 0))
      setRecords(tagged.map((t) => t.rec))
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = () => {
    setRefreshing(true)
    void load()
  }

  // TokenBalance API 不返回 frozen 字段,占位 0(保留 UI 结构)
  const frozen = 0
  const balanceValue = balance?.balance ?? 0
  const totalCost = balance?.totalUsed ?? 0

  const list = records.filter((r) => (tab === 'all' ? true : r.type === tab))

  const handleRecharge = (p: Package) =>
    Alert.alert(t('tokenValue.recharge.title'), t('tokenValue.recharge.message', { tokens: formatToken(p.tokens), price: p.price }), [
      { text: t('common.cancel') },
      { text: t('tokenValue.recharge.payBtn'), onPress: () => Alert.alert(t('tokenValue.recharge.success.title'), t('tokenValue.recharge.success.message', { tokens: formatToken(p.tokens + p.bonus) })) },
    ])

  return (
    <FlatList
      style={s.container}
      data={list}
      keyExtractor={(i) => i.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View>
          <View style={s.balanceCard}>
            <Text style={s.balanceLabel}>可用算力(Token)</Text>
            <Text style={s.balanceValue}>{formatToken(balanceValue)}</Text>
            <View style={s.balanceMeta}>
              <View style={s.metaItem}>
                <Text style={s.metaLabel}>冻结</Text>
                <Text style={s.metaValue}>{formatToken(frozen)}</Text>
              </View>
              <View style={s.metaItem}>
                <Text style={s.metaLabel}>累计消耗</Text>
                <Text style={s.metaValue}>{formatToken(totalCost)}</Text>
              </View>
            </View>
          </View>

          <Text style={s.sectionTitle}>充值套餐</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pkgScroll}>
            {PACKAGES.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[s.pkgCard, p.popular && s.pkgCardPopular]}
                onPress={() => handleRecharge(p)}
                activeOpacity={0.85}
              >
                {p.popular ? (
                  <View style={s.popularBadge}>
                    <Text style={s.popularText}>热门</Text>
                  </View>
                ) : null}
                <Text style={s.pkgTokens}>{formatToken(p.tokens)}</Text>
                <Text style={s.pkgUnit}>Token</Text>
                {p.bonus > 0 ? (
                  <Text style={s.pkgBonus}>赠 {formatToken(p.bonus)}</Text>
                ) : null}
                <View style={s.pkgPriceBox}>
                  <Text style={s.pkgPrice}>¥{p.price}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={s.sectionTitle}>消耗记录</Text>
          <View style={s.tabRow}>
            {TABS.map((t) => {
              const active = tab === t.id
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[s.tabItem, active && s.tabItemActive]}
                  onPress={() => setTab(t.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.tabText, active && s.tabTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
          {error ? (
            <View style={{ paddingHorizontal: 4, paddingBottom: 4 }}>
              <Text style={{ color: tokens.warning.deep, fontSize: 12 }}>{error}</Text>
            </View>
          ) : null}
        </View>
      }
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      ListEmptyComponent={
        <View style={s.empty}>
          <Text style={s.emptyText}>{loading ? '加载中...' : '暂无记录'}</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={s.recordItem}>
          <View style={[s.recordIcon, item.type === 'recharge' ? s.recordIconGreen : s.recordIconGray]}>
            <Text style={s.recordIconText}>{item.type === 'recharge' ? '充' : '耗'}</Text>
          </View>
          <View style={s.recordMain}>
            <Text style={s.recordTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={s.recordTime}>{item.time}</Text>
          </View>
          <Text style={[s.recordAmount, item.amount > 0 ? s.amountGreen : s.amountRed]}>
            {item.amount > 0 ? '+' : ''}{formatToken(item.amount)}
          </Text>
        </View>
      )}
    />
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  balanceCard: { padding: 16, borderRadius: 12, backgroundColor: tokens.purple.DEFAULT },
  balanceLabel: { fontSize: 12, color: tokens.purple.light }, // TODO: custom color #E9E5FF
  balanceValue: { marginTop: 6, fontSize: 32, fontWeight: '700', color: tokens.surface.light },
  balanceMeta: { flexDirection: 'row', marginTop: 12, gap: 24 },
  metaItem: {},
  metaLabel: { fontSize: 11, color: tokens.purple.light }, // TODO: custom color #E9E5FF
  metaValue: { marginTop: 2, fontSize: 14, fontWeight: '600', color: tokens.surface.light },
  sectionTitle: { marginTop: 20, marginBottom: 10, fontSize: 14, fontWeight: '600', color: tokens.text.primary },
  pkgScroll: { gap: 10, paddingVertical: 4 },
  pkgCard: { width: 130, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: tokens.border.light, backgroundColor: tokens.surface.bg, alignItems: 'center' },
  pkgCardPopular: { borderColor: tokens.purple.DEFAULT, backgroundColor: tokens.purple.light },
  popularBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: tokens.purple.DEFAULT },
  popularText: { fontSize: 10, fontWeight: '600', color: tokens.surface.light },
  pkgTokens: { marginTop: 8, fontSize: 18, fontWeight: '700', color: tokens.text.primary },
  pkgUnit: { marginTop: 2, fontSize: 11, color: tokens.text.secondary },
  pkgBonus: { marginTop: 4, fontSize: 11, color: tokens.warning.deep, fontWeight: '600' },
  pkgPriceBox: { marginTop: 8, paddingHorizontal: 12, height: 28, borderRadius: 8, backgroundColor: tokens.purple.DEFAULT, alignItems: 'center', justifyContent: 'center' },
  pkgPrice: { fontSize: 13, fontWeight: '600', color: tokens.surface.light },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tabItem: { paddingHorizontal: 14, height: 30, borderRadius: 8, backgroundColor: tokens.surface.card, alignItems: 'center', justifyContent: 'center' },
  tabItemActive: { backgroundColor: tokens.purple.DEFAULT },
  tabText: { fontSize: 12, color: tokens.text.secondary },
  tabTextActive: { color: tokens.surface.light, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 13, color: tokens.text.tertiary },
  recordItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: tokens.border.light },
  recordIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  recordIconGreen: { backgroundColor: tokens.success.light },
  recordIconGray: { backgroundColor: tokens.surface.card },
  recordIconText: { fontSize: 12, fontWeight: '600', color: tokens.text.secondary },
  recordMain: { flex: 1 },
  recordTitle: { fontSize: 13, fontWeight: '600', color: tokens.text.primary },
  recordTime: { marginTop: 2, fontSize: 11, color: tokens.text.tertiary },
  recordAmount: { fontSize: 14, fontWeight: '700' },
  amountGreen: { color: tokens.success.DEFAULT },
  amountRed: { color: tokens.warning.deep },
})
