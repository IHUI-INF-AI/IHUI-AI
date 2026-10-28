// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { useMemo } from 'react'
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native'

import { BackChevron } from '../../components/BackChevron'
import { ErrorState, ScreenSkeleton } from '../../components/ScreenStates'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'

/**
 * 会员偏好设置共享屏(2026-10-29 立)。
 *
 * 契约照**后端真正在跑的那两份**(不是 web 页):`GET /api/settings/notifications` 与
 * `GET /api/settings/privacy` 都回 `{ settings: Record<string, string|null> }`;
 * `PUT` 同路径收对象本体(`packages/api-client/src/endpoints/system.ts` 的
 * updateNotificationSettings / updatePrivacySettings)。
 * 键集:通知 orderUpdates/promotions/points/newsletter;隐私 showProfile/showActivity/allowInvites。
 * —— web 的 `member/settings` 页读 `{settings:{notifications,privacy}}`、按 `{notifications,privacy}` 提交,
 * 与后端形状不符(GET 回 {list,total}、PUT 要 {items:[…]}),故本屏**刻意不走那条路由**。
 */
export type MemberPrefs = Record<string, boolean>

export interface MemberSettingsScreenProps {
  t: (key: string, vars?: Record<string, string | number>) => string
  notifications: MemberPrefs
  privacy: MemberPrefs
  loading: boolean
  saving: boolean
  error: string
  onToggle: (group: 'notifications' | 'privacy', key: string, value: boolean) => void
  onRetry: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

const NOTIF_KEYS = ['orderUpdates', 'promotions', 'points', 'newsletter'] as const
const PRIVACY_KEYS = ['showProfile', 'showActivity', 'allowInvites'] as const

export function MemberSettingsScreen({
  t,
  notifications,
  privacy,
  loading,
  saving,
  error,
  onToggle,
  onRetry,
  onBack,
  colorScheme = 'light',
}: MemberSettingsScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) return <ScreenSkeleton colorScheme={colorScheme} />
  if (error) return <ErrorState message={error} onRetry={onRetry} colorScheme={colorScheme} />

  const renderGroup = (
    title: string,
    group: 'notifications' | 'privacy',
    keys: readonly string[],
    values: MemberPrefs,
  ) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {keys.map((key) => (
        <View key={key} style={styles.row}>
          <Text style={styles.label}>{t(`memberSettings.${key}`)}</Text>
          <Switch
            value={Boolean(values[key])}
            disabled={saving}
            onValueChange={(v) => onToggle(group, key, v)}
            trackColor={{ false: tk.border.medium, true: tk.brandAccent.DEFAULT }}
          />
        </View>
      ))}
    </View>
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('memberSettings.title')}</Text>
        {saving ? <Text style={styles.saving}>{t('memberSettings.saving')}</Text> : null}
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {renderGroup(t('memberSettings.notification'), 'notifications', NOTIF_KEYS, notifications)}
        {renderGroup(t('memberSettings.privacy'), 'privacy', PRIVACY_KEYS, privacy)}
        <TouchableOpacity style={styles.hint} onPress={() => void 0} activeOpacity={1}>
          <Text style={styles.hintText}>{t('memberSettings.hint')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
    },
    title: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    saving: { fontSize: rnType.caption.size, color: tk.text.tertiary, marginLeft: 'auto' },
    body: { padding: rnSpacing.md, gap: rnSpacing.md },
    section: {
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      gap: rnSpacing.xs,
    },
    sectionTitle: {
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
      marginBottom: rnSpacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: rnSpacing.xs,
    },
    label: { fontSize: rnType.body.size, color: tk.text.primary },
    hint: { paddingHorizontal: rnSpacing.xs },
    hintText: { fontSize: rnType.caption.size, color: tk.text.tertiary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
