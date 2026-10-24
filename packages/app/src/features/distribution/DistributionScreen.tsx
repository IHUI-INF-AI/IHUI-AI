// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { DistributionProduct, DistributionInfo, DistributionScreenProps } from '../../types'

import { rnRadius } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

export type { DistributionProduct, DistributionInfo, DistributionScreenProps }

/** 后端金额以「分」存储,换算为元(两位小数) */
function yuan(cents: number): string {
  return Number.isFinite(cents) ? (cents / 100).toFixed(2) : '0.00'
}

/**
 * 分销共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header(返回 + 标题 + 副标题)+ 错误提示 + loading 态
 * + 等级卡(等级 + 佣金率)+ 收益卡(累计/已提/待提 + 提现按钮)+ 商品列表。
 * 平台特定(导航 / API 调用 / Alert 弹窗)由 wrapper 通过 props 注入。
 */
export function DistributionScreen({
  t,
  info,
  loading,
  refreshing,
  error,
  withdrawing,
  onRefresh,
  onWithdraw,
  onBack,
  colorScheme = 'light',
}: DistributionScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return <ScreenSkeleton variant="card" count={3} colorScheme={colorScheme} />
  }

  if (error && !info) {
    return (
      <ErrorState
        message={error}
        onRetry={onRefresh}
        retryLabel={t('distribution.retry')}
        colorScheme={colorScheme}
      />
    )
  }

  if (!info) {
    return <EmptyState title={t('distribution.empty')} colorScheme={colorScheme} />
  }

  const canWithdraw = info.pendingCommission >= (info.withdrawMin ?? 0) && !withdrawing

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('distribution.title')}</Text>
        <Text style={styles.subtitle}>{t('distribution.subtitle')}</Text>
      </View>

      <View style={styles.levelCard}>
        <View style={styles.levelRow}>
          <View>
            <Text style={styles.levelLabel}>{t('distribution.level')}</Text>
            <Text style={styles.levelValue}>{info.level}</Text>
          </View>
          <View style={styles.commissionBox}>
            <Text style={styles.commissionLabel}>{t('distribution.commissionRate')}</Text>
            <Text style={styles.commissionValue}>
              {info.commissionRate !== undefined
                ? `${(info.commissionRate * 100).toFixed(1)}%`
                : '—'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.earningsCard}>
        <View style={styles.earningsRow}>
          <View style={styles.earningsItem}>
            <Text style={styles.earningsValue}>{yuan(info.totalCommission)}</Text>
            <Text style={styles.earningsLabel}>{t('distribution.totalEarnings')}</Text>
          </View>
          <View style={styles.earningsItem}>
            <Text style={styles.earningsValue}>{yuan(info.withdrawnCommission)}</Text>
            <Text style={styles.earningsLabel}>{t('distribution.withdrawn')}</Text>
          </View>
          <View style={styles.earningsItem}>
            <Text style={[styles.earningsValue, styles.pendingValue]}>
              {yuan(info.pendingCommission)}
            </Text>
            <Text style={styles.earningsLabel}>{t('distribution.pending')}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.withdrawBtn, !canWithdraw && styles.withdrawBtnDisabled]}
          onPress={onWithdraw}
          disabled={!canWithdraw}
        >
          <Text style={styles.withdrawBtnText}>
            {withdrawing ? t('common.loading') : t('distribution.withdrawBtn')}
          </Text>
        </TouchableOpacity>
        <Text style={styles.withdrawHint}>
          {t('distribution.withdrawMin', { amount: yuan(info.withdrawMin ?? 0) })}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>{t('distribution.products')}</Text>
      <View style={styles.productsList}>
        {(info.products ?? []).length === 0 ? (
          <EmptyState title={t('distribution.empty')} colorScheme={colorScheme} />
        ) : (
          (info.products ?? []).map((item) => (
            <View key={item.id} style={styles.productCard}>
              <Text style={styles.productTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <View style={styles.productMeta}>
                <Text style={styles.productPrice}>¥{item.salePrice}</Text>
                <Text style={styles.productCommission}>
                  {t('distribution.commission')}: ¥{item.commission}
                </Text>
                <Text style={styles.productSales}>
                  {t('distribution.sales', { count: item.sales })}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    errorText: { fontSize: 14, color: tk.danger.DEFAULT, textAlign: 'center', marginTop: 8 },
    header: { paddingHorizontal: 10, paddingBottom: 8 },
    title: { fontSize: 24, fontWeight: '700', color: tk.text.primary },
    subtitle: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    levelCard: {
      marginHorizontal: 10,
      padding: 14,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.success.light,
    },
    levelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    levelLabel: { fontSize: 11, color: tk.success.deepText },
    levelValue: { marginTop: 8, fontSize: 20, fontWeight: '700', color: tk.success.DEFAULT },
    commissionBox: { alignItems: 'flex-end' },
    commissionLabel: { fontSize: 11, color: tk.success.deepText },
    commissionValue: { marginTop: 8, fontSize: 20, fontWeight: '700', color: tk.success.DEFAULT },
    earningsCard: {
      marginHorizontal: 10,
      marginTop: 12,
      padding: 14,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    // 等分读数格:放不下就整格换行,绝不把读数折成两行(docs/UI_GUIDELINES.md §13.4)。
    // 读数 22px,最坏「¥99,999.99」(10 字符 × 22 × 0.55 = 121px)⇒ minWidth 128。
    earningsRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
    earningsItem: { alignItems: 'center', flex: 1, minWidth: 128 },
    earningsValue: { fontSize: 22, fontWeight: '700', color: tk.text.primary },
    pendingValue: { color: tk.success.DEFAULT },
    earningsLabel: { marginTop: 8, fontSize: 11, color: tk.text.tertiary },
    withdrawBtn: {
      marginTop: 14,
      height: 50,
      justifyContent: 'center',
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
    },
    withdrawBtnDisabled: { backgroundColor: tk.border.light },
    withdrawBtnText: { fontSize: 14, fontWeight: '600', color: tk.surface.light },
    withdrawHint: { marginTop: 8, fontSize: 11, color: tk.text.tertiary, textAlign: 'center' },
    sectionTitle: {
      paddingHorizontal: 10,
      paddingTop: 16,
      paddingBottom: 8,
      fontSize: 16,
      fontWeight: '600',
      color: tk.text.primary,
    },
    productsList: { marginHorizontal: 10, marginBottom: 24 },
    productCard: {
      padding: 14,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      marginBottom: 8,
      backgroundColor: tk.surface.bg,
    },
    productTitle: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    productMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
      gap: 8,
      flexWrap: 'wrap',
    },
    productPrice: { fontSize: 14, fontWeight: '600', color: tk.success.DEFAULT },
    productCommission: { fontSize: 11, color: tk.text.secondary },
    productSales: { fontSize: 11, color: tk.text.tertiary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
