import { useMemo } from 'react'
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'

/** VIP 操盘手统计项(由 wrapper 从 CommissionOverview 构建) */
export interface VipTraderStat {
  label: string
  value: string
  trend: string
}

/** VIP 操盘手权益特性(静态产品展示) */
export interface VipTraderFeature {
  id: string
  icon: string
  title: string
}

/** VipTraderScreen props(平台无关,wrapper 注入数据+回调) */
export interface VipTraderScreenProps {
  t: TFunction
  stats: VipTraderStat[]
  opened: boolean
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onOpen: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

const TRADER_PRICE = 9980
const TRADER_POWER = '1600W'

// 权益特性是产品展示,非业务数据,保留前端静态
const FEATURES: VipTraderFeature[] = [
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

/**
 * VIP 操盘手共享屏 — props 注入式跨端组件
 *
 * 平台无关:渲染 header + hero 卡片 + 统计 + 入口 + 权益列表 + 底部购买栏。
 * 平台特定(导航 / API 调用)由 wrapper 通过 props 注入。
 * 静态营销文案保留中文(FEATURES + hero 文案),通用键走 t()。
 */
export function VipTraderScreen({
  t,
  stats,
  opened,
  loading,
  refreshing,
  error,
  onRefresh,
  onOpen,
  onBack,
  colorScheme = 'light',
}: VipTraderScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const renderItem = ({ item }: { item: VipTraderFeature }) => (
    <View style={styles.featureItem}>
      <View style={styles.featureIcon}>
        <Text style={styles.featureIconText}>{item.icon}</Text>
      </View>
      <Text style={styles.featureTitle}>{item.title}</Text>
    </View>
  )

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('vipTrader.title')}</Text>
        <Text style={styles.subtitle}>{t('vipTrader.subtitle')}</Text>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{t('vipTrader.badge')}</Text>
          </View>
          <Text style={styles.heroPrice}>¥{TRADER_PRICE.toLocaleString()}</Text>
        </View>
        <Text style={styles.heroDesc}>
          {t('vipTrader.heroDesc', { price: TRADER_PRICE.toLocaleString(), power: TRADER_POWER })}
        </Text>
      </View>

      <View style={styles.statCard}>
        {loading ? (
          <Text style={styles.statHint}>{t('common.loading')}</Text>
        ) : error ? (
          <Text style={styles.statHint}>{error}</Text>
        ) : (
          stats.map((it) => (
            <View key={it.label} style={styles.statCol}>
              <Text style={styles.statLabel}>{it.label}</Text>
              <Text style={styles.statValue}>{it.value}</Text>
              <Text style={styles.statTrend}>{it.trend}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.entryRow}>
        <TouchableOpacity style={styles.entryBtn} activeOpacity={0.8}>
          <Text style={styles.entryIcon}>👥</Text>
          <Text style={styles.entryText}>{t('vipTrader.entryTeam')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.entryBtn} activeOpacity={0.8}>
          <Text style={styles.entryIcon}>📊</Text>
          <Text style={styles.entryText}>{t('vipTrader.entryStats')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.entryBtn} activeOpacity={0.8}>
          <Text style={styles.entryIcon}>💳</Text>
          <Text style={styles.entryText}>{t('vipTrader.entryWithdraw')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{t('vipTrader.benefits')}</Text>
        <Text style={styles.sectionCount}>
          {t('vipTrader.benefitCount', { count: FEATURES.length })}
        </Text>
      </View>

      <FlatList<VipTraderFeature>
        data={FEATURES}
        keyExtractor={(i) => i.id}
        scrollEnabled={false}
        contentContainerStyle={styles.featureList}
        ItemSeparatorComponent={() => <View style={styles.featureGap} />}
        renderItem={renderItem}
      />

      <View style={styles.footPlaceholder} />

      <View style={styles.footer}>
        <View style={styles.footLeft}>
          <Text style={styles.footSymbol}>¥</Text>
          <Text style={styles.footPrice}>{TRADER_PRICE.toLocaleString()}</Text>
          <Text style={styles.footHint}> {t('vipTrader.lifetime')}</Text>
        </View>
        <TouchableOpacity
          style={[styles.buyBtn, opened && styles.buyBtnDone]}
          activeOpacity={0.8}
          onPress={onOpen}
          disabled={opened}
        >
          <Text style={styles.buyBtnText}>
            {opened ? t('vipTrader.opened') : t('vipTrader.openNow')}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.light },
    header: { paddingHorizontal: 10, paddingTop: 48, paddingBottom: 8 },
    backText: { fontSize: 16, color: tk.text.secondary, marginBottom: 8 },
    title: { fontSize: 20, fontWeight: '700', color: tk.text.primary },
    subtitle: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    heroCard: {
      marginHorizontal: 16,
      marginTop: 8,
      padding: 14,
      borderRadius: 12,
      backgroundColor: tk.surface.dark,
    },
    heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    heroBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: 'rgba(255,215,0,0.18)',
    },
    heroBadgeText: { fontSize: 11, fontWeight: '600', color: tk.warning.amber },
    heroPrice: { fontSize: 24, fontWeight: '700', color: tk.warning.amber },
    heroDesc: { marginTop: 8, fontSize: 14, color: 'rgba(255,255,255,0.7)' },
    statCard: {
      marginHorizontal: 16,
      marginTop: 12,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    statCol: { width: '50%', paddingVertical: 6 },
    statLabel: { fontSize: 11, color: tk.text.secondary },
    statValue: { marginTop: 8, fontSize: 18, fontWeight: '700', color: tk.text.primary },
    statTrend: { marginTop: 8, fontSize: 11, color: tk.brand.DEFAULT },
    statHint: {
      width: '100%',
      paddingVertical: 16,
      fontSize: 14,
      color: tk.text.tertiary,
      textAlign: 'center',
    },
    entryRow: { marginHorizontal: 16, marginTop: 12, flexDirection: 'row' },
    entryBtn: {
      flex: 1,
      marginHorizontal: 8,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
    },
    entryIcon: { fontSize: 20 },
    entryText: { marginTop: 8, fontSize: 14, color: tk.text.medium },
    sectionHead: {
      marginHorizontal: 16,
      marginTop: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    sectionCount: { fontSize: 11, color: tk.text.tertiary },
    featureList: { paddingHorizontal: 10, paddingTop: 10 },
    featureGap: { height: 12 },
    featureItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    featureIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    featureIconText: { fontSize: 18 },
    featureTitle: { flex: 1, fontSize: 14, color: tk.text.medium, lineHeight: 18 },
    footPlaceholder: { height: 88 },
    footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 10,
      paddingVertical: 12,
      backgroundColor: tk.surface.light,
      shadowColor: tk.gray.black,
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: -2 },
      elevation: 8,
    },
    footLeft: { flexDirection: 'row', alignItems: 'baseline' },
    footSymbol: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    footPrice: { fontSize: 22, fontWeight: '700', color: tk.text.primary },
    footHint: { fontSize: 11, color: tk.text.tertiary },
    buyBtn: {
      paddingHorizontal: 22,
      height: 44,
      borderRadius: 15,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buyBtnDone: { backgroundColor: tk.text.tertiary },
    buyBtnText: { fontSize: 16, fontWeight: '600', color: tk.surface.light },
  })
}
