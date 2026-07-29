import { useMemo } from 'react'
import { Text, TouchableOpacity, View, StyleSheet, TextInput } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { WithdrawScreenProps } from '../../types'

/** 提现共享屏 — props 注入式跨端组件(表单状态由 wrapper 管理) */
export type { WithdrawScreenProps }

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
}: WithdrawScreenProps) {
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
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
    back: { fontSize: 14, color: tk.text.medium },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    body: { padding: 16 },
    card: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: tk.border.light },
    label: { fontSize: 12, color: tk.text.secondary, marginTop: 8 },
    input: { marginTop: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: tk.border.light, fontSize: 14, color: tk.text.primary },
    errorText: { fontSize: 12, color: tk.danger.DEFAULT, marginTop: 8 },
    successText: { fontSize: 12, color: tk.success.DEFAULT, marginTop: 8 },
    submitBtn: { marginTop: 12, paddingVertical: 12, borderRadius: 8, backgroundColor: tk.brand.DEFAULT, alignItems: 'center' },
    btnDisabled: { backgroundColor: tk.text.tertiary },
    submitText: { color: tk.surface.light, fontSize: 14, fontWeight: '600' },
    hint: { fontSize: 11, color: tk.text.tertiary, marginTop: 8 },
  })
}
