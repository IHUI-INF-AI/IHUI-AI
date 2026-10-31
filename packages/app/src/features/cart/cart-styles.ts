// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadius, rnSpacing } from '@ihui/design-tokens'
import { StyleSheet } from 'react-native'
import type { AppThemeTokens } from '../../theme/tokens'

/**
 * 购物车共享屏样式表。数值 = 设计稿 rpx/2(750 设计宽),与 RN 端 rpx() 换算同基准;
 * 圆角一律走 rnRadius 档(§4 守门 77),卡片/控件描边取中性档 border.light/medium(守门 83 R8),
 * 「去结算」主按钮取 brand.cta + brand.ctaForeground 成对(§4 品牌 CTA 同源),
 * 勾选选中态用 success(状态色,非品牌 CTA),价格正向绿、合计红(§4 积分正绿负红)。
 */
export function createCartStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.md,
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: tk.text.primary },
    listContent: { paddingBottom: rnSpacing.xl, gap: rnSpacing.md },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing['sm-loose'],
      marginHorizontal: rnSpacing.md,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.card,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: rnRadius.sm,
      borderWidth: 1.5,
      borderColor: tk.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: {
      backgroundColor: tk.success.DEFAULT,
      borderColor: tk.success.DEFAULT,
    },
    cover: {
      width: 70,
      height: 70,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    coverFallback: { alignItems: 'center', justifyContent: 'center' },
    info: { flex: 1, gap: 5 },
    title: { fontSize: 15, fontWeight: '600', color: tk.text.primary },
    price: { fontSize: 15, fontWeight: '600', color: tk.success.DEFAULT },
    qtyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      alignSelf: 'flex-start',
    },
    qtyBtn: {
      width: 24,
      height: 24,
      borderRadius: rnRadius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.bg,
    },
    qtyBtnDisabled: { opacity: 0.5 },
    qtyValue: { minWidth: 20, textAlign: 'center', fontSize: 14, color: tk.text.primary },
    deleteBtn: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing['sm-loose'],
      paddingBottom: rnSpacing.xl,
      backgroundColor: tk.surface.card,
    },
    selectAll: { fontSize: 14, color: tk.text.primary },
    totalWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'flex-end',
      gap: rnSpacing.xs,
    },
    totalLabel: { fontSize: 13, color: tk.text.secondary },
    totalPrice: { fontSize: 18, fontWeight: '700', color: tk.danger.DEFAULT },
    checkoutBtn: {
      paddingHorizontal: 18,
      height: 36,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkoutBtnDisabled: { opacity: 0.5 },
    checkoutText: { fontSize: 14, fontWeight: '600', color: tk.brand.ctaForeground },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
