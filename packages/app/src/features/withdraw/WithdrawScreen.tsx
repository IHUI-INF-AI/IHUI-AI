// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { WithdrawScreenProps } from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { TextField } from '../../components/TextField'
import { resolveWithdrawSegments } from './view-model'

/** 提现共享屏 — props 注入式跨端组件(表单状态由 wrapper 管理) */
export type { WithdrawScreenProps }

/**
 * 提现余额可选注入 props(接入点):
 * 真实来源为 @ihui/api-client wallet.getBalance()(GET /api/wallet/balance)的 balance 字段,
 * 由 wrapper 拉取后通过 balance prop 传入。未注入时兜底展示 0.00。
 */
export interface WithdrawBalanceOptions {
  /** 可提现余额(元),由 wrapper 经 wallet.getBalance() 注入 */
  balance?: number
}

export function WithdrawScreen({
  t,
  amount,
  bankCardId,
  loading,
  error,
  success,
  onAmountChange,
  onBankCardIdChange,
  onSubmit,
  onBack,
  colorScheme = 'light',
  balance,
  methods,
  method,
  onMethodChange,
  accountInfo,
  onAccountInfoChange,
  onFillAll,
  recordsLabel,
  onRecords,
  texts,
  submitting = false,
}: WithdrawScreenProps & WithdrawBalanceOptions) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const tx = texts ?? {}
  const seg = resolveWithdrawSegments({
    methods,
    accountInfo,
    onAccountInfoChange,
    onFillAll,
    recordsLabel,
    onRecords,
  })
  const busy = loading || submitting

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron
          onPress={onBack}
          label={tx.back ?? t('common.back')}
          colorScheme={colorScheme}
        />
        <Text style={styles.title}>{tx.title ?? t('withdraw.title')}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>
            {tx.availableBalance ?? t('withdraw.availableBalance')}
          </Text>
          <Text style={styles.balanceValue}>{(balance ?? 0).toFixed(2)}</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>{tx.amountLabel ?? t('wallet.withdrawAmount')}</Text>
            {seg.showFillAll ? (
              <TouchableOpacity onPress={onFillAll}>
                <Text style={styles.fillAll}>{tx.fillAll ?? '全部提现'}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <TextField
            colorScheme={colorScheme}
            style={styles.input}
            value={amount}
            onChangeText={onAmountChange}
            placeholder={tx.amountPlaceholder ?? t('withdraw.amountPlaceholder')}
            placeholderTextColor={tk.text.tertiary}
            keyboardType="decimal-pad"
          />

          {seg.showMethods && methods ? (
            <>
              <Text style={styles.label}>{tx.methodLabel ?? '提现方式'}</Text>
              <View style={styles.methodRow}>
                {methods.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.methodItem, method === m.id && styles.methodItemActive]}
                    onPress={() => onMethodChange?.(m.id)}
                  >
                    <Text style={[styles.methodText, method === m.id && styles.methodTextActive]}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : null}

          {seg.showAccount ? (
            <>
              <Text style={styles.label}>{tx.accountLabel ?? '收款账户'}</Text>
              <TextField
                colorScheme={colorScheme}
                style={styles.input}
                value={accountInfo ?? ''}
                onChangeText={(text: string) => onAccountInfoChange?.(text)}
                placeholder={tx.accountPlaceholder ?? '请输入收款账户'}
                placeholderTextColor={tk.text.tertiary}
              />
            </>
          ) : null}

          {!seg.showAccount && bankCardId !== undefined && onBankCardIdChange ? (
            <>
              <Text style={styles.label}>{tx.bankCardLabel ?? t('wallet.methodBank')}</Text>
              <TextField
                colorScheme={colorScheme}
                style={styles.input}
                value={bankCardId}
                onChangeText={onBankCardIdChange}
                placeholder={tx.bankCardPlaceholder ?? t('withdraw.bankCardPlaceholder')}
                placeholderTextColor={tk.text.tertiary}
              />
            </>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {success ? <Text style={styles.successText}>{success}</Text> : null}
          <TouchableOpacity
            style={[styles.submitBtn, busy && styles.btnDisabled]}
            onPress={onSubmit}
            disabled={busy}
          >
            <Text style={styles.submitText}>
              {busy
                ? (tx.submitting ?? t('withdraw.submitting'))
                : (tx.submit ?? t('withdraw.submit'))}
            </Text>
          </TouchableOpacity>
          <Text style={styles.hint}>{tx.feeHint ?? t('withdraw.feeHint')}</Text>
          {seg.showRecords ? (
            <TouchableOpacity onPress={onRecords} style={styles.recordsRow}>
              <Text style={styles.recordsText}>{recordsLabel}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
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
    title: { ...rnType.heading, color: tk.text.primary },
    body: { padding: rnSpacing.lg },
    balanceCard: {
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.md,
      marginBottom: rnSpacing.lg,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.light,
    },
    balanceLabel: { ...rnType.body, color: tk.text.secondary },
    balanceValue: {
      marginTop: rnSpacing.xs,
      ...rnType.display,
      color: tk.text.primary,
    },
    card: {
      padding: rnSpacing.lg,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    label: { ...rnType.body, color: tk.text.secondary, marginTop: rnSpacing.sm },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: rnSpacing.sm,
    },
    fillAll: { ...rnType.body, color: tk.brand.DEFAULT },
    methodRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.sm,
    },
    methodItem: {
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.muted,
    },
    methodItemActive: { borderColor: tk.brand.DEFAULT },
    methodText: { ...rnType.body, color: tk.text.secondary },
    methodTextActive: { color: tk.brand.DEFAULT, fontWeight: '600' },
    input: {
      marginTop: rnSpacing.sm,
      paddingHorizontal: rnSpacing.md,
      // 高度 50 是移动端触控目标(iOS HIG ≥44);web 输入框 36-40 属桌面指针形态,平台差异保留
      height: 50,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.muted,
      fontSize: rnType.title.size,
      color: tk.text.primary,
    },
    errorText: { ...rnType.body, color: tk.danger.DEFAULT, marginTop: rnSpacing.xs },
    successText: { ...rnType.body, color: tk.success.DEFAULT, marginTop: rnSpacing.xs },
    submitBtn: {
      marginTop: rnSpacing.xl,
      // 高度 50 是移动端触控目标;web Button 档 lg=40 属桌面形态,平台差异保留
      height: 50,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnDisabled: { backgroundColor: tk.text.tertiary },
    submitText: { ...rnType.title, color: tk.brand.ctaForeground },
    hint: { ...rnType.caption, color: tk.text.tertiary, marginTop: rnSpacing.sm },
    recordsRow: { marginTop: rnSpacing.md, alignItems: 'center' },
    recordsText: { ...rnType.body, color: tk.brand.DEFAULT },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
