import { useMemo } from 'react'
import { View, Text, TouchableOpacity, Switch, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { SecuritySettingsItem, SecuritySettingsScreenProps } from '../../types'

/** 安全设置共享屏 — props 注入式跨端组件 */
export type { SecuritySettingsItem, SecuritySettingsScreenProps }

export function SecuritySettingsScreen({
  t,
  settings,
  loading,
  error,
  onToggle,
  onBack,
  colorScheme = 'light',
}: SecuritySettingsScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.back}>{t('common.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('securitySettings.title')}</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      </View>
    )
  }

  if (error || !settings) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.back}>{t('common.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('securitySettings.title')}</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error || t('common.empty')}</Text>
        </View>
      </View>
    )
  }

  const rows: Array<{ key: keyof SecuritySettingsItem; label: string }> = [
    { key: 'passwordEnabled', label: t('securitySettings.password') },
    { key: 'biometricEnabled', label: t('securitySettings.biometric') },
    { key: 'twoFactorEnabled', label: t('securitySettings.twoFactor') },
    { key: 'loginAlert', label: t('securitySettings.loginAlert') },
  ]

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('securitySettings.title')}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.desc}>{t('securitySettings.desc')}</Text>
        </View>
        <View style={styles.card}>
          {rows.map((row, idx) => (
            <View key={row.key} style={[styles.row, idx > 0 && styles.rowDivider]}>
              <Text style={styles.label}>{row.label}</Text>
              <Switch
                value={settings[row.key]}
                onValueChange={(v) => onToggle(row.key, v)}
                trackColor={{ false: tk.border.light, true: tk.brand.DEFAULT }}
              />
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    center: {
      flex: 1,
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
    back: { fontSize: 16, color: tk.text.medium },
    title: { fontSize: 20, fontWeight: '700', color: tk.text.primary },
    body: { padding: 14 },
    card: {
      padding: 14,
      marginBottom: 12,
      borderRadius: 12,
      backgroundColor: tk.surface.light,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    desc: { fontSize: 14, color: tk.text.secondary },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
    },
    rowDivider: { borderTopColor: tk.border.light, borderTopWidth: 1 },
    label: { fontSize: 14, color: tk.text.medium },
    muted: { fontSize: 14, color: tk.text.secondary },
    errorText: { fontSize: 14, color: tk.danger.DEFAULT },
  })
}
