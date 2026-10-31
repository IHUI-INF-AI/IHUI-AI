// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnHue, rnRadius, rnTokens, rnSpacing } from '@ihui/design-tokens'
import { StyleSheet } from 'react-native'
import type { AppThemeTokens } from '../../theme/tokens'

/** 状态语义色板(与 web 端 emerald/amber/rose/sky 同源,固定语义色,不随主题换档)。
 *  amber / danger 两档直接取 design-tokens(单一真相源),不再手抄同值 hex;
 *  色相族底/前景/圆点唯一真相源 = packages/design-tokens/src/hue-tints.js 的 rnHue 表(2026-10-31 收编)。 */
export const STATUS_PALETTE = {
  operational: { bg: rnHue.emerald.tint, fg: rnHue.emerald.fg, dot: rnHue.emerald.dot },
  degraded: { bg: rnHue.amber.tintStrong, fg: rnHue.amber.fg, dot: rnTokens.warning.amber },
  outage: { bg: rnHue.rose.tintStrong, fg: rnHue.rose.fg, dot: rnHue.rose.dot },
  minor: { bg: rnHue.sky.tint, fg: rnHue.sky.fg, dot: rnHue.sky.dot },
  major: { bg: rnHue.amber.tintStrong, fg: rnHue.amber.fg, dot: rnTokens.warning.amber },
  critical: { bg: rnHue.rose.tintStrong, fg: rnHue.rose.fg, dot: rnHue.rose.dot },
} as const

export function createStatusStyles(tk: AppThemeTokens) {
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
    hero: { gap: rnSpacing.xs },
    heroTitle: { fontSize: 22, fontWeight: '700', color: tk.text.primary },
    heroSubtitle: { fontSize: 12, color: tk.text.secondary },
    card: {
      backgroundColor: tk.surface.light,
      borderRadius: rnRadius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      padding: rnSpacing.md,
      gap: rnSpacing['sm-loose'],
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    cardTitle: { fontSize: 16, fontWeight: '700', color: tk.text.primary },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
    metaLabel: { fontSize: 11, color: tk.text.tertiary },
    metaValue: { fontSize: 11, color: tk.text.secondary },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 3,
      borderRadius: rnRadius.md,
    },
    badgeText: { fontSize: 11, fontWeight: '600' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: rnSpacing.sm,
      gap: rnSpacing.sm,
    },
    rowMain: { flex: 1, gap: rnSpacing['2xs'] },
    rowTitle: { fontSize: 14, color: tk.text.primary },
    rowSub: { fontSize: 11, color: tk.text.tertiary },
    rowMeta: { alignItems: 'flex-end', gap: rnSpacing['2xs'] },
    incidentRow: { gap: rnSpacing['xs-loose'], paddingVertical: rnSpacing.sm },
    incidentDesc: { fontSize: 13, color: tk.text.primary, lineHeight: 19 },
    incidentTime: { fontSize: 11, color: tk.text.tertiary },
    noticeBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      backgroundColor: STATUS_PALETTE.degraded.bg,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing['sm-loose'],
      borderRadius: rnRadius.md,
    },
    noticeText: { flex: 1, fontSize: 13, color: STATUS_PALETTE.degraded.fg },
    errorBox: { alignItems: 'center', gap: rnSpacing.sm, paddingVertical: rnSpacing['2xl'] },
    errorText: { fontSize: 14, fontWeight: '600', color: tk.text.primary },
    errorSub: { fontSize: 12, color: tk.text.secondary },
    refreshBtn: {
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: rnSpacing['sm-loose'],
      paddingHorizontal: rnSpacing.xl,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    refreshText: { fontSize: 14, fontWeight: '600', color: tk.brand.ctaForeground },
    skeletonTitle: {
      height: 20,
      width: 160,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.border.light,
    },
    skeletonRow: { height: 44, borderRadius: rnRadius.lg, backgroundColor: tk.border.light },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
