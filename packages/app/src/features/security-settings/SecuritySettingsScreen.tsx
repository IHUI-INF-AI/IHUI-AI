// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { rnGeometry, rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'

import { useMemo } from 'react'
import { View, Text, Switch, StyleSheet, TouchableOpacity } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { SecuritySettingsScreenProps } from '../../types'
import { BackChevron } from '../../components/BackChevron'
import { ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

/** 安全设置共享屏 — props 注入式跨端组件 */
export type { SecuritySettingsItem, SecuritySettingsRow, SecuritySettingsSection } from '../../types'

export function SecuritySettingsScreen(props: SecuritySettingsScreenProps & { onRetry?: () => void }) {
  const { t, sections, loading, error, onBack, onRetry } = props
  const footerLink = props.footerLink
  // 页内标题/返回条由端侧决定:小程序隐私页没有 header（showHeader=false），RN 有（true）。
  const showHeader = props.showHeader ?? true
  const colorScheme = props.colorScheme ?? 'light'
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const header = showHeader ? (
    <View style={styles.header}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.title}>{t('securitySettings.title')}</Text>
    </View>
  ) : null

  if (loading) {
    return (
      <View style={styles.container}>
        {header}
        <ScreenSkeleton variant="list" count={4} colorScheme={colorScheme} />
      </View>
    )
  }

  if (error || !sections || sections.length === 0) {
    return (
      <View style={styles.container}>
        {header}
        <ErrorState message={error || t('common.empty')} onRetry={onRetry} colorScheme={colorScheme} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {header}
      <View style={styles.body}>
        {sections.map((section) => (
          <View key={section.key}>
            {section.title ? <Text style={styles.sectionTitle}>{section.title}</Text> : null}
            {section.desc || section.hint ? (
              <View style={styles.card}>
                {section.desc ? <Text style={styles.desc}>{section.desc}</Text> : null}
                {section.hint ? (
                  <Text style={[styles.desc, styles.readOnlyHint]}>{section.hint}</Text>
                ) : null}
              </View>
            ) : null}
            <View style={styles.card}>
              {section.items.map((row) => {
                const label = <Text style={styles.label}>{row.label}</Text>
                const desc = row.desc ? <Text style={styles.rowDesc}>{row.desc}</Text> : null
                // 只读形态渲染真实读数,绝不造"关掉再进来会回原值"的假开关;色调由端侧给。
                const tone =
                  row.stateTone === 'success'
                    ? tk.success.DEFAULT
                    : row.stateTone === 'danger'
                      ? tk.danger.DEFAULT
                      : tk.text.tertiary
                const stateText = (
                  <Text style={[styles.stateText, { color: tone }]}>{row.stateText ?? ''}</Text>
                )
                if (row.action) {
                  return (
                    <View key={row.key} style={styles.row}>
                      <View style={styles.rowMain}>
                        {label}
                        {desc}
                      </View>
                      {stateText}
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={row.action.onPress}
                        accessibilityRole="button"
                      >
                        <Text style={styles.actionText}>{row.action.label}</Text>
                      </TouchableOpacity>
                    </View>
                  )
                }
                // 整行入口(如「两步验证」→ 端内安全中心):一行只留一个意图,不与开关并存。
                if (row.onPress) {
                  return (
                    <TouchableOpacity
                      key={row.key}
                      style={styles.row}
                      activeOpacity={0.85}
                      onPress={row.onPress}
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
                if (row.onToggle) {
                  return (
                    <View key={row.key} style={styles.row}>
                      <View style={styles.rowMain}>
                        {label}
                        {desc}
                      </View>
                      <Switch
                        value={row.value}
                        onValueChange={row.onToggle}
                        trackColor={{ false: tk.border.light, true: tk.brand.DEFAULT }}
                      />
                    </View>
                  )
                }
                return (
                  <View key={row.key} style={styles.row}>
                    <View style={styles.rowMain}>
                      {label}
                      {desc}
                    </View>
                    {stateText}
                  </View>
                )
              })}
            </View>
          </View>
        ))}
        {footerLink ? (
          <TouchableOpacity
            style={styles.footerLink}
            onPress={footerLink.onPress}
            accessibilityRole="button"
          >
            <Text style={styles.footerLinkText}>{footerLink.label}</Text>
          </TouchableOpacity>
        ) : null}
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
    sectionTitle: {
      ...rnType.label,
      color: tk.text.secondary,
      marginBottom: rnSpacing.sm,
    },
    rowMain: { flexShrink: 1, gap: rnSpacing.xs },
    rowDesc: { ...rnType.caption, color: tk.text.tertiary },
    actionBtn: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      flexShrink: 0,
    },
    actionText: { ...rnType.caption, color: tk.brand.DEFAULT },
    footerLink: { alignItems: 'center', paddingVertical: rnSpacing.lg },
    footerLinkText: { ...rnType.body, color: tk.brand.DEFAULT },
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
