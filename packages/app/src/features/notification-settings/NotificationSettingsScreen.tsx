// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { View, Text, TouchableOpacity, Switch, StyleSheet } from 'react-native'
import { Check, Play } from 'lucide-react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type {
  NotificationRingtoneConfig,
  NotificationSettingsItem,
  NotificationSettingsLink,
  NotificationSettingsRow,
  NotificationSettingsScreenProps,
} from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

/** 通知设置共享屏 — props 注入式跨端组件 */
export type {
  NotificationRingtoneConfig,
  NotificationSettingsItem,
  NotificationSettingsLink,
  NotificationSettingsRow,
  NotificationSettingsScreenProps,
}

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
  ringtone,
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
        {ringtone ? (
          <>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.label}>{ringtone.soundToggleLabel}</Text>
                <Switch
                  value={ringtone.soundEnabled}
                  onValueChange={ringtone.onToggleSound}
                  trackColor={{ false: tk.border.light, true: tk.brand.DEFAULT }}
                />
              </View>
            </View>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{ringtone.title}</Text>
              <Text style={styles.sectionDesc}>{ringtone.desc}</Text>
              {ringtone.ringtoneIds.map((id) => (
                <RingtoneRow
                  key={id}
                  name={ringtone.ringtoneNames[id] || id}
                  selected={ringtone.ringtoneId === id}
                  onSelect={() => ringtone.onSelectRingtone(id)}
                  onPreview={() => ringtone.onPreviewRingtone(id)}
                  previewLabel={ringtone.previewLabel}
                  colorScheme={colorScheme}
                />
              ))}
            </View>
          </>
        ) : null}
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
      marginBottom: rnSpacing.xs,
    },
    sectionDesc: { ...rnType.caption, color: tk.text.medium, marginBottom: rnSpacing.sm },
    ringtoneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.md,
    },
    ringtoneName: { flex: 1 },
    previewBtn: { padding: rnSpacing.xs },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: rnSpacing.md,
    },
    linkText: { flex: 1, marginRight: rnSpacing.md },
    linkDesc: { ...rnType.caption, color: tk.text.secondary, marginTop: rnSpacing.xs },
    linkChevron: { ...rnType.body, color: tk.text.secondary },
    errorText: { ...rnType.body, color: tk.danger.deepText, marginBottom: rnSpacing.sm },
    successText: { ...rnType.body, color: tk.success.deepText, marginBottom: rnSpacing.sm },
    saveBtn: {
      marginTop: rnSpacing.sm,
      borderRadius: rnRadius.md,
      height: 50,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.brand.cta,
    },
    saveBtnDisabled: { backgroundColor: tk.text.secondary },
    saveBtnText: { color: tk.surface.light, ...rnType.title },
  })
}

interface RingtoneRowProps {
  name: string
  selected: boolean
  previewLabel: string
  colorScheme: 'light' | 'dark'
  onSelect: () => void
  onPreview: () => void
}

/** 单个铃声选项:整行可选中(radio 语义),右侧独立试听按钮,选中态有读屏等价标签。 */
function RingtoneRow({
  name,
  selected,
  previewLabel,
  colorScheme,
  onSelect,
  onPreview,
}: RingtoneRowProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  return (
    <TouchableOpacity
      style={styles.ringtoneRow}
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={name}
    >
      <Text style={[styles.label, styles.ringtoneName]}>{name}</Text>
      <TouchableOpacity
        onPress={onPreview}
        accessibilityRole="button"
        accessibilityLabel={previewLabel}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Play size={18} color={tk.text.medium} />
      </TouchableOpacity>
      {selected ? <Check size={18} color={tk.brand.DEFAULT} strokeWidth={3} /> : null}
    </TouchableOpacity>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
