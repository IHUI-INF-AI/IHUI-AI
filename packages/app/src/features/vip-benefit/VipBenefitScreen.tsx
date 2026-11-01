// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { AppIcon } from '@ihui/types'
import {
  Award,
  Cake,
  CalendarCheck,
  Crown,
  Gift,
  Headset,
  Layers,
  Mail,
  Medal,
  Rocket,
  ShoppingBag,
  Sparkles,
  Star,
  Ticket,
  Trophy,
  Truck,
} from 'lucide-react-native'

import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { VipBenefitItem, VipBenefitScreenProps } from '../../types'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

export type { VipBenefitItem, VipBenefitScreenProps }

interface TierBenefit {
  icon: AppIcon
  titleKey: string
  descKey: string
}

interface TierCatalog {
  icon: AppIcon
  nameKey: string
  benefits: readonly TierBenefit[]
}

/**
 * 等级权益目录 —— 与端内 pages/member/benefits 的四档目录逐条对应(档名/权益名/权益说明)。
 * 文案一律取 `member.benefits.tier.*` / `member.benefits.b.*` 键(与端内同一套键、值逐字一致);
 * 图标走 lucide,RN 端不再复制端内那批 PNG 资源。
 */
const TIERS: readonly TierCatalog[] = [
  {
    icon: Star,
    nameKey: 'member.benefits.tier.normal',
    benefits: [
      {
        icon: ShoppingBag,
        titleKey: 'member.benefits.b.discount',
        descKey: 'member.benefits.b.discountD1',
      },
      {
        icon: Sparkles,
        titleKey: 'member.benefits.b.points',
        descKey: 'member.benefits.b.pointsD1',
      },
      { icon: Gift, titleKey: 'member.benefits.b.gift', descKey: 'member.benefits.b.giftD' },
      {
        icon: CalendarCheck,
        titleKey: 'member.benefits.b.sign',
        descKey: 'member.benefits.b.signD',
      },
      { icon: Mail, titleKey: 'member.benefits.b.news', descKey: 'member.benefits.b.newsD' },
    ],
  },
  {
    icon: Medal,
    nameKey: 'member.benefits.tier.silver',
    benefits: [
      {
        icon: ShoppingBag,
        titleKey: 'member.benefits.b.discount',
        descKey: 'member.benefits.b.discountD2',
      },
      {
        icon: Layers,
        titleKey: 'member.benefits.b.pointsMul',
        descKey: 'member.benefits.b.pointsMulD2',
      },
      {
        icon: Cake,
        titleKey: 'member.benefits.b.birthday',
        descKey: 'member.benefits.b.birthdayD',
      },
      {
        icon: Truck,
        titleKey: 'member.benefits.b.shipping',
        descKey: 'member.benefits.b.shippingD2',
      },
      { icon: Ticket, titleKey: 'member.benefits.b.coupon', descKey: 'member.benefits.b.couponD2' },
      {
        icon: CalendarCheck,
        titleKey: 'member.benefits.b.sign',
        descKey: 'member.benefits.b.signD2',
      },
    ],
  },
  {
    icon: Award,
    nameKey: 'member.benefits.tier.gold',
    benefits: [
      {
        icon: ShoppingBag,
        titleKey: 'member.benefits.b.discount',
        descKey: 'member.benefits.b.discountD3',
      },
      {
        icon: Layers,
        titleKey: 'member.benefits.b.pointsMul',
        descKey: 'member.benefits.b.pointsMulD3',
      },
      {
        icon: Cake,
        titleKey: 'member.benefits.b.birthday',
        descKey: 'member.benefits.b.birthdayD3',
      },
      {
        icon: Truck,
        titleKey: 'member.benefits.b.shipping',
        descKey: 'member.benefits.b.shippingD3',
      },
      {
        icon: Headset,
        titleKey: 'member.benefits.b.service',
        descKey: 'member.benefits.b.serviceD',
      },
      { icon: Ticket, titleKey: 'member.benefits.b.coupon', descKey: 'member.benefits.b.couponD3' },
      {
        icon: Rocket,
        titleKey: 'member.benefits.b.preview',
        descKey: 'member.benefits.b.previewD',
      },
    ],
  },
  {
    icon: Crown,
    nameKey: 'member.benefits.tier.diamond',
    benefits: [
      {
        icon: ShoppingBag,
        titleKey: 'member.benefits.b.discount',
        descKey: 'member.benefits.b.discountD4',
      },
      {
        icon: Layers,
        titleKey: 'member.benefits.b.pointsMul',
        descKey: 'member.benefits.b.pointsMulD4',
      },
      {
        icon: Cake,
        titleKey: 'member.benefits.b.birthday',
        descKey: 'member.benefits.b.birthdayD4',
      },
      {
        icon: Truck,
        titleKey: 'member.benefits.b.shipping',
        descKey: 'member.benefits.b.shippingD4',
      },
      {
        icon: Headset,
        titleKey: 'member.benefits.b.service',
        descKey: 'member.benefits.b.serviceD4',
      },
      { icon: Ticket, titleKey: 'member.benefits.b.coupon', descKey: 'member.benefits.b.couponD4' },
      {
        icon: Rocket,
        titleKey: 'member.benefits.b.preview',
        descKey: 'member.benefits.b.previewD4',
      },
      { icon: Trophy, titleKey: 'member.benefits.b.event', descKey: 'member.benefits.b.eventD' },
    ],
  },
]

/**
 * VIP 权益共享屏 — props 注入式跨端组件
 *
 * 平台无关:渲染 header + 权益卡片列表(ScrollView)。
 * 平台特定(导航 / API 调用)由 wrapper 通过 props 注入。
 */
export function VipBenefitScreen({
  t,
  items,
  loading,
  error,
  onBack,
  colorScheme = 'light',
}: VipBenefitScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return <ScreenSkeleton variant="card" count={4} colorScheme={colorScheme} />
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={onBack}
        retryLabel={t('common.back')}
        colorScheme={colorScheme}
      />
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('vipBenefit.title')}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.sectionTitle}>{t('member.benefits.myBenefits')}</Text>
        {items.length === 0 ? (
          <EmptyState
            title={t('member.benefits.empty')}
            actionLabel={t('common.back')}
            onAction={onBack}
            colorScheme={colorScheme}
          />
        ) : (
          items.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.titleRow}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <View style={styles.levelBadge}>
                  <Text style={styles.levelText}>{item.level}</Text>
                </View>
              </View>
              <Text style={styles.cardDesc}>{item.desc}</Text>
            </View>
          ))
        )}
        {/* 等级权益目录:与端内 pages/member/benefits 同一面(列表空态时也渲染,对齐端内阶梯目录常在) */}
        <Text style={[styles.sectionTitle, styles.sectionGap]}>
          {t('member.benefits.tierCatalog')}
        </Text>
        {TIERS.map((tier) => (
          <View key={tier.nameKey} style={styles.tierCard}>
            <View style={styles.tierHead}>
              <tier.icon size={20} color={tk.text.primary} />
              <Text style={styles.tierName}>{t(tier.nameKey)}</Text>
            </View>
            {tier.benefits.map((benefit) => (
              <View key={benefit.descKey} style={styles.benefitRow}>
                <benefit.icon size={16} color={tk.text.secondary} />
                <View style={styles.benefitText}>
                  <Text style={styles.benefitTitle}>{t(benefit.titleKey)}</Text>
                  <Text style={styles.benefitDesc}>{t(benefit.descKey)}</Text>
                </View>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.md,
    },
    body: { padding: rnSpacing.lg },
    title: { ...rnType.heading, color: tk.text.primary },
    card: {
      padding: rnSpacing.lg,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      marginBottom: rnSpacing.md,
      backgroundColor: tk.surface.light,
    },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardTitle: { flex: 1, fontSize: rnType.title.size, fontWeight: '700', color: tk.text.primary },
    levelBadge: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing['2xs'],
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    levelText: { fontSize: rnType.label.size, color: tk.text.primary },
    cardDesc: { marginTop: rnSpacing.sm, ...rnType.body, color: tk.text.secondary },
    sectionTitle: {
      ...rnType.title,
      fontWeight: '700',
      color: tk.text.primary,
      marginBottom: rnSpacing.md,
    },
    sectionGap: { marginTop: rnSpacing.lg },
    tierCard: {
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
      marginBottom: rnSpacing.md,
      overflow: 'hidden',
    },
    tierHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      backgroundColor: tk.surface.muted,
    },
    tierName: { ...rnType.title, fontWeight: '700', color: tk.text.primary },
    benefitRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: rnSpacing.sm,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
    },
    benefitText: { flex: 1, gap: rnSpacing['2xs'] },
    benefitTitle: { ...rnType.body, fontWeight: '500', color: tk.text.primary },
    benefitDesc: { ...rnType.caption, color: tk.text.secondary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
