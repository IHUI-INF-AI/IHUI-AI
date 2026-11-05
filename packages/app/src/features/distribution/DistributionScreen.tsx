// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Wallet } from 'lucide-react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type {
  DistributionProduct,
  DistributionInfo,
  DistributionScreenProps,
  DistributionOverviewCard,
  DistributionEarningsTab,
  DistributionEarningsItem,
  DistributionEarningsCard,
  DistributionServiceFloat,
} from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { formatPrice } from '@ihui/shared/utils'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

export type {
  DistributionProduct,
  DistributionInfo,
  DistributionScreenProps,
  DistributionOverviewCard,
  DistributionEarningsTab,
  DistributionEarningsItem,
  DistributionEarningsCard,
  DistributionServiceFloat,
}

/**
 * 分销共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header(返回 + 标题 + 副标题)+ 错误提示 + loading 态
 * + 等级卡(等级 + 佣金率)+ 收益卡(累计/已提/待提 + 提现按钮)+ 商品列表。
 * 平台特定(导航 / API 调用 / Alert 弹窗)由 wrapper 通过 props 注入。
 *
 * 批 5(2026-11-05)补三段**全可选**变体,缺省不渲染(旧渲染逐字不变):
 *   · overviewCard —— 分销总览(头像 + 昵称 + 身份 + 公司名),小程序页与 RN 容器各自传真值;
 *   · earningsCard —— 收益卡(日/月/总 Tab + 三列 + 可选底排),Tab 点击只回传 key;
 *   · serviceFloat —— 分佣浮标(绝对定位),点击走宿主注入的 onPress。
 * 本文件不得出现任何平台导航或客服 API(平台特定交互一律由宿主回调注入)。
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
  rates = [],
  onRetry,
  colorScheme = 'light',
  overviewCard,
  earningsCard,
  serviceFloat,
}: DistributionScreenProps & { onRetry?: () => void }) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return <ScreenSkeleton variant="card" count={3} colorScheme={colorScheme} />
  }

  if (error && !info) {
    return (
      <ErrorState
        message={error}
        onRetry={onRetry}
        retryLabel={t('distribution.retry')}
        colorScheme={colorScheme}
      />
    )
  }

  if (!info) {
    return <EmptyState title={t('distribution.empty')} colorScheme={colorScheme} />
  }

  const canWithdraw = info.pendingCommission >= (info.withdrawMin ?? 0) && !withdrawing
  const overviewInitial = (overviewCard?.nickname ?? 'U').charAt(0) || 'U'

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
          <Text style={styles.title}>{t('distribution.title')}</Text>
          <Text style={styles.subtitle}>{t('distribution.subtitle')}</Text>
        </View>

        {overviewCard ? (
          <View style={styles.overviewCard}>
            <View style={styles.overviewAvatar}>
              {overviewCard.avatar ? (
                <Image source={{ uri: overviewCard.avatar }} style={styles.overviewAvatarImg} />
              ) : (
                <Text style={styles.overviewAvatarText}>{overviewInitial}</Text>
              )}
            </View>
            <View style={styles.overviewInfo}>
              <Text style={styles.overviewName}>{overviewCard.nickname}</Text>
              {overviewCard.identity ? (
                <Text style={styles.overviewIdentity}>{overviewCard.identity}</Text>
              ) : null}
              {overviewCard.companyName ? (
                <Text style={styles.overviewCompany}>{overviewCard.companyName}</Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {earningsCard ? (
          <View style={styles.earningsTabsCard}>
            <View style={styles.earningsTabs}>
              {earningsCard.tabs.map((tab) => (
                <Pressable
                  key={tab.key}
                  style={[
                    styles.earningsTab,
                    earningsCard.activeTab === tab.key ? styles.earningsTabActive : null,
                  ]}
                  onPress={() => earningsCard.onSelectTab(tab.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: earningsCard.activeTab === tab.key }}
                >
                  <Text
                    style={[
                      styles.earningsTabText,
                      earningsCard.activeTab === tab.key ? styles.earningsTabTextActive : null,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.earningsItems}>
              {earningsCard.items.map((item) => (
                <View key={item.label} style={styles.earningsItem}>
                  <Text
                    style={[
                      styles.earningsItemValue,
                      item.tone === 'primary' ? styles.earningsItemPrimary : null,
                      item.tone === 'warning' ? styles.earningsItemWarning : null,
                    ]}
                  >
                    {item.value}
                  </Text>
                  <Text style={styles.earningsItemLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
            {earningsCard.footerItems?.length ? (
              <View style={styles.earningsFooter}>
                {earningsCard.footerItems.map((item) => (
                  <View key={item.label} style={styles.earningsItem}>
                    <Text style={styles.earningsFooterValue}>{item.value}</Text>
                    <Text style={styles.earningsItemLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

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
              <Text style={styles.earningsValue}>{formatPrice(info.totalCommission)}</Text>
              <Text style={styles.earningsLabel}>{t('distribution.totalEarnings')}</Text>
            </View>
            <View style={styles.earningsItem}>
              <Text style={styles.earningsValue}>{formatPrice(info.withdrawnCommission)}</Text>
              <Text style={styles.earningsLabel}>{t('distribution.withdrawn')}</Text>
            </View>
            <View style={styles.earningsItem}>
              <Text style={[styles.earningsValue, styles.pendingValue]}>
                {formatPrice(info.pendingCommission)}
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
            {t('distribution.withdrawMin', { amount: formatPrice(info.withdrawMin ?? 0) })}
          </Text>
        </View>

        {/* 分佣比例(真值来自 GET /distribution/commission-rates;无值如实给空态,不补默认档位) */}
        <View style={styles.ratesCard}>
          <Text style={styles.ratesTitle}>{t('earnCommission.rateTitle')}</Text>
          {rates.length === 0 ? (
            <Text style={styles.ratesEmpty}>{t('earnCommission.rateEmpty')}</Text>
          ) : (
            rates.map((row) => (
              <View key={row.level} style={styles.rateRow}>
                <Text style={styles.rateLevel} numberOfLines={1}>
                  {row.level}
                </Text>
                <Text style={styles.rateValue}>{row.rate}</Text>
              </View>
            ))
          )}
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

      {serviceFloat ? (
        <Pressable
          style={styles.serviceFloat}
          onPress={serviceFloat.onPress}
          accessibilityRole="button"
          accessibilityLabel={serviceFloat.label}
        >
          <Wallet size={18} color={tk.surface.light} />
          <View style={styles.serviceFloatInfo}>
            <Text style={styles.serviceFloatLabel}>{serviceFloat.label}</Text>
            <Text style={styles.serviceFloatAmount}>{formatPrice(serviceFloat.amount)}</Text>
          </View>
        </Pressable>
      ) : null}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: tk.surface.bg },
    container: { flex: 1, backgroundColor: tk.surface.bg },
    overviewCard: {
      marginHorizontal: rnSpacing['sm-loose'],
      marginTop: rnSpacing.sm,
      padding: rnSpacing['md-loose'],
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
    },
    overviewAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    overviewAvatarImg: { width: 48, height: 48 },
    overviewAvatarText: {
      fontSize: rnType.title.size,
      fontWeight: '700',
      color: tk.surface.light,
    },
    overviewInfo: { flex: 1, gap: 2 },
    overviewName: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    overviewIdentity: { fontSize: rnType.caption.size, color: tk.text.secondary },
    overviewCompany: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    earningsTabsCard: {
      marginHorizontal: rnSpacing['sm-loose'],
      marginTop: rnSpacing.sm,
      padding: rnSpacing['md-loose'],
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    earningsTabs: { flexDirection: 'row', gap: rnSpacing.sm },
    earningsTab: {
      paddingVertical: rnSpacing.sm,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.bg,
    },
    earningsTabActive: { backgroundColor: tk.brand.cta },
    earningsTabText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    earningsTabTextActive: { color: tk.surface.light, fontWeight: '600' },
    earningsItems: { flexDirection: 'row', marginTop: rnSpacing.md },
    earningsItemValue: { fontSize: rnType.heading.size, fontWeight: '700', color: tk.text.primary },
    earningsItemPrimary: { color: tk.brand.cta },
    earningsItemWarning: { color: tk.success.DEFAULT },
    earningsItemLabel: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
    },
    earningsFooter: {
      flexDirection: 'row',
      marginTop: rnSpacing.md,
      paddingTop: rnSpacing.sm,
      borderTopWidth: 1,
      borderTopColor: tk.border.light,
    },
    earningsFooterValue: {
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    serviceFloat: {
      position: 'absolute',
      right: rnSpacing['md-loose'],
      bottom: rnSpacing['2xl'],
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing.sm,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.brand.cta,
      shadowColor: tk.text.primary,
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    serviceFloatInfo: { gap: 1 },
    serviceFloatLabel: { fontSize: rnType.caption.size, color: tk.surface.light },
    serviceFloatAmount: {
      fontSize: rnType.body.size,
      fontWeight: '700',
      color: tk.surface.light,
    },
    errorText: {
      fontSize: rnType.body.size,
      color: tk.danger.DEFAULT,
      textAlign: 'center',
      marginTop: rnSpacing.sm,
    },
    header: { paddingHorizontal: rnSpacing['sm-loose'], paddingBottom: rnSpacing.sm },
    title: { fontSize: rnType.display.size, fontWeight: '700', color: tk.text.primary },
    subtitle: { marginTop: rnSpacing.sm, fontSize: rnType.body.size, color: tk.text.secondary },
    levelCard: {
      marginHorizontal: rnSpacing['sm-loose'],
      padding: rnSpacing['md-loose'],
      borderRadius: rnRadius.lg,
      backgroundColor: tk.success.light,
    },
    levelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    levelLabel: { fontSize: rnType.caption.size, color: tk.success.deepText },
    levelValue: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.heading.size,
      fontWeight: '700',
      color: tk.success.DEFAULT,
    },
    commissionBox: { alignItems: 'flex-end' },
    commissionLabel: { fontSize: rnType.caption.size, color: tk.success.deepText },
    commissionValue: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.heading.size,
      fontWeight: '700',
      color: tk.success.DEFAULT,
    },
    earningsCard: {
      marginHorizontal: rnSpacing['sm-loose'],
      marginTop: rnSpacing.md,
      padding: rnSpacing['md-loose'],
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    earningsRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
    earningsItem: { alignItems: 'center', flex: 1, minWidth: 88 },
    earningsValue: { fontSize: rnType.heading.size, fontWeight: '700', color: tk.text.primary },
    pendingValue: { color: tk.success.DEFAULT },
    earningsLabel: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
    },
    withdrawBtn: {
      marginTop: rnSpacing['md-loose'],
      height: 50,
      justifyContent: 'center',
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
    },
    withdrawBtnDisabled: { backgroundColor: tk.border.light },
    withdrawBtnText: { fontSize: rnType.body.size, fontWeight: '600', color: tk.surface.light },
    withdrawHint: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
      textAlign: 'center',
    },
    ratesCard: {
      marginHorizontal: rnSpacing['sm-loose'],
      marginTop: rnSpacing.md,
      padding: rnSpacing['md-loose'],
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    ratesTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    rateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: rnSpacing.sm,
      gap: rnSpacing.sm,
    },
    rateLevel: { flex: 1, fontSize: rnType.body.size, color: tk.text.secondary },
    rateValue: { fontSize: rnType.title.size, fontWeight: '700', color: tk.success.DEFAULT },
    ratesEmpty: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
    },
    sectionTitle: {
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingTop: rnSpacing.lg,
      paddingBottom: rnSpacing.sm,
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    productsList: { marginHorizontal: rnSpacing['sm-loose'], marginBottom: rnSpacing['2xl'] },
    productCard: {
      padding: rnSpacing['md-loose'],
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      marginBottom: rnSpacing.sm,
      backgroundColor: tk.surface.bg,
    },
    productTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    productMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: rnSpacing.sm,
      gap: rnSpacing.sm,
      flexWrap: 'wrap',
    },
    productPrice: { fontSize: rnType.body.size, fontWeight: '600', color: tk.success.DEFAULT },
    productCommission: { fontSize: rnType.caption.size, color: tk.text.secondary },
    productSales: { fontSize: rnType.caption.size, color: tk.text.tertiary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
