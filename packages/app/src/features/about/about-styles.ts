// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadius, rnSpacing } from '@ihui/design-tokens'
import { StyleSheet } from 'react-native'
import type { AppThemeTokens } from '../../theme/tokens'

/**
 * 「关于我们」共享屏样式表。数值 = 设计稿 rpx/2(750 设计宽),与 RN 端 rpx() 换算同基准;
 * 圆角一律走 rnRadius 档(§4 守门 77),卡片描边取中性档 border.light(守门 83 R8),
 * 主按钮取 brand.cta + brand.ctaForeground 成对(§4 品牌 CTA 同源)。
 */
export function createAboutStyles(tk: AppThemeTokens) {
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
    scroll: { padding: rnSpacing.md, paddingBottom: rnSpacing['3xl'], gap: rnSpacing.md },
    hero: { alignItems: 'center', gap: rnSpacing.sm, paddingTop: rnSpacing.sm },
    heroTitle: { fontSize: 28, fontWeight: '700', textAlign: 'center', color: tk.text.primary },
    bodyText: { fontSize: 13, lineHeight: 20, color: tk.text.secondary },
    itemLabel: { fontSize: 14, color: tk.text.primary },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: tk.text.primary },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 5,
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      backgroundColor: tk.brandAccent.light,
    },
    chipText: { fontSize: 11, fontWeight: '500', color: tk.brandAccent.deep },
    card: {
      backgroundColor: tk.surface.light,
      borderRadius: rnRadius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      padding: rnSpacing.md,
      gap: rnSpacing.sm,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing['sm-loose'] },
    gridCell: { flexGrow: 1, flexBasis: '46%' },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    iconBox: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: rnRadius.lg,
      backgroundColor: tk.brandAccent.light,
    },
    cardTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: tk.text.primary },
    cardDesc: { fontSize: 12, lineHeight: 19, color: tk.text.secondary },
    statsCard: { gap: rnSpacing.md },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing['sm-loose'] },
    statCell: { flexGrow: 1, flexBasis: '44%', alignItems: 'center', gap: rnSpacing.xs },
    statValue: { fontSize: 24, fontWeight: '700', color: tk.brandAccent.deep },
    ctaCard: { alignItems: 'center', paddingVertical: 18, gap: rnSpacing['sm-loose'] },
    ctaPrimary: {
      alignSelf: 'stretch',
      alignItems: 'center',
      paddingVertical: 11,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    ctaPrimaryText: { fontSize: 14, fontWeight: '600', color: tk.brand.ctaForeground },
    ctaSecondary: {
      alignSelf: 'stretch',
      alignItems: 'center',
      paddingVertical: 11,
      borderRadius: rnRadius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
    },
    ctaSecondaryText: { fontSize: 14, fontWeight: '600', color: tk.text.primary },
    entryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 13,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
