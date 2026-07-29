import { useMemo } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { IdentityVerifyStatus, IdentityVerifyScreenProps } from '../../types'

export type { IdentityVerifyStatus, IdentityVerifyScreenProps }

const STATUS_KEY: Record<IdentityVerifyStatus, string> = {
  unverified: 'identityVerify.status_unverified',
  pending: 'identityVerify.status_pending',
  verified: 'identityVerify.status_verified',
  rejected: 'identityVerify.status_rejected',
}

/**
 * 实名认证共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header + 认证状态卡 + 上传占位(身份证正/反/自拍)+ 提交按钮。
 * 真实上传由 wrapper 实现(原 mobile-rn 也仅是占位 + 号)。
 * 平台特定(导航/API)由 wrapper 注入。
 */
export function IdentityVerifyScreen({
  t,
  status,
  reason,
  loading,
  submitting,
  error,
  onSubmit,
  onBack,
  colorScheme = 'light',
}: IdentityVerifyScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tk.success.DEFAULT} />
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }

  const items: Array<{ key: string; desc: string }> = [
    { key: 'front', desc: t('identityVerify.uploadFront') },
    { key: 'back', desc: t('identityVerify.uploadBack') },
    { key: 'selfie', desc: t('identityVerify.uploadSelfie') },
  ]

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('identityVerify.title')}</Text>
      </View>
      <ScrollView style={styles.body} contentContainerStyle={{ padding: 16 }}>
        <View style={styles.card}>
          <Text style={styles.subtitle}>{t('identityVerify.subtitle')}</Text>
          <Text style={[styles.status, status === 'verified' && styles.statusOk]}>
            {t(STATUS_KEY[status])}
          </Text>
          {reason ? <Text style={styles.errorText}>{reason}</Text> : null}
        </View>
        {status !== 'verified' && status !== 'pending' ? (
          <View style={styles.card}>
            {items.map((item) => (
              <View key={item.key} style={styles.uploadItem}>
                <Text style={styles.label}>{item.desc}</Text>
                <View style={styles.uploadBtn}>
                  <Text style={styles.uploadBtnText}>+</Text>
                </View>
              </View>
            ))}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={onSubmit}
              disabled={submitting}
            >
              <Text style={styles.submitBtnText}>
                {submitting ? t('identityVerify.submitting') : t('identityVerify.submit')}
              </Text>
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
    center: {
      flex: 1,
      backgroundColor: tk.surface.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 14, color: tk.text.medium },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    body: { flex: 1 },
    card: {
      padding: 12,
      marginBottom: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    subtitle: { fontSize: 12, color: tk.text.secondary },
    status: { marginTop: 6, fontSize: 14, fontWeight: '600', color: tk.danger.DEFAULT },
    statusOk: { color: tk.success.DEFAULT },
    uploadItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 10,
    },
    label: { fontSize: 12, color: tk.text.medium },
    uploadBtn: {
      width: 48,
      height: 48,
      borderRadius: 8,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    uploadBtnText: { fontSize: 24, color: tk.text.tertiary },
    errorText: { fontSize: 12, color: tk.danger.DEFAULT, marginTop: 8 },
    submitBtn: {
      marginTop: 12,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: tk.success.DEFAULT,
      alignItems: 'center',
    },
    submitBtnDisabled: { opacity: 0.5 },
    submitBtnText: { color: tk.surface.light, fontSize: 14, fontWeight: '600' },
    muted: { fontSize: 13, color: tk.text.secondary },
  })
}
