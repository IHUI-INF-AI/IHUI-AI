import { useMemo } from 'react'
import { ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { VipCompareScreenProps } from '../../types'

/** VIP 对比共享屏 — props 注入式跨端组件 */
export type { VipCompareScreenProps }

export function VipCompareScreen({
  t,
  rows,
  loading,
  error,
  onBack,
  colorScheme = 'light',
}: VipCompareScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }
  if (rows.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('common.empty')}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('vipCompare.title')}</Text>
      </View>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.cell, styles.cellFeature]}>{t('vipCompare.feature')}</Text>
          <Text style={styles.cell}>{t('vipCompare.basic')}</Text>
          <Text style={styles.cell}>{t('vipCompare.premium')}</Text>
          <Text style={styles.cell}>{t('vipCompare.enterprise')}</Text>
        </View>
        {rows.map((row, idx) => (
          <View key={idx} style={[styles.tableRow, idx % 2 === 1 && styles.rowAlt]}>
            <Text style={[styles.cell, styles.cellFeature, styles.cellText]}>{row.feature}</Text>
            <Text style={[styles.cell, styles.cellText]}>{row.basic}</Text>
            <Text style={[styles.cell, styles.cellText]}>{row.premium}</Text>
            <Text style={[styles.cell, styles.cellText]}>{row.enterprise}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    back: { fontSize: 14, color: tk.text.medium },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    table: {
      margin: 16,
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: 8,
      overflow: 'hidden',
    },
    tableHeader: { flexDirection: 'row', backgroundColor: tk.surface.muted },
    tableRow: { flexDirection: 'row' },
    rowAlt: { backgroundColor: tk.surface.muted },
    cell: { flex: 1, padding: 10, fontSize: 11, color: tk.text.secondary },
    cellFeature: { flex: 1.2, fontWeight: '600', color: tk.text.primary },
    cellText: { fontSize: 11 },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      backgroundColor: tk.surface.bg,
    },
    muted: { fontSize: 12, color: tk.text.secondary, marginTop: 8 },
    error: { fontSize: 13, color: tk.danger.DEFAULT, textAlign: 'center' },
    backBtn: { marginTop: 12 },
  })
}
