// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, StyleSheet } from 'react-native'
import { getTokens, tokens as baseTokens, type AppThemeTokens } from '../../theme/tokens'
import type { VipLevelItem2, VipMembershipInfo, VipScreenProps } from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

/** VIP/Props 类型 re-export(单一来源 @ihui/types) */
export type { VipLevelItem2, VipMembershipInfo, VipScreenProps }

/** VIP 金色主题(对齐 Uniapp vip/index.vue 行 152/214/258 的 #FFD700 金色 + 深字 #1F2937)
 *  模块级常量无法访问组件内主题 tk → 用基础静态 token(vip.gold / gray.800 明暗同值) */
const VIP_GOLD = baseTokens.vip.gold
const VIP_GOLD_TEXT = baseTokens.gray['800']

/**
 * VIP 共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header + 当前会员卡(emerald bg) + VIP 等级列表(购买按钮 loading/disabled 状态)
 * + 下拉刷新。
 * 平台特定(导航 / API 调用 / 日期格式化 / toast 提示)由 wrapper 通过 props 注入。
 */
export function VipScreen({
  t,
  levels,
  membership,
  loading,
  refreshing,
  error,
  toast,
  purchasingId,
  onRefresh,
  onPurchase,
  onBack,
  colorScheme = 'light',
}: VipScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return <ScreenSkeleton variant="card" count={3} colorScheme={colorScheme} />
  }

  if (error && levels.length === 0) {
    return (
      <ErrorState
        message={error}
        onRetry={onRefresh}
        retryLabel={t('vip.retry')}
        colorScheme={colorScheme}
      />
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.body}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('vip.title')}</Text>
        <Text style={styles.subtitle}>{t('vip.subtitle')}</Text>
      </View>

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {toast ? (
        <View style={styles.toastBar}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      {membership && membership.isActive ? (
        <View style={styles.membershipCard}>
          <Text style={styles.membershipLabel}>{t('vip.currentLevel')}</Text>
          <Text style={styles.membershipLevel}>{membership.levelName}</Text>
          <View style={styles.membershipMeta}>
            <Text style={styles.membershipMetaText}>
              {t('vip.expireAt')}:{membership.expireTime}
            </Text>
            <Text style={styles.membershipMetaText}>
              {t('vip.daysRemaining', { count: membership.daysRemaining })}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.levelsSection}>
        <Text style={styles.levelsTitle}>{t('vip.levelsTitle')}</Text>
        {levels.length === 0 ? (
          <EmptyState title={t('vip.empty')} colorScheme={colorScheme} />
        ) : (
          levels.map((level) => {
            const isCurrent = membership?.level === level.levelValue
            const isPurchasing = purchasingId === level.id
            const canPurchase = !isCurrent && level.status === 1
            const benefitsCount = level.benefits ? Object.keys(level.benefits).length : 0
            return (
              <View key={level.id} style={styles.cardSpacing}>
                <View style={styles.card}>
                  <View style={styles.cardHead}>
                    <Text style={styles.cardLevelName}>{level.levelName}</Text>
                    {isCurrent ? (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>{t('vip.currentBadge')}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={styles.durationText}>
                      {t('vip.duration', { days: level.durationDays })}
                    </Text>
                    <Text style={styles.priceText}>¥ {level.price.toFixed(2)}</Text>
                  </View>
                  {benefitsCount > 0 ? (
                    <Text style={styles.benefitsText}>
                      {t('vip.benefitsCount', { count: benefitsCount })}
                    </Text>
                  ) : null}
                  {canPurchase ? (
                    <TouchableOpacity
                      style={[styles.purchaseBtn, isPurchasing && styles.purchaseBtnDisabled]}
                      onPress={() => onPurchase(level)}
                      disabled={isPurchasing}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.purchaseBtnText}>
                        {isPurchasing ? t('common.loading') : t('vip.purchase')}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            )
          })
        )}
      </View>
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    body: { paddingBottom: rnSpacing['3xl'] },
    header: { paddingHorizontal: rnSpacing.lg, paddingBottom: rnSpacing.sm },
    title: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.display.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    subtitle: { marginTop: rnSpacing.xs, fontSize: rnType.body.size, color: tk.text.secondary },
    errorBar: { paddingHorizontal: rnSpacing.lg, paddingVertical: rnSpacing.sm },
    errorText: { fontSize: rnType.body.size, color: tk.danger.DEFAULT },
    toastBar: { paddingHorizontal: rnSpacing.lg, paddingVertical: rnSpacing.sm },
    toastText: { fontSize: rnType.label.size, color: tk.success.deepText },
    membershipCard: {
      marginHorizontal: rnSpacing.lg,
      marginTop: rnSpacing.lg,
      padding: 14,
      borderRadius: rnRadius.lg,
      // 对齐 uniapp vip/index.vue .vip-page 深色渐变(#0F1623→#1F2937),用纯色 #1F2937 近似
      backgroundColor: VIP_GOLD_TEXT,
    },
    membershipLabel: { fontSize: rnType.body.size, color: 'rgba(255,255,255,0.8)' },
    membershipLevel: {
      marginTop: rnSpacing.xs,
      fontSize: rnType.heading.size,
      fontWeight: '600',
      color: tk.surface.light,
    },
    membershipMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: rnSpacing.sm,
    },
    membershipMetaText: { fontSize: rnType.label.size, color: 'rgba(255,255,255,0.7)' },
    levelsSection: {
      paddingHorizontal: 10,
      marginTop: rnSpacing.lg,
      paddingBottom: rnSpacing['3xl'],
    },
    levelsTitle: {
      marginBottom: rnSpacing.md,
      fontSize: rnType.heading.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    cardSpacing: { marginBottom: rnSpacing.md },
    card: {
      padding: 14,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardLevelName: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    currentBadge: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadius.md,
      backgroundColor: VIP_GOLD,
    },
    currentBadgeText: { fontSize: rnType.label.size, fontWeight: '600', color: VIP_GOLD_TEXT },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginTop: rnSpacing.sm,
    },
    durationText: { fontSize: rnType.label.size, color: tk.text.secondary },
    priceText: { fontSize: rnType.display.size, fontWeight: '700', color: VIP_GOLD },
    benefitsText: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.label.size,
      color: tk.text.secondary,
    },
    purchaseBtn: {
      marginTop: rnSpacing.md,
      height: 50,
      borderRadius: rnRadius.sm,
      backgroundColor: VIP_GOLD,
      alignItems: 'center',
      justifyContent: 'center',
    },
    purchaseBtnDisabled: { opacity: 0.6 },
    purchaseBtnText: { fontSize: rnType.title.size, fontWeight: '700', color: VIP_GOLD_TEXT },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
