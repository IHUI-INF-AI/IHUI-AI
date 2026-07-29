import { useMemo } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { FinanceSummary, FinanceScreenProps } from '../../types'

export type { FinanceSummary, FinanceScreenProps }

/**
 * 财务汇总共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header(返回 + 标题)+ 余额/今日收入/累计收入/累计支出 4 个卡片。
 * 金额格式化用 toFixed(2)(平台无关,不依赖 @ihui/shared/utils)。
 * 平台特定(导航/API)由 wrapper 注入。
 */
export function FinanceScreen({
  t,
  summary,
  loading,
  error,
  onBack,
  colorScheme = 'light',
}: FinanceScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tk.success.DEFAULT} />
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.link}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (!summary) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('finance.empty')}</Text>
      </View>
    )
  }

  const cards: Array<{ label: string; value: number; primary?: boolean }> = [
    { label: t('finance.balance'), value: summary.balance, primary: true },
    { label: t('finance.todayIncome'), value: summary.todayIncome },
    { label: t('finance.totalIncome'), value: summary.totalIncome },
    { label: t('finance.totalExpense'), value: summary.totalExpense },
  ]

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('finance.title')}</Text>
      </View>
      {cards.map((c) => (
        <View key={c.label} style={styles.card}>
          <Text style={styles.label}>{c.label}</Text>
          <Text style={[styles.value, c.primary && styles.valuePrimary]}>
            ¥ {c.value.toFixed(2)}
          </Text>
        </View>
      ))}
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    center: {
      flex: 1,
      backgroundColor: tk.surface.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 12, gap: 12 },
    backBtn: { marginTop: 12 },
    backText: { fontSize: 14, color: tk.text.medium },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    card: {
      padding: 16,
      marginBottom: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    label: { fontSize: 12, color: tk.text.secondary },
    value: { marginTop: 4, fontSize: 22, fontWeight: '600', color: tk.text.primary },
    valuePrimary: { color: tk.success.DEFAULT },
    muted: { fontSize: 13, color: tk.text.secondary },
    errorText: { fontSize: 13, color: tk.danger.DEFAULT, marginBottom: 8 },
    link: { fontSize: 13, color: tk.success.DEFAULT },
  })
}
