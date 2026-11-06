// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { Text, View, StyleSheet, type ViewStyle } from 'react-native'
import { Calendar, CreditCard, Tag } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { CategoryHeaderProps } from '@ihui/types'

/**
 * 分类头共享段(web 分类详情页原有 inline 实现的单源)。
 * 纯 RN 原语 + tokens:web 经 react-native-web 承载,RN 经共享屏承载。
 * 每个字段“给了才渲染”,端内没有的事实(如 RN 的分类状态)不伪造。
 */
export function CategoryHeader({
  name,
  icon,
  description,
  statusLabel,
  statusEnabled,
  paidLabel,
  isPaid,
  createdAtLabel,
  colorScheme = 'light',
}: CategoryHeaderProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.iconBox}>
          {icon ? (
            <Text style={styles.iconText}>{icon}</Text>
          ) : (
            <Tag size={24} color={tk.brandAccent.deep} />
          )}
        </View>
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={2}>
            {name}
          </Text>
          <View style={styles.badges}>
            {statusLabel !== undefined ? (
              <View
                style={[styles.badge, statusEnabled ? styles.badgeEnabled : styles.badgeDisabled]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    statusEnabled ? styles.badgeEnabledText : styles.badgeDisabledText,
                  ]}
                >
                  {statusLabel}
                </Text>
              </View>
            ) : null}
            {isPaid ? (
              <View style={[styles.badge, styles.badgePaid]}>
                <CreditCard size={12} color={tk.warning.amberText} />
                <Text style={[styles.badgeText, styles.badgePaidText]}>{paidLabel}</Text>
              </View>
            ) : null}
            {createdAtLabel ? (
              <View style={styles.meta}>
                <Calendar size={12} color={tk.text.tertiary} />
                <Text style={styles.metaText}>{createdAtLabel}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { gap: rnSpacing.md } as ViewStyle,
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: rnSpacing.md },
    iconBox: {
      width: 48,
      height: 48,
      borderRadius: rnRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.brandAccent.light,
    },
    iconText: { fontSize: rnType.heading.size },
    body: { flex: 1, minWidth: 0, gap: rnSpacing.sm },
    name: { fontSize: rnType.heading.size, fontWeight: '700', color: tk.text.primary },
    badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: rnSpacing.sm },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.sm,
    },
    badgeEnabled: { backgroundColor: tk.success.light },
    badgeDisabled: { backgroundColor: tk.surface.card },
    badgePaid: { backgroundColor: tk.warning.amberLight },
    badgeText: { fontSize: rnType.label.size },
    badgeEnabledText: { color: tk.success.deepText },
    badgeDisabledText: { color: tk.text.secondary },
    badgePaidText: { color: tk.warning.amberText },
    meta: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
    metaText: { fontSize: rnType.label.size, color: tk.text.tertiary },
    description: {
      fontSize: rnType.body.size,
      lineHeight: rnType.strong.lineHeight,
      color: tk.text.secondary,
    },
  })
}
