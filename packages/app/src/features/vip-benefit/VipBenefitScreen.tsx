// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'

import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { VipBenefitItem, VipBenefitScreenProps } from '../../types'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState, ScreenSkeleton } from '../../components/ScreenStates'
import { TIERS } from './vip-benefit-tier-catalog'

export type { VipBenefitItem, VipBenefitScreenProps }

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
  onRetry,
  colorScheme = 'light'
}: VipBenefitScreenProps & { onRetry?: () => void }) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return <ScreenSkeleton variant="card" count={4} colorScheme={colorScheme} />
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={onRetry}
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
