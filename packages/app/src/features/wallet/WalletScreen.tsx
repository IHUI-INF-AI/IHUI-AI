import { useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { WalletBalance, WalletScreenProps } from '../../types'

/** 钱包/Props 类型 re-export(单一来源 @ihui/types) */
export type { WalletBalance, WalletScreenProps }

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
}: WalletScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const cards: Array<{ label: string; value: number; tone: 'primary' | 'muted' }> = balance
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
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('wallet.title')}</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={loading && !!balance} onRefresh={onRefresh} />}
      >
        {loading && !balance ? (
          <View style={styles.center}>
            <Text style={styles.muted}>{t('common.loading')}</Text>
          </View>
        ) : cards.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.muted}>{t('wallet.loadFailed')}</Text>
          </View>
        ) : (
          cards.map((c) => (
            <View key={c.label} style={styles.card}>
              <Text style={styles.cardLabel}>{c.label}</Text>
              <Text style={[styles.cardValue, c.tone === 'muted' && styles.cardValueMuted]}>
                ¥ {c.value.toFixed(2)}
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
              <Text style={styles.rechargeBtnText}>{t('wallet.recharge')}</Text>
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
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 14, color: tk.text.medium },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    errorText: { paddingHorizontal: 16, fontSize: 12, color: tk.danger.DEFAULT },
    body: { padding: 16 },
    center: { alignItems: 'center', paddingVertical: 48 },
    muted: { fontSize: 12, color: tk.text.secondary },
    card: {
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      marginBottom: 8,
    },
    cardLabel: { fontSize: 12, color: tk.text.tertiary },
    cardValue: {
      marginTop: 4,
      fontSize: 20,
      fontWeight: '600',
      color: tk.text.primary,
    },
    cardValueMuted: { color: tk.text.secondary },
    actions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    rechargeBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: tk.success.DEFAULT,
      alignItems: 'center',
    },
    rechargeBtnText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
    withdrawBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      alignItems: 'center',
    },
    withdrawBtnText: { fontSize: 14, fontWeight: '600', color: tk.text.primary },
  })
}
