import { useMemo, useState } from 'react'
import { ScrollView, Text, TouchableOpacity, View, StyleSheet, TextInput } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { CertVerifyScreenProps } from '../../types'

/** 证书验证共享屏 — props 注入式跨端组件 */
export type { CertVerifyScreenProps }

export function CertVerifyScreen({
  t,
  initialCertNo,
  result,
  loading,
  error,
  onVerify,
  onBack,
  colorScheme = 'light',
}: CertVerifyScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const [certNo, setCertNo] = useState(initialCertNo)

  const canSubmit = certNo.trim().length > 0 && !loading

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>{t('common.back')}</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{t('certVerify.title')}</Text>
      <Text style={styles.label}>{t('certVerify.certNo')}</Text>
      <TextInput
        style={styles.input}
        value={certNo}
        onChangeText={setCertNo}
        placeholder={t('certVerify.placeholder')}
        placeholderTextColor={tk.text.tertiary}
        returnKeyType="search"
        onSubmitEditing={() => canSubmit && onVerify(certNo.trim())}
      />
      <TouchableOpacity
        style={[styles.verifyBtn, !canSubmit && styles.btnDisabled]}
        onPress={() => canSubmit && onVerify(certNo.trim())}
        disabled={!canSubmit}
      >
        <Text style={styles.verifyText}>
          {loading ? t('common.loading') : t('certVerify.verify')}
        </Text>
      </TouchableOpacity>
      {loading ? <Text style={styles.muted}>{t('common.loading')}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {result ? (
        <View style={[styles.resultCard, result.valid ? styles.validCard : styles.invalidCard]}>
          <Text style={[styles.resultTitle, result.valid ? styles.validText : styles.invalidText]}>
            {result.valid ? t('certVerify.valid') : t('certVerify.invalid')}
          </Text>
          {result.valid ? (
            <>
              <Text style={styles.resultName}>{result.title}</Text>
              <Text style={styles.resultLine}>
                {t('certVerify.holder')}: {result.holder}
              </Text>
              <Text style={styles.resultLine}>
                {t('certVerify.issuer')}: {result.issuer}
              </Text>
              <Text style={styles.resultLine}>
                {t('certVerify.issuedAt')}: {result.issuedAt}
              </Text>
            </>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
      paddingHorizontal: 16,
      paddingTop: 48,
      paddingBottom: 32,
    },
    back: { fontSize: 14, color: tk.text.secondary },
    title: {
      marginTop: 8,
      fontSize: 22,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: 12,
    },
    label: { marginTop: 12, fontSize: 12, color: tk.text.secondary },
    input: {
      marginTop: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      fontSize: 14,
      color: tk.text.primary,
    },
    verifyBtn: {
      marginTop: 16,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
    },
    btnDisabled: { backgroundColor: tk.text.tertiary },
    verifyText: { color: tk.surface.light, fontSize: 14, fontWeight: '600' },
    muted: { marginTop: 12, fontSize: 13, color: tk.text.secondary, textAlign: 'center' },
    error: { marginTop: 12, fontSize: 13, color: tk.danger.DEFAULT },
    resultCard: { marginTop: 16, padding: 16, borderRadius: 8, borderWidth: 1 },
    validCard: { borderColor: tk.success.DEFAULT, backgroundColor: tk.success.light },
    invalidCard: { borderColor: tk.danger.DEFAULT, backgroundColor: tk.danger.light },
    resultTitle: { fontSize: 16, fontWeight: '600' },
    validText: { color: tk.success.DEFAULT },
    invalidText: { color: tk.danger.DEFAULT },
    resultName: { marginTop: 8, fontSize: 15, fontWeight: '600', color: tk.text.primary },
    resultLine: { marginTop: 4, fontSize: 13, color: tk.text.medium },
  })
}
