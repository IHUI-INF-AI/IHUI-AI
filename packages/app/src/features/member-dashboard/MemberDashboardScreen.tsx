// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState, ScreenSkeleton } from '../../components/ScreenStates'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'

/**
 * 会员中心首页共享屏(2026-10-29 立)。
 *
 * 数据面照 recon(2026-10-29):`GET /api/members/me` 实际只回 `{member:{user, vipLevel}}`
 * —— web 页读的 points/couponCount/orderCount **该端点不给**(web 全靠 `?? 0` 静默回退);
 * 本屏的数据由宿主组合:积分取 `getUserStatistics().points`、券数取 `/api/coupons` 的 total、
 * 订单数取 `getOrders().total`、最近订单取 `getOrders({pageSize:5})`。金额一律走 shared 的
 * `formatPrice`(分→元唯一出口)。
 */
export interface MemberOrderRow {
  orderNo: string
  title: string
  /** 已格式化的金额文本(宿主用 formatPrice 生成,端内不再二次换算) */
  amountText: string
  statusText: string
  createdAt: string
}

export type MemberCardKey = 'level' | 'points' | 'coupons' | 'orders'

export interface MemberDashboardScreenProps {
  t: (key: string, vars?: Record<string, string | number>) => string
  levelName: string
  expireAtText: string | null
  points: number
  couponCount: number
  orderCount: number
  recentOrders: MemberOrderRow[]
  loading: boolean
  error: string
  onRetry: () => void
  onBack: () => void
  onPressCard: (key: MemberCardKey) => void
  colorScheme?: 'light' | 'dark'
}

export function MemberDashboardScreen({
  t,
  levelName,
  expireAtText,
  points,
  couponCount,
  orderCount,
  recentOrders,
  loading,
  error,
  onRetry,
  onBack,
  onPressCard,
  colorScheme = 'light',
}: MemberDashboardScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) return <ScreenSkeleton colorScheme={colorScheme} />
  if (error) return <ErrorState message={error} onRetry={onRetry} colorScheme={colorScheme} />

  const cards: Array<{ key: MemberCardKey; label: string; value: string }> = [
    { key: 'level', label: t('memberDashboard.level'), value: levelName },
    { key: 'points', label: t('memberDashboard.points'), value: String(points) },
    { key: 'coupons', label: t('memberDashboard.coupons'), value: String(couponCount) },
    { key: 'orders', label: t('memberDashboard.orders'), value: String(orderCount) },
  ]

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('memberDashboard.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.grid}>
          {cards.map((c) => (
            <Pressable
              key={c.key}
              style={styles.card}
              onPress={() => onPressCard(c.key)}
              accessibilityRole="button"
            >
              <Text style={styles.cardValue} numberOfLines={1}>
                {c.value}
              </Text>
              <Text style={styles.cardLabel}>{c.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            {expireAtText
              ? t('memberDashboard.expireAt', { date: expireAtText })
              : t('memberDashboard.noExpire')}
          </Text>
          <Pressable onPress={() => onPressCard('level')} hitSlop={8}>
            <Text style={styles.bannerAction}>{t('memberDashboard.renew')}</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>{t('memberDashboard.recentOrders')}</Text>
            <Pressable onPress={() => onPressCard('orders')} hitSlop={8}>
              <Text style={styles.sectionAction}>{t('memberDashboard.viewAll')}</Text>
            </Pressable>
          </View>
          {recentOrders.length === 0 ? (
            <EmptyState title={t('memberDashboard.noOrders')} colorScheme={colorScheme} />
          ) : (
            recentOrders.map((o) => (
              <View key={o.orderNo} style={styles.orderRow}>
                <View style={styles.orderMain}>
                  <Text style={styles.orderTitle} numberOfLines={1}>
                    {o.title}
                  </Text>
                  <Text style={styles.orderMeta}>
                    {o.createdAt} · {o.statusText}
                  </Text>
                </View>
                <Text style={styles.orderAmount}>{o.amountText}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
    },
    title: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    body: { padding: rnSpacing.md, gap: rnSpacing.md },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm },
    card: {
      flexBasis: '48%',
      flexGrow: 1,
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: rnRadius.lg,
      padding: rnSpacing.md,
      gap: rnSpacing.xs,
    },
    cardValue: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    cardLabel: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
    },
    bannerText: { fontSize: rnType.body.size, color: tk.text.primary },
    bannerAction: { fontSize: rnType.body.size, color: tk.brandAccent.deep },
    section: {
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      gap: rnSpacing.sm,
    },
    sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionTitle: { fontSize: rnType.subtitle.size, fontWeight: '600', color: tk.text.primary },
    sectionAction: { fontSize: rnType.caption.size, color: tk.brandAccent.deep },
    orderRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    orderMain: { flex: 1, gap: 2 },
    orderTitle: { fontSize: rnType.body.size, color: tk.text.primary },
    orderMeta: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    orderAmount: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
