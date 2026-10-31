// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'

import { useMemo } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AppPermissionScreenProps } from '../../types'
import { BackChevron } from '../../components/BackChevron'
import { Tappable } from '@ihui/ui-native'

export type { AppPermissionScreenProps }

const PERMISSION_COUNT = 8
const REQUIRED_FLAGS = [true, false, true, false, false, true, false, false]

export function AppPermissionScreen({
  t,
  onBack,
  statusByIndex,
  onOpenSettings,
  colorScheme = 'light',
}: AppPermissionScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const items = Array.from({ length: PERMISSION_COUNT }, (_, index) => ({
    name: t(`appPermission.name${index}`),
    desc: t(`appPermission.desc${index}`),
    required: REQUIRED_FLAGS[index] ?? false,
    status: statusByIndex?.[index],
  }))

  const statusLabel = (status: 'granted' | 'denied' | 'unknown') =>
    status === 'granted'
      ? t('appPermission.granted')
      : status === 'denied'
        ? t('appPermission.denied')
        : t('appPermission.unknown')

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('appPermission.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>{t('appPermission.intro')}</Text>
        {items.map((item, index) => (
          <View key={index} style={styles.card}>
            <View style={styles.rowTop}>
              <View style={styles.rowMain}>
                <View style={styles.nameRow}>
                  <Text style={styles.permName}>{item.name}</Text>
                  <Text style={item.required ? styles.tagRequired : styles.tagOptional}>
                    {item.required ? t('appPermission.required') : t('appPermission.optional')}
                  </Text>
                  {item.status ? (
                    <Text
                      style={[
                        styles.tagStatus,
                        item.status === 'granted'
                          ? styles.statusGranted
                          : item.status === 'denied'
                            ? styles.statusDenied
                            : styles.statusUnknown,
                      ]}
                    >
                      {statusLabel(item.status)}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.permDesc}>{item.desc}</Text>
              </View>
              {onOpenSettings ? (
                <Tappable onPress={onOpenSettings} style={styles.settingButton}>
                  <Text style={styles.settingText}>{t('appPermission.goSetting')}</Text>
                </Tappable>
              ) : null}
            </View>
          </View>
        ))}

        {onOpenSettings ? (
          <Tappable onPress={onOpenSettings} style={styles.openAll}>
            <Text style={styles.openAllText}>{t('appPermission.openAllSetting')}</Text>
          </Tappable>
        ) : null}

        <Text style={styles.footer}>{t('appPermission.footer')}</Text>
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
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.md,
    },
    title: { fontSize: rnType.heading.size, fontWeight: '700', color: tk.text.primary },
    body: { padding: 14, paddingBottom: rnSpacing['3xl'], gap: rnSpacing.md },
    intro: {
      fontSize: rnType.body.size,
      color: tk.text.secondary,
      lineHeight: 22,
      paddingHorizontal: rnSpacing.xs,
      paddingVertical: rnSpacing.xs,
    },
    card: {
      backgroundColor: tk.surface.light,
      borderRadius: rnRadius.lg,
      padding: 14,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: rnSpacing.md },
    rowMain: { flex: 1 },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: rnSpacing.sm,
      marginBottom: rnSpacing.sm,
    },
    permName: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    tagRequired: {
      fontSize: rnType.caption.size,
      color: tk.error.text,
      backgroundColor: tk.error.bg,
      borderRadius: rnRadius.xs,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      overflow: 'hidden',
    },
    tagOptional: {
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
      backgroundColor: tk.surface.muted,
      borderRadius: rnRadius.xs,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      overflow: 'hidden',
    },
    tagStatus: {
      fontSize: rnType.caption.size,
      borderRadius: rnRadius.xs,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      overflow: 'hidden',
    },
    statusGranted: { color: tk.brandAccent.deep, backgroundColor: tk.brandAccent.light },
    statusDenied: { color: tk.error.text, backgroundColor: tk.error.bg },
    statusUnknown: { color: tk.text.tertiary, backgroundColor: tk.surface.muted },
    settingButton: {
      flexShrink: 0,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
    },
    settingText: {
      fontSize: rnType.label.size,
      fontWeight: '500',
      color: tk.brand.ctaForeground,
    },
    openAll: {
      backgroundColor: tk.surface.light,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    openAllText: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    footer: {
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
      textAlign: 'center',
      paddingVertical: rnSpacing.sm,
    },
    permDesc: { fontSize: rnType.body.size, color: tk.text.secondary, lineHeight: 22 },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
