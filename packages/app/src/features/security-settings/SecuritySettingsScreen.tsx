// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { rnGeometry, rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'

import { useMemo } from 'react'
import { View, Text, Switch, StyleSheet, TouchableOpacity } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { SecuritySettingsItem, SecuritySettingsScreenProps } from '../../types'
import { BackChevron } from '../../components/BackChevron'
import { ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

/** 安全设置共享屏 — props 注入式跨端组件 */
export type { SecuritySettingsItem, SecuritySettingsScreenProps }

export function SecuritySettingsScreen({
  t,
  settings,
  loading,
  error,
  onToggle,
  readOnly,
  onBack,
  onRetry,
  onOpenTwoFactor,
  colorScheme = 'light'
}: SecuritySettingsScreenProps & { onRetry?: () => void; onOpenTwoFactor?: () => void }) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
          <Text style={styles.title}>{t('securitySettings.title')}</Text>
        </View>
        <ScreenSkeleton variant="list" count={4} colorScheme={colorScheme} />
      </View>
    )
  }

  if (error || !settings) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
          <Text style={styles.title}>{t('securitySettings.title')}</Text>
        </View>
        <ErrorState message={error || t('common.empty')} onRetry={onRetry} colorScheme={colorScheme} />
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
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('securitySettings.title')}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.desc}>{t('securitySettings.desc')}</Text>
          {readOnly ? (
            <Text style={[styles.desc, styles.readOnlyHint]}>
              {t('securitySettings.readOnlyHint')}
            </Text>
          ) : null}
        </View>
        <View style={styles.card}>
          {rows.map((row) => {
            const label = <Text style={styles.label}>{row.label}</Text>
            // 只读形态:/user/security 自己只有 GET,这一条路径上四项都没有**行内**写端点,
            // 故渲染真实状态文字而不是假开关(关掉再进来会回原值的那种)。但"本屏不提供入口"
            // 不等于"后端不支持修改" —— securitySettings.readOnlyHint 必须点名那个入口,
            // 不得写成一句概览式的否认(那条文案的反证锁在
            // apps/mobile-rn/tests/security-settings-readonly-copy.test.tsx)。
            const stateText = (
              <Text
                style={[styles.stateText, { color: settings[row.key] ? tk.success.DEFAULT : tk.text.tertiary }]}
              >
                {t(settings[row.key] ? 'securitySettings.stateOn' : 'securitySettings.stateOff')}
              </Text>
            )
            // 「两步验证」的写面在承载端的「安全中心」屏(/api/auth/2fa/*)。宿主注入回调时,
            // 整行成为真实可点入口(矢量箭头);不与行内开关并存 —— 一行两个意图必有一个是假的。
            // 不注入(小程序端无该屏 ⇒ 宿主给 undefined)⇒ 下面那一支原样渲染,与注入前逐字一致。
            const openEntry = row.key === 'twoFactorEnabled' ? onOpenTwoFactor : undefined
            if (openEntry) {
              return (
                <TouchableOpacity
                  key={row.key}
                  style={styles.row}
                  activeOpacity={0.85}
                  onPress={openEntry}
                  accessibilityRole="button"
                  accessibilityLabel={row.label}
                >
                  {label}
                  <View style={styles.rowTrailing}>
                    {stateText}
                    <ChevronRight size={rnGeometry.glyphSm} color={tk.text.tertiary} />
                  </View>
                </TouchableOpacity>
              )
            }
            return (
              <View key={row.key} style={styles.row}>
                {label}
                {readOnly || !onToggle ? (
                  stateText
                ) : (
                  <Switch
                    value={settings[row.key]}
                    onValueChange={(v) => onToggle(row.key, v)}
                    trackColor={{ false: tk.border.light, true: tk.brand.DEFAULT }}
                  />
                )}
              </View>
            )
          })}
        </View>
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
    title: { ...rnType.heading, color: tk.text.primary },
    body: { padding: rnSpacing.lg },
    card: {
      padding: rnSpacing.lg,
      marginBottom: rnSpacing.md,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.light,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    desc: { ...rnType.body, color: tk.text.secondary },
    readOnlyHint: { marginTop: rnSpacing.sm, color: tk.text.tertiary },
    stateText: { ...rnType.body, fontWeight: '600' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: rnSpacing.md,
    },
    // 仅「有跳转入口」的那一行使用:space-between 行里的读数默认 flexShrink:1,
    // 行宽不够时先压读数(守门 241)⇒ 读数与箭头这一组必须自己不缩。
    rowTrailing: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm, flexShrink: 0 },
    label: { ...rnType.body, color: tk.text.medium },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
