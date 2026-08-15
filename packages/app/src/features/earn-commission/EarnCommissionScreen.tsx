import { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { EarnCommissionScreenProps } from '../../types'

/** 分佣计划/Props 类型 re-export(单一来源 @ihui/types) */
export type { EarnCommissionScreenProps }

interface RuleItem {
  num: string
  text: string
}

interface RateRow {
  level: string
  rate: string
  desc: string
}

const RULES: readonly RuleItem[] = [
  { num: '1', text: '成为VIP会员后可参与分佣计划' },
  { num: '2', text: '邀请好友成为会员,您将获得会员费20%的佣金' },
  { num: '3', text: '佣金将在好友支付成功后24小时内自动结算到您的账户' },
  { num: '4', text: '账户余额满100元可申请提现到微信或支付宝' },
] as const

const RATE_TABLE: readonly RateRow[] = [
  { level: 'VIP 会员', rate: '20%', desc: '好友开通 VIP 会员费的 20%' },
  { level: 'SVIP 会员', rate: '25%', desc: '好友开通 SVIP 会员费的 25%' },
] as const

/**
 * 分佣计划共享屏 — 平台无关 UI 组件
 *
 * 平台无关:负责渲染 header(返回 + 标题) + 统计卡片 + 规则说明 + 分佣比例表 + 底部按钮。
 * 平台特定(API 调用/导航)由 wrapper 通过 props 注入。
 */
export function EarnCommissionScreen({
  t,
  onBack,
  overview,
  onOpenVip,
  colorScheme = 'light',
}: EarnCommissionScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const totalEarnings = overview?.totalCommission ?? 0
  const invitedCount = overview?.invitedCount ?? 0

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('earnCommission.title') || '分佣计划'}</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>{t('earnCommission.introTitle') || '邀请好友,赚取佣金'}</Text>
          <Text style={styles.introDesc}>
            {t('earnCommission.introDesc') || '加入我们的分佣计划,邀请好友注册成为会员,您将获得会员费 20% 的佣金收益'}
          </Text>
          <View style={styles.statsArea}>
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>{'¥' + (totalEarnings / 100).toFixed(2)}</Text>
              <Text style={styles.statsLabel}>{t('earnCommission.totalEarnings') || '累计收益'}</Text>
            </View>
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>{String(invitedCount)}</Text>
              <Text style={styles.statsLabel}>{t('earnCommission.invitedCount') || '邀请人数'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t('earnCommission.rules') || '分佣规则'}</Text>
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
          <Text style={styles.sectionTitle}>{t('earnCommission.rateTitle') || '分佣比例'}</Text>
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
          accessibilityLabel={t('earnCommission.openVip') || '开通VIP会员参与分佣计划'}
        >
          <Text style={styles.bottomBtnText}>{t('earnCommission.openVip') || '开通VIP会员 参与分佣计划'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 14, color: tk.text.medium },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    scroll: { flex: 1 },
    scrollContent: { padding: 16, gap: 16, paddingBottom: 32 },
    introCard: {
      backgroundColor: tk.surface.card,
      borderRadius: 12,
      padding: 20,
      gap: 12,
      alignItems: 'center',
    },
    introTitle: { fontSize: 17, fontWeight: '700', color: tk.text.primary, textAlign: 'center' },
    introDesc: { fontSize: 13, lineHeight: 20, color: tk.text.secondary, textAlign: 'center' },
    statsArea: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 8 },
    statsItem: { alignItems: 'center', gap: 6 },
    statsValue: { fontSize: 22, fontWeight: '700', color: tk.brand.DEFAULT },
    statsLabel: { fontSize: 12, color: tk.text.secondary },
    sectionCard: {
      backgroundColor: tk.surface.card,
      borderRadius: 12,
      padding: 16,
      gap: 12,
    },
    sectionTitle: { fontSize: 15, fontWeight: '600', color: tk.text.primary, textAlign: 'center' },
    ruleItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    ruleNum: {
      width: 22,
      height: 22,
      borderRadius: 6,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ruleNumText: { fontSize: 12, fontWeight: '600', color: tk.surface.light },
    ruleText: { flex: 1, fontSize: 13, lineHeight: 19, color: tk.text.primary },
    rateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: tk.surface.muted,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    rateLevel: { flex: 1, fontSize: 13, fontWeight: '500', color: tk.text.primary },
    rateValue: { fontSize: 14, fontWeight: '700', color: tk.brand.DEFAULT, minWidth: 44 },
    rateDesc: { flex: 2, fontSize: 12, color: tk.text.secondary },
    bottomBtn: {
      height: 46,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    bottomBtnText: { fontSize: 15, fontWeight: '600', color: tk.surface.light },
    pressed: { opacity: 0.85 },
  })
}
