import { useMemo } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { DistributionProduct, DistributionInfo, DistributionScreenProps } from '../../types'

export type { DistributionProduct, DistributionInfo, DistributionScreenProps }

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
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tk.success.DEFAULT} />
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }

  if (error && !info) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
          <Text style={styles.retryBtnText}>{t('distribution.retry')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (!info) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('distribution.empty')}</Text>
      </View>
    )
  }

  const canWithdraw = info.pending >= info.withdrawMin && !withdrawing

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
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
            <Text style={styles.commissionValue}>{(info.commissionRate * 100).toFixed(1)}%</Text>
          </View>
        </View>
      </View>

      <View style={styles.earningsCard}>
        <View style={styles.earningsRow}>
          <View style={styles.earningsItem}>
            <Text style={styles.earningsValue}>{info.totalEarnings}</Text>
            <Text style={styles.earningsLabel}>{t('distribution.totalEarnings')}</Text>
          </View>
          <View style={styles.earningsItem}>
            <Text style={styles.earningsValue}>{info.withdrawn}</Text>
            <Text style={styles.earningsLabel}>{t('distribution.withdrawn')}</Text>
          </View>
          <View style={styles.earningsItem}>
            <Text style={[styles.earningsValue, styles.pendingValue]}>{info.pending}</Text>
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
          {t('distribution.withdrawMin', { amount: info.withdrawMin })}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>{t('distribution.products')}</Text>
      <View style={styles.productsList}>
        {info.products.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.muted}>{t('distribution.empty')}</Text>
          </View>
        ) : (
          info.products.map((item) => (
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
    center: { alignItems: 'center', paddingVertical: 32 },
    muted: { fontSize: 14, color: tk.text.tertiary, marginTop: 8 },
    errorText: { fontSize: 14, color: tk.danger.DEFAULT, textAlign: 'center', marginTop: 8 },
    header: { paddingHorizontal: 10, paddingTop: 48, paddingBottom: 8 },
    backText: { fontSize: 16, color: tk.text.secondary, marginBottom: 8 },
    title: { fontSize: 24, fontWeight: '700', color: tk.text.primary },
    subtitle: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    levelCard: {
      marginHorizontal: 10,
      padding: 14,
      borderRadius: 12,
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
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    earningsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    earningsItem: { alignItems: 'center', flex: 1 },
    earningsValue: { fontSize: 22, fontWeight: '700', color: tk.text.primary },
    pendingValue: { color: tk.success.DEFAULT },
    earningsLabel: { marginTop: 8, fontSize: 11, color: tk.text.tertiary },
    withdrawBtn: {
      marginTop: 14,
      height: 50,
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
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
      borderRadius: 12,
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
    retryBtn: {
      marginTop: 12,
      paddingHorizontal: 10,
      height: 44,
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
    },
    retryBtnText: { color: tk.surface.light, fontSize: 14 },
  })
}
