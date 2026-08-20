import { useMemo } from 'react'
import { Text, TouchableOpacity, View, StyleSheet, TextInput } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { WithdrawScreenProps } from '../../types'

/** 提现共享屏 — props 注入式跨端组件(表单状态由 wrapper 管理) */
export type { WithdrawScreenProps }

/**
 * 提现余额可选注入 props(接入点):
 * 真实来源为 @ihui/api-client wallet.getBalance()(GET /api/wallet/balance)的 balance 字段,
 * 由 wrapper 拉取后通过 balance prop 传入。未注入时兜底展示 0.00。
 * TODO(待余额接口):当前 wrapper 未拉取余额,接入 getBalance 后移除兜底。
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
}: WithdrawScreenProps & WithdrawBalanceOptions) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('withdraw.title')}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>{t('withdraw.availableBalance')}</Text>
          <Text style={styles.balanceValue}>{(balance ?? 0).toFixed(2)}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>{t('withdraw.amount')}</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={onAmountChange}
            placeholder={t('withdraw.amountPlaceholder')}
            placeholderTextColor={tk.text.tertiary}
            keyboardType="decimal-pad"
          />
          <Text style={styles.label}>{t('withdraw.bankCard')}</Text>
          <TextInput
            style={styles.input}
            value={bankCardId}
            onChangeText={onBankCardIdChange}
            placeholder={t('withdraw.bankCardPlaceholder')}
            placeholderTextColor={tk.text.tertiary}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {success ? <Text style={styles.successText}>{success}</Text> : null}
          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.btnDisabled]}
            onPress={onSubmit}
            disabled={loading}
          >
            <Text style={styles.submitText}>
              {loading ? t('withdraw.submitting') : t('withdraw.submit')}
            </Text>
          </TouchableOpacity>
          <Text style={styles.hint}>{t('withdraw.feeHint')}</Text>
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
      paddingHorizontal: 10,
      paddingVertical: 12,
      gap: 12,
    },
    back: { fontSize: 16, color: tk.text.medium },
    title: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    body: { padding: 10 },
    balanceCard: {
      padding: 14,
      marginBottom: 12,
      borderRadius: 12,
      backgroundColor: tk.surface.light,
    },
    balanceLabel: { fontSize: 14, color: tk.text.secondary },
    balanceValue: {
      marginTop: 8,
      fontSize: 28,
      fontWeight: '700',
      color: tk.text.primary,
    },
    card: {
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    label: { fontSize: 14, color: tk.text.secondary, marginTop: 8 },
    input: {
      marginTop: 8,
      paddingHorizontal: 14,
      height: 50,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#eaeaea',
      backgroundColor: '#f5f5f5',
      fontSize: 16,
      color: tk.text.primary,
    },
    errorText: { fontSize: 14, color: tk.danger.DEFAULT, marginTop: 8 },
    successText: { fontSize: 14, color: tk.success.DEFAULT, marginTop: 8 },
    submitBtn: {
      marginTop: 12,
      height: 50,
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnDisabled: { backgroundColor: tk.text.tertiary },
    submitText: { color: tk.surface.light, fontSize: 16, fontWeight: '600' },
    hint: { fontSize: 11, color: tk.text.tertiary, marginTop: 8 },
  })
}
