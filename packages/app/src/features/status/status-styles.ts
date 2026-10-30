// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnHue, rnRadius, rnTokens } from '@ihui/design-tokens'
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
      paddingHorizontal: 10,
      paddingVertical: 12,
      gap: 12,
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: tk.text.primary },
    scroll: { padding: 12, paddingBottom: 32, gap: 12 },
    hero: { gap: 4 },
    heroTitle: { fontSize: 22, fontWeight: '700', color: tk.text.primary },
    heroSubtitle: { fontSize: 12, color: tk.text.secondary },
    card: {
      backgroundColor: tk.surface.light,
      borderRadius: rnRadius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      padding: 12,
      gap: 10,
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    cardTitle: { fontSize: 16, fontWeight: '700', color: tk.text.primary },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaLabel: { fontSize: 11, color: tk.text.tertiary },
    metaValue: { fontSize: 11, color: tk.text.secondary },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: rnRadius.md,
    },
    badgeText: { fontSize: 11, fontWeight: '600' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      gap: 8,
    },
    rowMain: { flex: 1, gap: 2 },
    rowTitle: { fontSize: 14, color: tk.text.primary },
    rowSub: { fontSize: 11, color: tk.text.tertiary },
    rowMeta: { alignItems: 'flex-end', gap: 2 },
    incidentRow: { gap: 6, paddingVertical: 8 },
    incidentDesc: { fontSize: 13, color: tk.text.primary, lineHeight: 19 },
    incidentTime: { fontSize: 11, color: tk.text.tertiary },
    noticeBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: STATUS_PALETTE.degraded.bg,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: rnRadius.md,
    },
    noticeText: { flex: 1, fontSize: 13, color: STATUS_PALETTE.degraded.fg },
    errorBox: { alignItems: 'center', gap: 8, paddingVertical: 24 },
    errorText: { fontSize: 14, fontWeight: '600', color: tk.text.primary },
    errorSub: { fontSize: 12, color: tk.text.secondary },
    refreshBtn: {
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 20,
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
