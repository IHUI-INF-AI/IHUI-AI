import { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TopupSuccessScreenProps } from '../../types'

/** Props 类型 re-export(单一来源 @ihui/types) */
export type { TopupSuccessScreenProps }

/**
 * 充值成功共享屏 — 纯 UI 渲染,平台无关
 *
 * 渲染成功图标 + 金额/订单号/时间 + 查看订单/返回首页按钮 + 常见问题入口
 * 弹窗等平台特定能力由 wrapper 注入
 */
export function TopupSuccessScreen({
  t,
  amount,
  orderId,
  time,
  onViewOrder,
  onGoHome,
  faqItems,
  onFaqVisibleChange,
  onBack,
  colorScheme = 'light',
}: TopupSuccessScreenProps) {
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
        <Text style={styles.icon}>✅</Text>
        <Text style={styles.titleText}>充值成功</Text>
        <View style={styles.card}>
          <Row label="充值金额" value={`¥${amount.toFixed(2)}`} tk={tk} styles={styles} />
          <Row label="订单编号" value={orderId} tk={tk} styles={styles} />
          <Row label="充值时间" value={time ?? ''} tk={tk} styles={styles} />
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.7} onPress={onViewOrder}>
            <Text style={styles.secondaryText}>查看订单</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.7} onPress={onGoHome}>
            <Text style={styles.primaryText}>返回首页</Text>
          </TouchableOpacity>
          {faqItems && faqItems.length > 0 && onFaqVisibleChange && (
            <TouchableOpacity style={styles.faqLink} activeOpacity={0.7} onPress={() => onFaqVisibleChange(true)}>
              <Text style={styles.faqText}>常见问题 ?</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  )
}

function Row({ label, value, tk, styles }: { label: string; value: string; tk: AppThemeTokens; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: tk.text.secondary }]}>
        {label}
      </Text>
      <Text style={[styles.rowValue, { color: tk.text.primary }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  )
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontSize: 14 },
  rowValue: { fontSize: 16, maxWidth: '60%' },
})

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
    backText: { fontSize: 16, color: tk.text.medium },
    title: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    body: { flex: 1, alignItems: 'center', padding: 24, gap: 12 },
    icon: { fontSize: 64, marginTop: 12 },
    titleText: { fontSize: 22, fontWeight: '700', color: tk.success.deep },
    card: {
      width: '100%',
      backgroundColor: tk.surface.light,
      borderRadius: 12,
      padding: 12,
      gap: 12,
    },
    ...rowStyles,
    actions: { width: '100%', gap: 12, marginTop: 8 },
    secondaryBtn: {
      borderRadius: 12,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.card,
    },
    secondaryText: { fontSize: 16, color: tk.text.primary },
    primaryBtn: {
      borderRadius: 12,
      height: 50,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.brand.DEFAULT,
    },
    primaryText: { fontSize: 16, fontWeight: '600', color: tk.surface.light },
    faqLink: { paddingVertical: 6, alignSelf: 'center' },
    faqText: { fontSize: 14, color: tk.text.secondary },
  })
}
