// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { ExamResultStatsProps } from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'

/**
 * 成绩四格统计共享段(原小程序页内 stats.map 与 web PageClient 的 4 格 grid 的单源)。
 * 纯 RN 原语 + tokens:web 经 react-native-web 承载,RN / 小程序经共享层承载。
 * 文案与数值由宿主注入,本段不取词、不拼「题/分钟」单位。
 */
export function ExamResultStats({ items, colorScheme = 'light' }: ExamResultStatsProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.row}>
      {items.map((it) => (
        <View key={it.key} style={styles.cell}>
          <Text style={[styles.value, { color: toneColor(tk, it.tone) }]}>{it.value}</Text>
          <Text style={styles.label}>{it.label}</Text>
        </View>
      ))}
    </View>
  )
}

function toneColor(
  tk: AppThemeTokens,
  tone: ExamResultStatsProps['items'][number]['tone'],
): string {
  if (tone === 'correct') return tk.success.deepText
  if (tone === 'wrong') return tk.danger.DEFAULT
  if (tone === 'muted') return tk.text.secondary
  return tk.text.primary
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    row: { flexDirection: 'row', gap: rnSpacing.md },
    cell: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: rnSpacing['sm-loose'],
      paddingHorizontal: rnSpacing.sm,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    value: { fontSize: rnType.title.size, fontWeight: '600' },
    label: { marginTop: rnSpacing.xs, fontSize: rnType.label.size, color: tk.text.secondary },
  })
}
