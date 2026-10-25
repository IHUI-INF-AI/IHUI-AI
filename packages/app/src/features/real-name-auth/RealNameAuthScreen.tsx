// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { RealNameAuthStatus, RealNameAuthItem, RealNameAuthScreenProps } from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { TextField } from '../../components/TextField'
import { ScreenSkeleton } from '../../components/ScreenStates'

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
          <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
          <Text style={styles.title}>{t('realNameAuth.title')}</Text>
        </View>
        <ScreenSkeleton variant="list" count={4} colorScheme={colorScheme} />
      </View>
    )
  }

  const currentStatus: RealNameAuthStatus = status?.status ?? 'unverified'
  const showForm = currentStatus !== 'verified' && currentStatus !== 'pending'

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
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
            <TextField
              colorScheme={colorScheme}
              style={styles.input}
              value={name}
              onChangeText={onNameChange}
              placeholder={t('realNameAuth.namePlaceholder')}
              placeholderTextColor={tk.text.tertiary}
            />
            <Text style={styles.label}>{t('realNameAuth.idNumber')}</Text>
            <TextField
              colorScheme={colorScheme}
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.md,
    },
    title: { fontSize: rnType.heading.size, fontWeight: '700', color: tk.text.primary },
    body: { padding: 14 },
    card: {
      padding: 14,
      marginBottom: rnSpacing.md,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.light,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    statusLabel: { fontSize: rnType.body.size, color: tk.text.secondary },
    statusValue: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.subtitle.size,
      fontWeight: '600',
      color: tk.danger.DEFAULT,
    },
    statusVerified: { color: tk.success.DEFAULT },
    hint: { marginTop: rnSpacing.sm, fontSize: rnType.body.size, color: tk.text.tertiary },
    label: { fontSize: rnType.body.size, color: tk.text.secondary, marginTop: rnSpacing.sm },
    input: {
      marginTop: rnSpacing.sm,
      paddingHorizontal: rnSpacing.md,
      height: 50,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.muted,
      fontSize: rnType.title.size,
      color: tk.text.primary,
    },
    errorText: { fontSize: rnType.body.size, color: tk.danger.DEFAULT, marginTop: rnSpacing.sm },
    submitBtn: {
      marginTop: rnSpacing.md,
      height: 50,
      justifyContent: 'center',
      borderRadius: rnRadius.sm,
      alignItems: 'center',
      backgroundColor: tk.brand.cta,
    },
    submitBtnDisabled: { backgroundColor: tk.text.tertiary },
    submitBtnText: {
      color: tk.brand.ctaForeground,
      fontSize: rnType.title.size,
      fontWeight: '600',
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
