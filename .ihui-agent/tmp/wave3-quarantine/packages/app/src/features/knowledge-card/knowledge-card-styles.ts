// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadius, rnRadiusFor } from '@ihui/design-tokens'
import { StyleSheet } from 'react-native'
import type { AppThemeTokens } from '../../theme/tokens'

/**
 * 知识卡片屏样式(knowledge-card 域;对齐 web apps/web/app/(main)/knowledge-cards/page.tsx)。
 * 颜色一律取 getTokens 的 token,零硬编码色值;圆角一律 rnRadius 角色档。
 * 卡片底 = surface.card(对齐 web `ui-card` + `border`),描边取 border.light(非墨档)。
 */
export function createKnowledgeCardStyles(tk: AppThemeTokens) {
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
    scroll: { padding: 12, paddingBottom: 40, gap: 14 },
    heroTitle: { fontSize: 22, fontWeight: '700', color: tk.text.primary },
    heroSubtitle: { marginTop: 4, fontSize: 12, color: tk.text.secondary },
    card: {
      backgroundColor: tk.surface.card,
      borderRadius: rnRadius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      padding: 12,
      gap: 10,
    },
    cardTitle: { fontSize: 15, fontWeight: '700', color: tk.text.primary },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    fieldRow: { gap: 4 },
    fieldLabel: { fontSize: 12, color: tk.text.secondary },
    input: {
      minHeight: 38,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 13,
      color: tk.text.primary,
      backgroundColor: tk.surface.inputBg,
      borderRadius: rnRadiusFor.control,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
    },
    inputMultiline: { minHeight: 96, textAlignVertical: 'top' },
    kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    kindChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: rnRadiusFor.chip,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.muted,
    },
    kindChipActive: {
      backgroundColor: tk.brand.cta,
      borderColor: tk.brand.cta,
    },
    kindChipText: { fontSize: 12, color: tk.text.secondary },
    kindChipTextActive: { color: tk.brand.ctaForeground, fontWeight: '600' },
    btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
    btnPrimary: {
      minWidth: 96,
      paddingVertical: 9,
      paddingHorizontal: 14,
      borderRadius: rnRadiusFor.control,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
    },
    btnPrimaryText: { fontSize: 13, fontWeight: '600', color: tk.brand.ctaForeground },
    btnGhost: {
      minWidth: 72,
      paddingVertical: 9,
      paddingHorizontal: 14,
      borderRadius: rnRadiusFor.control,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
      alignItems: 'center',
    },
    btnGhostText: { fontSize: 13, color: tk.text.primary },
    btnDanger: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: rnRadiusFor.control,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
    },
    btnDangerText: { fontSize: 12, color: tk.danger.DEFAULT },
    btnDisabled: { opacity: 0.45 },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 10,
      borderRadius: rnRadius.md,
      backgroundColor: tk.error.bg,
    },
    errorText: { flex: 1, fontSize: 12, color: tk.error.text },
    list: { gap: 8 },
    row: {
      borderRadius: rnRadius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      padding: 10,
      gap: 6,
      backgroundColor: tk.surface.bg,
    },
    rowTitle: { fontSize: 14, fontWeight: '600', color: tk.text.primary },
    badge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: rnRadiusFor.chip,
      backgroundColor: tk.surface.muted,
    },
    badgeText: { fontSize: 10, color: tk.text.secondary },
    rowMeta: { fontSize: 11, color: tk.text.tertiary },
    rowContent: { fontSize: 12, color: tk.text.secondary },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
    emptyBox: {
      paddingVertical: 26,
      alignItems: 'center',
      gap: 6,
      borderStyle: 'dashed',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      borderRadius: rnRadius.md,
    },
    emptyText: { fontSize: 13, color: tk.text.tertiary },
    detailText: { fontSize: 13, lineHeight: 20, color: tk.text.primary },
    loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 16 },
    loadingText: { fontSize: 13, color: tk.text.secondary },
    skeleton: {
      height: 46,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
