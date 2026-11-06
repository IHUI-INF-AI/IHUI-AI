// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { CheckCircle2, ChevronRight } from 'lucide-react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TopupSuccessScreenProps } from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'

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
  title,
  subtitle,
  notice,
  rows,
  secondaryLabel,
  primaryLabel,
  footerLink,
  showBack = true,
}: TopupSuccessScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  // 缺省仍是充值结果三行;调用方传 rows 时整卡由其驱动(如 VIP 开通成功的多字段订单卡)
  const detailRows = rows ?? [
    { label: '充值金额', value: `¥${amount.toFixed(2)}` },
    { label: '订单编号', value: orderId },
    { label: '充值时间', value: time ?? '' },
  ]

  return (
    <View style={styles.container}>
      {showBack && (
        <View style={styles.header}>
          <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
          <Text style={styles.title}>{title ?? '充值结果'}</Text>
        </View>
      )}
      <View style={styles.body}>
        <CheckCircle2 size={64} color={tk.success.deep} />
        <Text style={styles.titleText}>{title ?? t('wallet.rechargeSuccess')}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {notice ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}
        <View style={styles.card}>
          {detailRows.map((r, i) => (
            <Row
              key={`${r.label}-${i}`}
              label={r.label}
              value={r.value}
              onPress={r.onPress}
              tk={tk}
              styles={styles}
            />
          ))}
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.7} onPress={onViewOrder}>
            <Text style={styles.secondaryText}>{secondaryLabel ?? '查看订单'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.7} onPress={onGoHome}>
            <Text style={styles.primaryText}>{primaryLabel ?? '返回首页'}</Text>
          </TouchableOpacity>
          {faqItems && faqItems.length > 0 && onFaqVisibleChange && (
            <TouchableOpacity
              style={styles.faqLink}
              activeOpacity={0.7}
              onPress={() => onFaqVisibleChange(true)}
            >
              <Text style={styles.faqText}>常见问题 ?</Text>
            </TouchableOpacity>
          )}
        </View>
        {footerLink ? (
          <TouchableOpacity style={styles.footer} activeOpacity={0.7} onPress={footerLink.onPress}>
            <View style={styles.footerMain}>
              <Text style={styles.footerTitle}>{footerLink.title}</Text>
              <Text style={styles.footerDesc}>{footerLink.desc}</Text>
            </View>
            <ChevronRight size={24} color={tk.text.secondary} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  )
}

function Row({
  label,
  value,
  onPress,
  tk,
  styles,
}: {
  label: string
  value: string
  onPress?: () => void
  tk: AppThemeTokens
  styles: ReturnType<typeof createStyles>
}) {
  const inner = (
    <>
      <Text style={[styles.rowLabel, { color: tk.text.secondary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: tk.text.primary }]} numberOfLines={1}>
        {value}
      </Text>
    </>
  )
  return onPress ? (
    <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={onPress}>
      {inner}
    </TouchableOpacity>
  ) : (
    <View style={styles.row}>{inner}</View>
  )
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontSize: rnType.body.size },
  rowValue: { fontSize: rnType.title.size, maxWidth: '60%' },
})

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
    title: { fontSize: rnType.heading.size, fontWeight: '600', color: tk.text.primary },
    body: { flex: 1, alignItems: 'center', padding: rnSpacing['2xl'], gap: rnSpacing.md },
    icon: { fontSize: 64, marginTop: rnSpacing.md },
    titleText: { fontSize: rnType.heading.size, fontWeight: '700', color: tk.success.deep },
    subtitle: { fontSize: rnType.body.size, color: tk.text.secondary, textAlign: 'center' },
    notice: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: rnRadius.md,
      paddingVertical: rnSpacing.sm,
      paddingHorizontal: rnSpacing.md,
      backgroundColor: tk.surface.light,
    },
    noticeText: { flex: 1, fontSize: rnType.body.size, color: tk.text.secondary },
    card: {
      width: '100%',
      backgroundColor: tk.surface.light,
      borderRadius: rnRadius.lg,
      padding: rnSpacing.md,
      gap: rnSpacing.md,
    },
    ...rowStyles,
    actions: { width: '100%', gap: rnSpacing.md, marginTop: rnSpacing.sm },
    secondaryBtn: {
      borderRadius: rnRadius.sm,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.card,
    },
    secondaryText: { fontSize: rnType.title.size, color: tk.text.primary },
    primaryBtn: {
      borderRadius: rnRadius.sm,
      height: 50,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.brand.cta,
    },
    primaryText: { fontSize: rnType.title.size, fontWeight: '600', color: tk.surface.light },
    faqLink: { paddingVertical: rnSpacing['xs-loose'], alignSelf: 'center' },
    faqText: { fontSize: rnType.body.size, color: tk.text.secondary },
    footer: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      borderRadius: rnRadius.lg,
      padding: rnSpacing.md,
      backgroundColor: tk.surface.card,
    },
    footerMain: { flex: 1, gap: rnSpacing['xs-loose'] },
    footerTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    footerDesc: { fontSize: rnType.body.size, color: tk.text.secondary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
