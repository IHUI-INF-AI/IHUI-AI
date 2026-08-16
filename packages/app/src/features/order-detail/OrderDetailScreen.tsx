/** 订单详情共享屏 — props 注入式跨端组件 */
import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { OrderDetailScreenProps } from '../../types'

/**
 * 订单详情共享屏 — 平台无关渲染层。
 *
 * 负责 loading / error / 正常态三分支:
 * - loading:center + muted 文案
 * - error/null:center + error 文案 + 返回按钮
 * - 正常态:ScrollView > header(返回 + 标题)> body(卡片 5-6 行 label-value)
 *
 * 平台特定(导航 / API 调用)由 wrapper 通过 props 注入。
 */
export function OrderDetailScreen({
  t,
  item,
  loading,
  error,
  onBack,
  colorScheme = 'light',
}: OrderDetailScreenProps) {
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
        <Text style={styles.error}>{error || t('orderDetail.loadFailed')}</Text>
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
        <Text style={styles.title}>{t('orderDetail.title')}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.label}>{t('orderDetail.orderNo')}</Text>
          <Text style={styles.value}>{item.orderNo}</Text>
          <Text style={styles.label}>{t('orderDetail.product')}</Text>
          <Text style={styles.value}>{item.productName}</Text>
          <Text style={styles.label}>{t('orderDetail.amount')}</Text>
          <Text style={styles.price}>¥{item.amount.toFixed(2)}</Text>
          <Text style={styles.label}>{t('orderDetail.status')}</Text>
          <Text style={styles.value}>{item.status}</Text>
          <Text style={styles.label}>{t('orderDetail.createdAt')}</Text>
          <Text style={styles.value}>{item.createdAt}</Text>
          {item.paidAt ? (
            <>
              <Text style={styles.label}>{t('orderDetail.paidAt')}</Text>
              <Text style={styles.value}>{item.paidAt}</Text>
            </>
          ) : null}
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
    body: { padding: 10 },
    back: { fontSize: 16, color: tk.text.medium },
    title: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    card: {
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    label: { marginTop: 8, fontSize: 11, color: tk.text.tertiary },
    value: { marginTop: 8, fontSize: 16, color: tk.text.primary },
    price: { marginTop: 8, fontSize: 22, fontWeight: '700', color: tk.success.DEFAULT },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
    muted: { fontSize: 14, color: tk.text.secondary, marginTop: 8 },
    error: { fontSize: 14, color: tk.danger.DEFAULT, textAlign: 'center' },
    backBtn: { marginTop: 12 },
  })
}
