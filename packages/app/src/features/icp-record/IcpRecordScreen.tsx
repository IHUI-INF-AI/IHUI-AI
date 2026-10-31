// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'

import { useMemo } from 'react'
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { IcpRecordScreenProps } from '../../types'
import { BackChevron } from '../../components/BackChevron'

export type { IcpRecordScreenProps }

const ICP_NO = '吉ICP备2025027274号-7A'
/** 与 web /settings/icp-record 同 6 字段;web 侧 6 字段表见该页 records 数组 */
const ICP_VALUES = [
  ICP_NO,
  '吉公网安备22010502000999号',
  '吉林省爱智汇人工智能科技有限公司',
  '企业',
  'aizhs.top',
  '2026-01-15',
]

export function IcpRecordScreen({
  t,
  onBack,
  onCopy,
  onQuery,
  colorScheme = 'light',
}: IcpRecordScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('icpRecord.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.label}>{t('icpRecord.label0')}</Text>
          <Pressable onPress={() => onCopy?.(ICP_NO)} disabled={!onCopy}>
            <Text style={styles.value}>{ICP_NO}</Text>
          </Pressable>
          {onCopy ? <Text style={styles.hint}>{t('icpRecord.copyHint')}</Text> : null}
        </View>

        <View style={[styles.card, styles.tableCard]}>
          {ICP_VALUES.map((value, index) => (
            <View key={index} style={styles.row}>
              <Text style={styles.rowLabel}>{t(`icpRecord.label${index}`)}</Text>
              <Text style={styles.rowValue}>{value}</Text>
            </View>
          ))}
        </View>

        {onQuery ? (
          <Pressable onPress={onQuery} style={styles.queryButton}>
            <Text style={styles.queryText}>{t('icpRecord.query')}</Text>
          </Pressable>
        ) : null}

        <Text style={styles.footer}>{t('icpRecord.footer')}</Text>
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
    card: {
      padding: 14,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    tableCard: { paddingVertical: rnSpacing.sm },
    label: { fontSize: rnType.body.size, color: tk.text.tertiary, marginBottom: rnSpacing.sm },
    value: { fontSize: rnType.subtitle.size, color: tk.text.primary, fontWeight: '500' },
    hint: { fontSize: rnType.caption.size, color: tk.text.tertiary, marginTop: rnSpacing.sm },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: rnSpacing.md,
      paddingVertical: rnSpacing.md,
    },
    rowLabel: { fontSize: rnType.body.size, color: tk.text.tertiary, flexShrink: 0 },
    rowValue: {
      fontSize: rnType.body.size,
      color: tk.text.primary,
      textAlign: 'right',
      flex: 1,
    },
    queryButton: {
      height: 50,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    queryText: {
      fontSize: rnType.subtitle.size,
      fontWeight: '600',
      color: tk.brand.ctaForeground,
    },
    footer: {
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
      lineHeight: 20,
      paddingHorizontal: rnSpacing.xs,
      paddingVertical: rnSpacing.md,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
