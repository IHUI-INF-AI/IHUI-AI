/**
 * EarnCommissionScreen 分佣计划介绍(mobile-rn 端)
 *
 * 1:1 复刻历史 Uniapp pagesA/earn_commission/index.vue 的内容结构:
 * - NavBar「分佣计划」+ 返回
 * - 统计卡片:累计收益 / 邀请人数(对齐 Uniapp stats-area)
 * - 规则说明:4 条分佣规则(对齐 Uniapp rules-section 静态文本)
 * - 分佣比例表:会员费 20% 佣金(对齐 Uniapp intro-desc)
 * - 底部按钮:开通VIP会员 参与分佣计划(对齐 Uniapp commission-btn,Alert 占位)
 * - API:getOverview(@ihui/api-client)取累计收益/邀请人数,失败回退 0
 * - 浅色优雅风(原 Uniapp 暗色霓虹主题改为 light tokens,符合 AGENTS.md §4 禁蓝色发光)
 *
 * 平台独占:仅 mobile-rn 端。
 */
import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getOverview, type CommissionOverview } from '@ihui/api-client'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { NavBar } from '../components/NavBar'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface RuleItem {
  num: string
  text: string
}

const RULES: readonly RuleItem[] = [
  { num: '1', text: '成为VIP会员后可参与分佣计划' },
  { num: '2', text: '邀请好友成为会员,您将获得会员费20%的佣金' },
  { num: '3', text: '佣金将在好友支付成功后24小时内自动结算到您的账户' },
  { num: '4', text: '账户余额满100元可申请提现到微信或支付宝' },
] as const

interface RateRow {
  level: string
  rate: string
  desc: string
}

const RATE_TABLE: readonly RateRow[] = [
  { level: 'VIP 会员', rate: '20%', desc: '好友开通 VIP 会员费的 20%' },
  { level: 'SVIP 会员', rate: '25%', desc: '好友开通 SVIP 会员费的 25%' },
] as const

export default function EarnCommissionScreen() {
  const navigation = useNavigation<NavigationProp>()
  const [overview, setOverview] = useState<CommissionOverview | null>(null)

  const load = useCallback(async () => {
    const res = await getOverview()
    if (res.success) setOverview(res.data ?? null)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const totalEarnings = overview?.totalCommission ?? 0
  const invitedCount = overview?.invitedCount ?? 0

  const onOpenVip = (): void => {
    navigation.navigate('Vip')
  }

  return (
    <View style={styles.root}>
      <NavBar title="分佣计划" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>邀请好友,赚取佣金</Text>
          <Text style={styles.introDesc}>
            加入我们的分佣计划,邀请好友注册成为会员,您将获得会员费 20% 的佣金收益
          </Text>
          <View style={styles.statsArea}>
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>{'¥' + (totalEarnings / 100).toFixed(2)}</Text>
              <Text style={styles.statsLabel}>累计收益</Text>
            </View>
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>{String(invitedCount)}</Text>
              <Text style={styles.statsLabel}>邀请人数</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>分佣规则</Text>
          {RULES.map((r) => (
            <View key={r.num} style={styles.ruleItem}>
              <View style={styles.ruleNum}>
                <Text style={styles.ruleNumText}>{r.num}</Text>
              </View>
              <Text style={styles.ruleText}>{r.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>分佣比例</Text>
          {RATE_TABLE.map((row) => (
            <View key={row.level} style={styles.rateRow}>
              <Text style={styles.rateLevel}>{row.level}</Text>
              <Text style={styles.rateValue}>{row.rate}</Text>
              <Text style={styles.rateDesc}>{row.desc}</Text>
            </View>
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [styles.bottomBtn, pressed ? styles.pressed : null]}
          onPress={onOpenVip}
          accessibilityRole="button"
          accessibilityLabel="开通VIP会员参与分佣计划"
        >
          <Text style={styles.bottomBtnText}>开通VIP会员 参与分佣计划</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.surface.bg },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 32 },
  introCard: {
    backgroundColor: tokens.surface.card,
    borderRadius: 12,
    padding: 20,
    gap: 12,
    alignItems: 'center',
  },
  introTitle: { fontSize: 17, fontWeight: '700', color: tokens.text.primary, textAlign: 'center' },
  introDesc: { fontSize: 13, lineHeight: 20, color: tokens.text.secondary, textAlign: 'center' },
  statsArea: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 8 },
  statsItem: { alignItems: 'center', gap: 6 },
  statsValue: { fontSize: 22, fontWeight: '700', color: tokens.brand.DEFAULT },
  statsLabel: { fontSize: 12, color: tokens.text.secondary },
  sectionCard: {
    backgroundColor: tokens.surface.card,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: tokens.text.primary, textAlign: 'center' },
  ruleItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ruleNum: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: tokens.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleNumText: { fontSize: 12, fontWeight: '600', color: tokens.surface.light },
  ruleText: { flex: 1, fontSize: 13, lineHeight: 19, color: tokens.text.primary },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: tokens.surface.muted,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rateLevel: { flex: 1, fontSize: 13, fontWeight: '500', color: tokens.text.primary },
  rateValue: { fontSize: 14, fontWeight: '700', color: tokens.brand.DEFAULT, minWidth: 44 },
  rateDesc: { flex: 2, fontSize: 12, color: tokens.text.secondary },
  bottomBtn: {
    height: 46,
    borderRadius: 8,
    backgroundColor: tokens.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  bottomBtnText: { fontSize: 15, fontWeight: '600', color: tokens.surface.light },
  pressed: { opacity: 0.85 },
})
