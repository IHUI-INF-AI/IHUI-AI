import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StyleSheet,
} from 'react-native'

interface Feature {
  id: string
  icon: string
  title: string
}

interface Stat {
  label: string
  value: string
  trend: string
}

const TRADER_PRICE = 9980
const TRADER_POWER = '1600W'

const STATS: Stat[] = [
  { label: '团队人数', value: '128', trend: '本月 +12' },
  { label: '累计佣金', value: '¥48,620', trend: '本月 +¥3,240' },
  { label: '本月收益', value: '¥3,240', trend: '环比 +18%' },
  { label: '待结算', value: '¥580', trend: '3 笔' },
]

const FEATURES: Feature[] = [
  { id: 'distribution', icon: '🏅', title: '享受大额分销资格,入驻社区服务商名列' },
  { id: 'ai_courses', icon: '🎓', title: 'AI 深度认知课/深度商业课/流量全链路打法免费观看' },
  { id: 'founder_qa', icon: '🤝', title: '创始人一对一随时答疑陪跑' },
  { id: 'agent_beta', icon: '🧪', title: '最新研发 Agent 内测资格一年' },
  { id: 'vip_max_discount', icon: '💎', title: '会员等级拉满,享受全部最高折扣' },
  { id: 'custom_agent', icon: '⚡', title: '插队定制独家 Agent 功能 8 折优惠' },
  { id: 'all_rights', icon: '🎁', title: '会员享受的全部权益' },
  { id: 'incubation', icon: '🚀', title: 'AI+垂类账号孵化优先陪跑机会' },
  { id: 'secondary', icon: '🌐', title: '二级分销权益,快速扩张团队及收益' },
  { id: 'offline', icon: '🏢', title: '公司总部入驻及线下学习实操机会' },
  { id: 'computing', icon: '💡', title: `操盘手赠送 ${TRADER_POWER} 算力` },
  { id: 'knowledge', icon: '🗂️', title: '开通个人知识库超大 20G 空间' },
  { id: 'ai_custom', icon: '🤖', title: '插队 AI 分身/AI 客服定制开通' },
]

export default function VipTraderScreen() {
  const [opened, setOpened] = useState(false)

  const renderItem = ({ item }: { item: Feature }) => (
    <View style={s.featureItem}>
      <View style={s.featureIcon}>
        <Text style={s.featureIconText}>{item.icon}</Text>
      </View>
      <Text style={s.featureTitle}>{item.title}</Text>
    </View>
  )

  return (
    <ScrollView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>VIP 操盘手</Text>
        <Text style={s.subtitle}>AI 智汇社操盘手 · 终身使用</Text>
      </View>

      <View style={s.heroCard}>
        <View style={s.heroTop}>
          <View style={s.heroBadge}>
            <Text style={s.heroBadgeText}>操盘手</Text>
          </View>
          <Text style={s.heroPrice}>¥{TRADER_PRICE.toLocaleString()}</Text>
        </View>
        <Text style={s.heroDesc}>一次性支付,终身使用 · 含 {TRADER_POWER} 算力</Text>
      </View>

      <View style={s.statCard}>
        {STATS.map((it) => (
          <View key={it.label} style={s.statCol}>
            <Text style={s.statLabel}>{it.label}</Text>
            <Text style={s.statValue}>{it.value}</Text>
            <Text style={s.statTrend}>{it.trend}</Text>
          </View>
        ))}
      </View>

      <View style={s.entryRow}>
        <TouchableOpacity style={s.entryBtn} activeOpacity={0.8} onPress={() => {}}>
          <Text style={s.entryIcon}>👥</Text>
          <Text style={s.entryText}>我的团队</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.entryBtn} activeOpacity={0.8} onPress={() => {}}>
          <Text style={s.entryIcon}>📊</Text>
          <Text style={s.entryText}>跟单中心</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.entryBtn} activeOpacity={0.8} onPress={() => {}}>
          <Text style={s.entryIcon}>💳</Text>
          <Text style={s.entryText}>佣金提现</Text>
        </TouchableOpacity>
      </View>

      <View style={s.sectionHead}>
        <Text style={s.sectionTitle}>操盘手权益</Text>
        <Text style={s.sectionCount}>共 {FEATURES.length} 项</Text>
      </View>

      <FlatList
        data={FEATURES}
        keyExtractor={(i) => i.id}
        scrollEnabled={false}
        contentContainerStyle={s.featureList}
        ItemSeparatorComponent={() => <View style={s.featureGap} />}
        renderItem={renderItem}
      />

      <View style={s.footPlaceholder} />

      <View style={s.footer}>
        <View style={s.footLeft}>
          <Text style={s.footSymbol}>¥</Text>
          <Text style={s.footPrice}>{TRADER_PRICE.toLocaleString()}</Text>
          <Text style={s.footHint}> 终身使用</Text>
        </View>
        <TouchableOpacity
          style={[s.buyBtn, opened && s.buyBtnDone]}
          activeOpacity={0.8}
          onPress={() => setOpened(true)}
          disabled={opened}
        >
          <Text style={s.buyBtnText}>{opened ? '已开通' : '一键开通'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  subtitle: { marginTop: 4, fontSize: 12, color: '#6B7280' },
  heroCard: { marginHorizontal: 16, marginTop: 8, padding: 16, borderRadius: 12, backgroundColor: '#1F2937' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(255,215,0,0.18)' },
  heroBadgeText: { fontSize: 11, fontWeight: '600', color: '#FFD700' },
  heroPrice: { fontSize: 24, fontWeight: '700', color: '#FFD700' },
  heroDesc: { marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  statCard: { marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', flexWrap: 'wrap' },
  statCol: { width: '50%', paddingVertical: 6 },
  statLabel: { fontSize: 11, color: '#6B7280' },
  statValue: { marginTop: 4, fontSize: 17, fontWeight: '700', color: '#111827' },
  statTrend: { marginTop: 2, fontSize: 11, color: '#10B981' },
  entryRow: { marginHorizontal: 16, marginTop: 12, flexDirection: 'row' },
  entryBtn: { flex: 1, marginHorizontal: 4, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F5F3FF', alignItems: 'center' },
  entryIcon: { fontSize: 18 },
  entryText: { marginTop: 4, fontSize: 12, color: '#374151' },
  sectionHead: { marginHorizontal: 16, marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  sectionCount: { fontSize: 11, color: '#9CA3AF' },
  featureList: { paddingHorizontal: 16, paddingTop: 10 },
  featureGap: { height: 10 },
  featureItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  featureIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#F5F3FF', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  featureIconText: { fontSize: 16 },
  featureTitle: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 18 },
  footPlaceholder: { height: 88 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', shadowColor: '#000000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: -2 }, elevation: 8 },
  footLeft: { flexDirection: 'row', alignItems: 'baseline' },
  footSymbol: { fontSize: 14, fontWeight: '600', color: '#111827' },
  footPrice: { fontSize: 22, fontWeight: '700', color: '#111827' },
  footHint: { fontSize: 11, color: '#9CA3AF' },
  buyBtn: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: 10, backgroundColor: '#7B61FF' },
  buyBtnDone: { backgroundColor: '#9CA3AF' },
  buyBtnText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
})
