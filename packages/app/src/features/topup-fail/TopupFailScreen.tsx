import { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TopupFailScreenProps } from '../../types'

/** Props 类型 re-export(单一来源 @ihui/types) */
export type { TopupFailScreenProps }

/**
 * 充值失败共享屏 — 纯 UI 渲染,平台无关
 *
 * 渲染失败图标 + 原因 + 重试/联系客服按钮
 * 导航/数据由 wrapper 通过 props 注入
 */
export function TopupFailScreen({
  t,
  reason = '充值未完成,请稍后重试',
  onRetry,
  onContactService,
  onBack,
  colorScheme = 'light',
}: TopupFailScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>充值结果</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.icon}>❌</Text>
        <Text style={styles.titleText}>充值失败</Text>
        <View style={styles.card}>
          <Text style={styles.reason}>{reason}</Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.7} onPress={onRetry}>
            <Text style={styles.primaryText}>重试</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.7} onPress={onContactService}>
            <Text style={styles.secondaryText}>联系客服</Text>
          </TouchableOpacity>
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
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 14, color: tk.text.medium },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    body: { flex: 1, alignItems: 'center', padding: 24, gap: 16 },
    icon: { fontSize: 64, marginTop: 24 },
    titleText: { fontSize: 20, fontWeight: '700', color: tk.danger.DEFAULT },
    card: {
      width: '100%',
      backgroundColor: tk.danger.light,
      borderRadius: 12,
      padding: 16,
    },
    reason: { fontSize: 14, color: tk.danger.DEFAULT, textAlign: 'center' },
    actions: { width: '100%', gap: 12, marginTop: 8 },
    primaryBtn: {
      borderRadius: 8,
      paddingVertical: 13,
      alignItems: 'center',
      backgroundColor: tk.brand.DEFAULT,
    },
    primaryText: { fontSize: 15, fontWeight: '600', color: tk.surface.light },
    secondaryBtn: {
      borderRadius: 8,
      paddingVertical: 13,
      alignItems: 'center',
      backgroundColor: tk.surface.card,
    },
    secondaryText: { fontSize: 15, color: tk.text.primary },
  })
}
