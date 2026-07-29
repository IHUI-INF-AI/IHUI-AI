import { useMemo } from 'react'
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { RealNameAuthStatus, RealNameAuthItem, RealNameAuthScreenProps } from '../../types'

/** 实名认证共享屏 — props 注入式跨端组件 */
export type { RealNameAuthStatus, RealNameAuthItem, RealNameAuthScreenProps }

const REAL_NAME_STATUS_KEYS: Record<RealNameAuthStatus, string> = {
  unverified: 'realNameAuth.status_unverified',
  pending: 'realNameAuth.status_pending',
  verified: 'realNameAuth.status_verified',
  rejected: 'realNameAuth.status_rejected',
}

export function RealNameAuthScreen({
  t,
  status,
  name,
  idNumber,
  loading,
  submitting,
  error,
  onNameChange,
  onIdNumberChange,
  onSubmit,
  onBack,
  colorScheme = 'light',
}: RealNameAuthScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.back}>{t('common.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('realNameAuth.title')}</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      </View>
    )
  }

  const currentStatus: RealNameAuthStatus = status?.status ?? 'unverified'
  const showForm = currentStatus !== 'verified' && currentStatus !== 'pending'

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('realNameAuth.title')}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.statusLabel}>{t('realNameAuth.status')}</Text>
          <Text style={[styles.statusValue, currentStatus === 'verified' && styles.statusVerified]}>
            {t(REAL_NAME_STATUS_KEYS[currentStatus])}
          </Text>
          {currentStatus === 'verified' ? (
            <Text style={styles.hint}>{t('realNameAuth.verifiedDesc')}</Text>
          ) : (
            <Text style={styles.hint}>{t('realNameAuth.unverifiedDesc')}</Text>
          )}
          {status?.reason ? <Text style={styles.errorText}>{status.reason}</Text> : null}
        </View>
        {showForm ? (
          <View style={styles.card}>
            <Text style={styles.label}>{t('realNameAuth.name')}</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={onNameChange}
              placeholder={t('realNameAuth.namePlaceholder')}
              placeholderTextColor={tk.text.tertiary}
            />
            <Text style={styles.label}>{t('realNameAuth.idNumber')}</Text>
            <TextInput
              style={styles.input}
              value={idNumber}
              onChangeText={onIdNumberChange}
              placeholder={t('realNameAuth.idNumberPlaceholder')}
              placeholderTextColor={tk.text.tertiary}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={onSubmit}
              disabled={submitting}
            >
              <Text style={styles.submitBtnText}>
                {submitting ? t('realNameAuth.submitting') : t('realNameAuth.submit')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    back: { fontSize: 14, color: tk.text.medium },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    body: { padding: 16 },
    card: {
      padding: 16,
      marginBottom: 12,
      borderRadius: 8,
      backgroundColor: tk.surface.light,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    statusLabel: { fontSize: 12, color: tk.text.secondary },
    statusValue: { marginTop: 4, fontSize: 16, fontWeight: '600', color: tk.danger.DEFAULT },
    statusVerified: { color: tk.success.DEFAULT },
    hint: { marginTop: 8, fontSize: 12, color: tk.text.tertiary },
    label: { fontSize: 12, color: tk.text.secondary, marginTop: 8 },
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
    errorText: { fontSize: 12, color: tk.danger.DEFAULT, marginTop: 8 },
    submitBtn: {
      marginTop: 12,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      backgroundColor: tk.success.DEFAULT,
    },
    submitBtnDisabled: { backgroundColor: tk.text.tertiary },
    submitBtnText: { color: tk.surface.light, fontSize: 14, fontWeight: '600' },
    muted: { fontSize: 13, color: tk.text.secondary },
  })
}
