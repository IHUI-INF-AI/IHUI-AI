import { useMemo } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { ReferrerInfo, ReferrerScreenProps } from '../../types'

export type { ReferrerInfo, ReferrerScreenProps }

/**
 * 推荐人共享屏 — props 注入式跨端组件
 *
 * 平台无关:渲染 header + 当前推荐人卡片 + 绑定表单(若未绑定)。
 * 平台特定(导航 / API 调用)由 wrapper 通过 props 注入。
 */
export function ReferrerScreen({
  t,
  info,
  code,
  loading,
  submitting,
  error,
  success,
  onCodeChange,
  onSubmit,
  onBack,
  colorScheme = 'light',
}: ReferrerScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tk.brand.DEFAULT} />
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('referrer.title')}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.label}>{t('referrer.current')}</Text>
          {info?.referrerCode ? (
            <Text style={styles.value}>{info.referrerName || info.referrerCode}</Text>
          ) : (
            <Text style={styles.muted}>{t('referrer.empty')}</Text>
          )}
          <Text style={styles.desc}>{t('referrer.desc')}</Text>
        </View>
        {info?.referrerCode ? null : (
          <View style={styles.card}>
            <Text style={styles.label}>{t('referrer.codeLabel')}</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={onCodeChange}
              placeholder={t('referrer.codePlaceholder')}
              placeholderTextColor={tk.text.tertiary}
              autoCapitalize="none"
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {success ? <Text style={styles.successText}>{success}</Text> : null}
            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitDisabled]}
              onPress={onSubmit}
              disabled={submitting}
            >
              <Text style={styles.submitText}>
                {submitting ? t('referrer.submitting') : t('referrer.submit')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    center: {
      flex: 1,
      backgroundColor: tk.surface.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 16, color: tk.text.medium },
    title: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    body: { padding: 14 },
    card: {
      padding: 14,
      marginBottom: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    label: { fontSize: 14, color: tk.text.secondary },
    value: { marginTop: 8, fontSize: 18, fontWeight: '600', color: tk.success.DEFAULT },
    desc: { marginTop: 8, fontSize: 14, color: tk.text.tertiary },
    input: {
      marginTop: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: '#f5f5f5',
      borderWidth: 1,
      borderColor: tk.border.light,
      fontSize: 16,
      color: tk.text.primary,
    },
    errorText: { fontSize: 14, color: tk.danger.DEFAULT, marginTop: 8 },
    successText: { fontSize: 14, color: tk.success.DEFAULT, marginTop: 8 },
    submitBtn: {
      marginTop: 12,
      height: 50,
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
    },
    submitDisabled: { backgroundColor: tk.text.tertiary },
    submitText: { color: tk.surface.light, fontSize: 16, fontWeight: '600' },
    muted: { fontSize: 14, color: tk.text.secondary, marginTop: 8 },
  })
}
