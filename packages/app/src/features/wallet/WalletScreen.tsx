// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { WalletBalance, WalletFlowItem, WalletScreenProps } from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { ScreenSkeleton } from '../../components/ScreenStates'

/** 钱包/Props 类型 re-export(单一来源 @ihui/types) */
export type { WalletBalance, WalletScreenProps }

/** opType → i18n 键(未知值按原数字展示) */
const OP_TYPE_KEY: Record<number, string> = {
  1: 'wallet.opType1',
  2: 'wallet.opType2',
  3: 'wallet.opType3',
  4: 'wallet.opType4',
  5: 'wallet.opType5',
}

/** 入账类型(与 web 一致:充值/退款/佣金为正,扣减/过期为负) */
const POSITIVE_OP_TYPES = new Set([1, 4, 5])

/** onFlowsPageChange 契约别名换算页码时的回落页大小(与 web / RN 宿主 PAGE_SIZE 一致) */
const FALLBACK_FLOWS_PAGE_SIZE = 20

/** 分 → 元文本,保留 2 位小数 */
function fenToYuan(fen: number): string {
  return Number.isFinite(fen) ? (fen / 100).toFixed(2) : '—'
}

/**
 * 钱包共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header + 4 个金额卡片(主色/次色区分) + 充值/提现按钮 + 下拉刷新。
 * 平台特定(导航 / API 调用)由 wrapper 通过 props 注入。
 */
export function WalletScreen({
  t,
  balance,
  loading,
  error,
  onRefresh,
  onAction,
  onBack,
  colorScheme = 'light',
  flows,
  onRetryFlows,
  onLoadMoreFlows,
  onLogin,
  loginRequired,
  loginRequiredText,
  onFlowsPageChange,
  onRetry,
}: WalletScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  // 契约别名兼容:旧名优先,未传时回退到 onFlowsPageChange/onRetry/loginRequired 这一组契约名
  const flowsLoginRequired = loginRequired ?? flows?.loginRequired
  const flowsLoginText = loginRequiredText ?? t('wallet.loginRequiredHint')
  const retryFlows = onRetryFlows ?? onRetry
  const moreFlows =
    onLoadMoreFlows ??
    (onFlowsPageChange
      ? () =>
          onFlowsPageChange(Math.floor((flows?.items.length ?? 0) / FALLBACK_FLOWS_PAGE_SIZE) + 1)
      : undefined)

  const cards: Array<{ label: string; value: number | null; tone: 'primary' | 'muted' }> = balance
    ? [
        { label: t('wallet.balance'), value: balance.balance, tone: 'primary' },
        { label: t('wallet.frozen'), value: balance.frozenBalance, tone: 'muted' },
        { label: t('wallet.totalRecharge'), value: balance.totalRecharge, tone: 'primary' },
        { label: t('wallet.totalWithdraw'), value: balance.totalWithdraw, tone: 'muted' },
      ]
    : []

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('wallet.title')}</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={loading && !!balance} onRefresh={onRefresh} />}
      >
        {loading && !balance ? (
          <ScreenSkeleton variant="card" count={4} colorScheme={colorScheme} />
        ) : cards.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.muted}>{t('wallet.loadFailed')}</Text>
          </View>
        ) : (
          cards.map((c) => (
            <View key={c.label} style={styles.card}>
              <Text style={styles.cardLabel}>{c.label}</Text>
              <Text style={[styles.cardValue, c.tone === 'muted' && styles.cardValueMuted]}>
                {c.value !== null && c.value !== undefined ? `¥ ${c.value.toFixed(2)}` : '—'}
              </Text>
            </View>
          ))
        )}

        {onAction && balance ? (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.rechargeBtn}
              onPress={() => onAction('recharge')}
              activeOpacity={0.7}
            >
              <Text style={styles.rechargeBtnText}>{t('tokenValue.rechargeLabel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.withdrawBtn}
              onPress={() => onAction('withdraw')}
              activeOpacity={0.7}
            >
              <Text style={styles.withdrawBtnText}>{t('wallet.withdraw')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {flows ? (
          <View style={styles.flowsSection}>
            <Text style={styles.flowsTitle}>{t('wallet.flowsTitle')}</Text>

            {flowsLoginRequired ? (
              <View style={styles.flowState}>
                <Text style={styles.muted}>{flowsLoginText}</Text>
                {onLogin ? (
                  <TouchableOpacity
                    style={styles.loginBtn}
                    onPress={onLogin}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={t('wallet.goLogin')}
                  >
                    <Text style={styles.loginBtnText}>{t('wallet.goLogin')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : flows.loading ? (
              <View style={styles.flowState}>
                <ActivityIndicator color={tk.text.tertiary} />
                <Text style={styles.muted}>{t('wallet.flowsLoading')}</Text>
              </View>
            ) : flows.error ? (
              <View style={styles.flowState}>
                <Text style={styles.flowErrorText}>{flows.error}</Text>
                {retryFlows ? (
                  <TouchableOpacity
                    style={styles.retryBtn}
                    onPress={retryFlows}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={t('wallet.flowsRetry')}
                  >
                    <Text style={styles.retryText}>{t('wallet.flowsRetry')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : flows.items.length === 0 ? (
              <View style={styles.flowState}>
                <Text style={styles.muted}>{t('wallet.flowsEmpty')}</Text>
              </View>
            ) : (
              flows.items.map((item) => <FlowRow key={item.id} item={item} t={t} styles={styles} />)
            )}

            {!flowsLoginRequired &&
            !flows.loading &&
            !flows.error &&
            flows.items.length > 0 &&
            flows.items.length < flows.total &&
            moreFlows ? (
              <TouchableOpacity
                style={[styles.moreBtn, flows.loadingMore && styles.moreBtnDisabled]}
                onPress={moreFlows}
                disabled={!!flows.loadingMore}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t('wallet.flowsLoadMore')}
              >
                <Text style={styles.moreText}>
                  {flows.loadingMore ? t('wallet.flowsLoading') : t('wallet.flowsLoadMore')} (
                  {flows.items.length}/{flows.total})
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}

interface FlowRowProps {
  item: WalletFlowItem
  t: WalletScreenProps['t']
  styles: ReturnType<typeof createStyles>
}

/** 窄屏卡片行:类型 + 金额(正负色) / 备注 / 时间 / 变动后余额 */
function FlowRow({ item, t, styles }: FlowRowProps) {
  const positive = POSITIVE_OP_TYPES.has(item.opType)
  const typeKey = OP_TYPE_KEY[item.opType]
  return (
    <View style={styles.flowRow}>
      <View style={styles.flowTop}>
        <Text style={styles.flowType}>{typeKey ? t(typeKey) : String(item.opType)}</Text>
        <Text style={[styles.flowAmount, positive ? styles.flowIn : styles.flowOut]}>
          {positive ? '+' : '-'}¥{fenToYuan(Math.abs(item.quantity))}
        </Text>
      </View>
      <Text style={styles.flowMeta} numberOfLines={1}>
        {item.remark && item.remark.length > 0 ? item.remark : t('wallet.flowRemarkEmpty')}
      </Text>
      <Text style={styles.flowMeta}>{item.createdAtText}</Text>
      <Text style={styles.flowMeta}>
        {t('wallet.flowBalanceAfter')}: ¥{fenToYuan(item.balanceAfter)}
      </Text>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.md,
    },
    title: { fontSize: rnType.heading.size, fontWeight: '600', color: tk.text.primary },
    errorText: {
      paddingHorizontal: rnSpacing['sm-loose'],
      fontSize: rnType.body.size,
      color: tk.danger.DEFAULT,
    },
    body: { padding: rnSpacing['sm-loose'] },
    center: { alignItems: 'center', paddingVertical: rnSpacing['5xl'] },
    muted: { fontSize: rnType.body.size, color: tk.text.secondary },
    card: {
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
      marginBottom: rnSpacing.md,
    },
    cardLabel: { fontSize: rnType.body.size, color: tk.text.tertiary },
    cardValue: {
      marginTop: rnSpacing.sm,
      fontSize: 22,
      fontWeight: '700',
      color: tk.text.primary,
    },
    cardValueMuted: { color: tk.text.secondary },
    actions: {
      flexDirection: 'row',
      gap: rnSpacing.md,
      marginTop: rnSpacing.sm,
    },
    rechargeBtn: {
      flex: 1,
      height: 50,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rechargeBtnText: {
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.brand.ctaForeground,
    },
    withdrawBtn: {
      flex: 1,
      height: 44,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
      alignItems: 'center',
      justifyContent: 'center',
    },
    withdrawBtnText: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    flowsSection: { marginTop: rnSpacing['2xl'], gap: rnSpacing.sm },
    flowsTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    flowRow: {
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
      gap: rnSpacing['2xs'],
    },
    flowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    flowType: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    flowAmount: { fontSize: rnType.body.size, fontWeight: '700' },
    flowIn: { color: tk.success.DEFAULT },
    flowOut: { color: tk.danger.DEFAULT },
    flowMeta: { fontSize: rnType.label.size, color: tk.text.secondary },
    flowState: { alignItems: 'center', paddingVertical: rnSpacing.lg, gap: rnSpacing.sm },
    flowErrorText: { fontSize: rnType.label.size, color: tk.danger.DEFAULT, textAlign: 'center' },
    retryBtn: { paddingHorizontal: rnSpacing.md, paddingVertical: rnSpacing.xs },
    retryText: { fontSize: rnType.label.size, fontWeight: '600', color: tk.text.primary },
    loginBtn: {
      height: 40,
      paddingHorizontal: rnSpacing['2xl'],
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loginBtnText: {
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tk.brand.ctaForeground,
    },
    moreBtn: {
      height: 40,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    moreBtnDisabled: { opacity: 0.5 },
    moreText: { fontSize: rnType.label.size, color: tk.text.primary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
