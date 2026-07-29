/**
 * VIP 等级详情共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header(返回 + 标题)+ levelName + price/duration 行 + benefits,
 * 以及 loading / error 态。平台特定(导航 / API 调用)由 wrapper 通过 props 注入。
 */
import { useMemo } from 'react'
import { ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { VipLevelScreenProps } from '../../types'

export function VipLevelScreen({
  t,
  item,
  loading,
  error,
  onBack,
  colorScheme = 'light',
}: VipLevelScreenProps) {
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
        <Text style={styles.error}>{error || t('vipLevel.empty')}</Text>
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
        <Text style={styles.title}>{t('vipLevel.title')}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.levelName}>{item.levelName}</Text>
        <View style={styles.row}>
          <Text style={styles.label}>{t('vipLevel.price')}</Text>
          <Text style={styles.price}>¥{item.price.toFixed(2)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t('vipLevel.duration')}</Text>
          <Text style={styles.value}>{item.durationDays} {t('vipLevel.days')}</Text>
        </View>
        <Text style={styles.benefitsTitle}>{t('vipLevel.benefits')}</Text>
        <Text style={styles.benefits}>{item.benefits}</Text>
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
    body: { padding: 16 },
    back: { fontSize: 14, color: tk.text.medium },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    levelName: { fontSize: 22, fontWeight: '700', color: tk.success.DEFAULT },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: tk.surface.card,
    },
    label: { fontSize: 13, color: tk.text.secondary },
    price: { fontSize: 18, fontWeight: '600', color: tk.danger.DEFAULT },
    value: { fontSize: 13, color: tk.text.primary, fontWeight: '500' },
    benefitsTitle: { marginTop: 16, fontSize: 14, fontWeight: '600', color: tk.text.primary },
    benefits: { marginTop: 6, fontSize: 13, color: tk.text.medium, lineHeight: 22 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
    muted: { fontSize: 12, color: tk.text.secondary, marginTop: 8 },
    error: { fontSize: 13, color: tk.danger.DEFAULT, textAlign: 'center' },
    backBtn: { marginTop: 12 },
  })
}
