import { useMemo } from 'react'
import { View, Text, TouchableOpacity, Switch, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type {
  NotificationSettingsItem,
  NotificationSettingsScreenProps,
} from '../../types'

/** 通知设置共享屏 — props 注入式跨端组件 */
export type { NotificationSettingsItem, NotificationSettingsScreenProps }

export function NotificationSettingsScreen({
  t,
  settings,
  loading,
  saving,
  error,
  success,
  onToggle,
  onSave,
  onBack,
  colorScheme = 'light',
}: NotificationSettingsScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.back}>{t('common.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('notificationSettings.title')}</Text>
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
          <Text style={styles.title}>{t('notificationSettings.title')}</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error || t('common.empty')}</Text>
        </View>
      </View>
    )
  }

  const rows: Array<{ key: keyof NotificationSettingsItem; label: string }> = [
    { key: 'pushEnabled', label: t('notificationSettings.push') },
    { key: 'messageEnabled', label: t('notificationSettings.message') },
    { key: 'emailEnabled', label: t('notificationSettings.email') },
    { key: 'smsEnabled', label: t('notificationSettings.sms') },
    { key: 'marketingEnabled', label: t('notificationSettings.marketing') },
  ]

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('notificationSettings.title')}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.desc}>{t('notificationSettings.desc')}</Text>
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
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {success ? <Text style={styles.successText}>{success}</Text> : null}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={onSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>
            {saving ? t('notificationSettings.saving') : t('notificationSettings.save')}
          </Text>
        </TouchableOpacity>
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
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    back: { fontSize: 14, color: tk.text.medium },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    body: { padding: 16 },
    card: {
      padding: 12,
      marginBottom: 12,
      borderRadius: 8,
      backgroundColor: tk.surface.card,
    },
    desc: { fontSize: 12, color: tk.text.secondary },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
    },
    rowDivider: { borderTopColor: tk.surface.muted, borderTopWidth: 1 },
    label: { fontSize: 13, color: tk.text.medium },
    errorText: { fontSize: 12, color: tk.danger.DEFAULT, marginBottom: 8 },
    successText: { fontSize: 12, color: tk.success.DEFAULT, marginBottom: 8 },
    saveBtn: {
      marginTop: 4,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
      backgroundColor: tk.success.DEFAULT,
    },
    saveBtnDisabled: { backgroundColor: tk.text.tertiary },
    saveBtnText: { color: tk.surface.light, fontSize: 14, fontWeight: '600' },
    muted: { fontSize: 13, color: tk.text.secondary },
  })
}
