// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useState } from 'react'
import { ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { CertVerifyScreenProps } from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { TextField } from '../../components/TextField'

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
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.title}>{t('certVerify.title')}</Text>
      <Text style={styles.label}>{t('certVerify.certNo')}</Text>
      <TextField
        colorScheme={colorScheme}
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
      paddingHorizontal: 10,
      paddingBottom: rnSpacing['3xl'],
    },
    title: {
      marginTop: rnSpacing.sm,
      fontSize: 22,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: rnSpacing.md,
    },
    label: { marginTop: rnSpacing.md, fontSize: rnType.body.size, color: tk.text.secondary },
    input: {
      marginTop: rnSpacing.sm,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: 14,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      fontSize: rnType.title.size,
      color: tk.text.primary,
      backgroundColor: tk.surface.muted,
    },
    verifyBtn: {
      marginTop: rnSpacing.lg,
      paddingVertical: 15,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
    },
    btnDisabled: { backgroundColor: tk.text.tertiary },
    verifyText: { color: tk.surface.light, fontSize: rnType.title.size, fontWeight: '600' },
    muted: {
      marginTop: rnSpacing.md,
      fontSize: rnType.body.size,
      color: tk.text.secondary,
      textAlign: 'center',
    },
    error: { marginTop: rnSpacing.md, fontSize: rnType.body.size, color: tk.danger.DEFAULT },
    resultCard: {
      marginTop: rnSpacing.lg,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
    },
    validCard: { borderColor: tk.success.DEFAULT, backgroundColor: tk.success.light },
    invalidCard: { borderColor: tk.danger.DEFAULT, backgroundColor: tk.danger.light },
    resultTitle: { fontSize: rnType.subtitle.size, fontWeight: '600' },
    validText: { color: tk.success.DEFAULT },
    invalidText: { color: tk.danger.DEFAULT },
    resultName: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    resultLine: { marginTop: rnSpacing.sm, fontSize: rnType.body.size, color: tk.text.medium },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
