import { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { QrCodeItem, QrCodeScreenProps } from '../../types'

/** 二维码共享屏 — props 注入式跨端组件 */
export type { QrCodeItem, QrCodeScreenProps }

export function QrCodeScreen({
  t,
  info,
  loading,
  error,
  onShare,
  onBack,
  colorScheme = 'light',
}: QrCodeScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.back}>{t('common.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('qrCode.title')}</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      </View>
    )
  }

  if (error || !info) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.back}>{t('common.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('qrCode.title')}</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error || t('common.empty')}</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('qrCode.title')}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.card}>
          <View style={styles.qrBox}>
            <Text style={styles.qrPlaceholder}>QR</Text>
          </View>
          <Text style={styles.tip}>{t('qrCode.scanTip')}</Text>
          <Text style={styles.code}>{info.inviteCode}</Text>
          <TouchableOpacity style={styles.shareBtn} onPress={onShare}>
            <Text style={styles.shareText}>{t('qrCode.share')}</Text>
          </TouchableOpacity>
        </View>
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
      borderRadius: 8,
      alignItems: 'center',
      backgroundColor: tk.surface.light,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    qrBox: {
      width: 200,
      height: 200,
      borderRadius: 8,
      backgroundColor: tk.surface.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    qrPlaceholder: {
      fontSize: 32,
      fontWeight: '700',
      letterSpacing: 2,
      color: tk.text.tertiary,
    },
    tip: { marginTop: 12, fontSize: 12, color: tk.text.secondary },
    code: {
      marginTop: 6,
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: 1,
      color: tk.success.DEFAULT,
    },
    shareBtn: {
      marginTop: 16,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: tk.success.DEFAULT,
    },
    shareText: { fontSize: 13, color: tk.surface.light, fontWeight: '600' },
    muted: { fontSize: 13, color: tk.text.secondary },
    errorText: { fontSize: 13, color: tk.danger.DEFAULT },
  })
}
