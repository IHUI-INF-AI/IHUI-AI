import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native'

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

const PACKAGES: Package[] = [
  { id: '1', tokens: 100000, price: 9.9, bonus: 0 },
  { id: '2', tokens: 500000, price: 39.9, bonus: 50000 },
  { id: '3', tokens: 1000000, price: 68, bonus: 150000, popular: true },
  { id: '4', tokens: 5000000, price: 298, bonus: 1000000 },
]

const RECORDS: Record[] = [
  { id: '1', type: 'cost', title: 'GPT-4o 对话消耗', amount: -320, time: '2026-07-24 10:32' },
  { id: '2', type: 'recharge', title: '充值 100 万 Token', amount: 1000000, time: '2026-07-23 18:20' },
  { id: '3', type: 'cost', title: 'Claude 3.5 长文档分析', amount: -1280, time: '2026-07-23 14:15' },
  { id: '4', type: 'cost', title: 'DALL·E 3 图像生成', amount: -200, time: '2026-07-22 20:08' },
  { id: '5', type: 'cost', title: 'Gemini 1.5 Pro 推理', amount: -540, time: '2026-07-22 09:44' },
  { id: '6', type: 'recharge', title: '签到赠送', amount: 1000, time: '2026-07-21 00:00' },
  { id: '7', type: 'cost', title: 'GLM-4-Plus 工具调用', amount: -160, time: '2026-07-20 16:30' },
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
  const [tab, setTab] = useState<RecordType>('all')

  const balance = 1284560
  const frozen = 5000
  const totalCost = 3745000

  const list = RECORDS.filter((r) => (tab === 'all' ? true : r.type === tab))

  const handleRecharge = (p: Package) =>
    Alert.alert('确认充值', `套餐:${formatToken(p.tokens)} Token · ¥${p.price}`, [
      { text: '取消' },
      { text: '立即支付', onPress: () => Alert.alert('支付成功', `已到账 ${formatToken(p.tokens + p.bonus)} Token`) },
    ])

  return (
    <FlatList
      style={s.container}
      data={list}
      keyExtractor={(i) => i.id}
      ListHeaderComponent={
        <View>
          <View style={s.balanceCard}>
            <Text style={s.balanceLabel}>可用算力(Token)</Text>
            <Text style={s.balanceValue}>{formatToken(balance)}</Text>
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
        </View>
      }
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      ListEmptyComponent={
        <View style={s.empty}>
          <Text style={s.emptyText}>暂无记录</Text>
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
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  balanceCard: { padding: 16, borderRadius: 12, backgroundColor: '#7B61FF' },
  balanceLabel: { fontSize: 12, color: '#E9E5FF' },
  balanceValue: { marginTop: 6, fontSize: 32, fontWeight: '700', color: '#FFFFFF' },
  balanceMeta: { flexDirection: 'row', marginTop: 12, gap: 24 },
  metaItem: {},
  metaLabel: { fontSize: 11, color: '#E9E5FF' },
  metaValue: { marginTop: 2, fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  sectionTitle: { marginTop: 20, marginBottom: 10, fontSize: 14, fontWeight: '600', color: '#111827' },
  pkgScroll: { gap: 10, paddingVertical: 4 },
  pkgCard: { width: 130, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', alignItems: 'center' },
  pkgCardPopular: { borderColor: '#7B61FF', backgroundColor: '#F5F3FF' },
  popularBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: '#7B61FF' },
  popularText: { fontSize: 10, fontWeight: '600', color: '#FFFFFF' },
  pkgTokens: { marginTop: 8, fontSize: 18, fontWeight: '700', color: '#111827' },
  pkgUnit: { marginTop: 2, fontSize: 11, color: '#6B7280' },
  pkgBonus: { marginTop: 4, fontSize: 11, color: '#FF6B00', fontWeight: '600' },
  pkgPriceBox: { marginTop: 8, paddingHorizontal: 12, height: 28, borderRadius: 8, backgroundColor: '#7B61FF', alignItems: 'center', justifyContent: 'center' },
  pkgPrice: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tabItem: { paddingHorizontal: 14, height: 30, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  tabItemActive: { backgroundColor: '#7B61FF' },
  tabText: { fontSize: 12, color: '#6B7280' },
  tabTextActive: { color: '#FFFFFF', fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 13, color: '#9CA3AF' },
  recordItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  recordIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  recordIconGreen: { backgroundColor: '#ECFDF5' },
  recordIconGray: { backgroundColor: '#F3F4F6' },
  recordIconText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  recordMain: { flex: 1 },
  recordTitle: { fontSize: 13, fontWeight: '600', color: '#111827' },
  recordTime: { marginTop: 2, fontSize: 11, color: '#9CA3AF' },
  recordAmount: { fontSize: 14, fontWeight: '700' },
  amountGreen: { color: '#10B981' },
  amountRed: { color: '#FF6B00' },
})
