// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { View, Text, TouchableOpacity, Switch, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { NotificationSettingsItem, NotificationSettingsLink, NotificationSettingsRow, NotificationSettingsScreenProps } from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

/** 通知设置共享屏 — props 注入式跨端组件 */
export type { NotificationSettingsItem, NotificationSettingsLink, NotificationSettingsRow, NotificationSettingsScreenProps }

export function NotificationSettingsScreen({
  t,
  items,
  loading,
  saving,
  error,
  success,
  onToggle,
  onSave,
  onBack,
  onRetry,
  showHeader = true,
  extraLinks,
  extraLinksTitle,
  colorScheme = 'light',
}: NotificationSettingsScreenProps & { onRetry?: () => void }) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const header = showHeader ? (
    <View style={styles.header}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.title}>{t('settings.notificationsTitle')}</Text>
    </View>
  ) : null

  if (loading) {
    return (
      <View style={styles.container}>
        {header}
        <ScreenSkeleton variant="list" count={5} colorScheme={colorScheme} />
      </View>
    )
  }

  if (error || items.length === 0) {
    return (
      <View style={styles.container}>
        {header}
        <ErrorState
          message={error || t('common.empty')}
          onRetry={onRetry}
          retryLabel={t('common.back')}
          colorScheme={colorScheme}
        />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {header}
      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.desc}>{t('notificationSettings.desc')}</Text>
        </View>
        <View style={styles.card}>
          {items.map((row) => (
            <View key={row.key} style={styles.row}>
              <Text style={styles.label}>{row.label}</Text>
              <Switch
                value={row.enabled}
                onValueChange={(v) => onToggle(row.key, v)}
                trackColor={{ false: tk.border.light, true: tk.brand.DEFAULT }}
              />
            </View>
          ))}
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {success ? <Text style={styles.successText}>{success}</Text> : null}
        {extraLinks && extraLinks.length > 0 ? (
          <View>
            {extraLinksTitle ? <Text style={styles.sectionTitle}>{extraLinksTitle}</Text> : null}
            <View style={styles.card}>
              {extraLinks.map((link) => (
                <TouchableOpacity
                  key={link.key}
                  style={styles.linkRow}
                  onPress={link.onPress}
                  accessibilityRole="button"
                >
                  <View style={styles.linkText}>
                    <Text style={styles.label}>{link.label}</Text>
                    {link.desc ? <Text style={styles.linkDesc}>{link.desc}</Text> : null}
                  </View>
                  <Text style={styles.linkChevron}>{'>'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}
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
    sectionTitle: {
      ...rnType.label,
      color: tk.text.secondary,
      marginBottom: rnSpacing.sm,
    },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: rnSpacing.md,
    },
    linkText: { flex: 1, marginRight: rnSpacing.md },
    linkDesc: { ...rnType.caption, color: tk.text.secondary, marginTop: rnSpacing.xs },
    linkChevron: { ...rnType.body, color: tk.text.secondary },
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
