/** 退款详情共享屏 — props 注入式跨端组件 */
import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { RefundDetailScreenProps } from '../../types'

/**
 * 退款详情共享屏 — 平台无关渲染层。
 *
 * 负责 loading / error / 正常态三分支:
 * - loading:center + muted 文案
 * - error/null:center + error 文案 + 返回按钮
 * - 正常态:ScrollView > header(返回 + 标题)> body(5 行 key-value)
 *
 * 平台特定(导航 / API 调用)由 wrapper 通过 props 注入。
 */
export function RefundDetailScreen({
  t,
  item,
  loading,
  error,
  onBack,
  colorScheme = 'light',
}: RefundDetailScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }

  if (error || !item) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || t('refundDetail.empty')}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('refundDetail.title')}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.label}>{t('refundDetail.orderNo')}</Text>
          <Text style={styles.value}>{item.orderNo}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t('refundDetail.amount')}</Text>
          <Text style={styles.value}>¥{item.amount.toFixed(2)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t('refundDetail.status')}</Text>
          <Text style={[styles.value, styles.valueSuccess]}>{item.status}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t('refundDetail.reason')}</Text>
          <Text style={styles.value}>{item.reason}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t('refundDetail.createdAt')}</Text>
          <Text style={styles.value}>{item.createdAt}</Text>
        </View>
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
      paddingHorizontal: 10,
      paddingVertical: 12,
      gap: 12,
    },
    body: { padding: 14 },
    back: { fontSize: 16, color: tk.text.medium },
    title: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tk.border.light,
    },
    label: { fontSize: 14, color: tk.text.secondary },
    value: {
      fontSize: 14,
      color: tk.text.primary,
      fontWeight: '500',
      flexShrink: 1,
      marginLeft: 12,
      textAlign: 'right',
    },
    valueSuccess: { color: tk.success.DEFAULT },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 14 },
    muted: { fontSize: 14, color: tk.text.secondary, marginTop: 8 },
    error: { fontSize: 14, color: tk.danger.DEFAULT, textAlign: 'center' },
    backBtn: { marginTop: 12 },
  })
}
