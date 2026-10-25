// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { View, Text, TouchableOpacity, Switch, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { NotificationSettingsItem, NotificationSettingsScreenProps } from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

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
          <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
          <Text style={styles.title}>{t('notificationSettings.title')}</Text>
        </View>
        <ScreenSkeleton variant="list" count={5} colorScheme={colorScheme} />
      </View>
    )
  }

  if (error || !settings) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
          <Text style={styles.title}>{t('notificationSettings.title')}</Text>
        </View>
        <ErrorState
          message={error || t('common.empty')}
          onRetry={onBack}
          retryLabel={t('common.back')}
          colorScheme={colorScheme}
        />
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
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('notificationSettings.title')}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.desc}>{t('notificationSettings.desc')}</Text>
        </View>
        <View style={styles.card}>
          {rows.map((row) => (
            <View key={row.key} style={styles.row}>
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.md,
    },
    title: { fontSize: rnType.heading.size, fontWeight: '600', color: tk.text.primary },
    body: { padding: rnSpacing.lg },
    card: {
      padding: rnSpacing.md,
      marginBottom: rnSpacing.md,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.light,
    },
    desc: { ...rnType.body, color: tk.text.secondary },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: rnSpacing.md,
    },
    label: { ...rnType.body, color: tk.text.medium },
    errorText: { ...rnType.body, color: tk.danger.DEFAULT, marginBottom: rnSpacing.sm },
    successText: { ...rnType.body, color: tk.success.DEFAULT, marginBottom: rnSpacing.sm },
    saveBtn: {
      marginTop: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      height: 50,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.brand.cta,
    },
    saveBtnDisabled: { backgroundColor: tk.text.tertiary },
    saveBtnText: { color: tk.surface.light, ...rnType.title },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
