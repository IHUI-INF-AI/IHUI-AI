// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnHue, rnHueTintOnly, rnRadius, rnTokens, rnSpacing } from '@ihui/design-tokens'
import { StyleSheet } from 'react-native'
import type { AppThemeTokens } from '../../theme/tokens'

/**
 * 工单状态语义色板(与 web helpers.ts STATUS_BADGE 同源:
 * pending=灰 / open=amber / resolved=emerald / closed=orange / rejected=red,
 * 固定语义色,不随主题换档 —— 与 status-styles.ts STATUS_PALETTE 同一先例)。
 * 底色/前景一律取色相族唯一真相源 rnHue(端内不得再手抄 rgba/#hex 字面量);
 * alpha 按本屏原取值选档(0.10→tint、0.12→tintStrong),收编前后字符串逐字节相同。
 */
export const TICKET_STATUS_PALETTE = {
  pending: { bg: rnHue.tailwindGray.tintStrong, fg: rnHue.tailwindGray.fg },
  open: { bg: rnHue.amber.tintStrong, fg: rnHue.amber.fg },
  resolved: { bg: rnHue.emerald.tint, fg: rnHue.emerald.fg },
  closed: { bg: rnHue.orange.tintStrong, fg: rnHue.orange.fg },
  rejected: { bg: rnHueTintOnly.red.tintStrong, fg: rnTokens.danger.DEFAULT },
} as const

/** 优先级色板(与 web 端 amber/sky/red 语义同源;取档同上,值来自 rnHue)。 */
export const TICKET_PRIORITY_PALETTE = {
  low: { bg: rnHue.tailwindGray.tintStrong, fg: rnHue.tailwindGray.fg },
  medium: { bg: rnHue.sky.tint, fg: rnHue.sky.fg },
  high: { bg: rnHue.amber.tintStrong, fg: rnHue.amber.fg },
  urgent: { bg: rnHueTintOnly.red.tintStrong, fg: rnTokens.danger.DEFAULT },
} as const

/** 服务评价星标琥珀色(web fill-amber-500 同源,取 design-tokens 的 warning.amber 单一真相源)。 */
export const RATING_AMBER = rnTokens.warning.amber

export function createSupportStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.md,
    },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: tk.text.primary },
    scroll: { padding: rnSpacing.md, paddingBottom: rnSpacing['3xl'], gap: rnSpacing.md },
    hero: { gap: rnSpacing.xs },
    heroTitle: { fontSize: 22, fontWeight: '700', color: tk.text.primary },
    heroSubtitle: { fontSize: 12, color: tk.text.secondary },
    /* 页签(web tab 条同源:容器描边 + 选中胶囊实底) */
    tabRow: {
      flexDirection: 'row',
      gap: rnSpacing.xs,
      padding: rnSpacing.xs,
      borderRadius: rnRadius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.muted,
    },
    tabBtn: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: rnRadius.sm,
    },
    tabBtnActive: {
      backgroundColor: tk.selection.DEFAULT,
    },
    tabText: { fontSize: 13, fontWeight: '600', color: tk.text.secondary },
    tabTextActive: { color: tk.selection.foreground },
    card: {
      backgroundColor: tk.surface.light,
      borderRadius: rnRadius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      padding: rnSpacing.md,
      gap: rnSpacing['sm-loose'],
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: rnRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.muted,
    },
    cardTitle: { fontSize: 16, fontWeight: '700', color: tk.text.primary },
    rowMain: { flex: 1, gap: rnSpacing['2xs'] },
    rowTitle: { fontSize: 14, fontWeight: '600', color: tk.text.primary },
    rowSub: { fontSize: 11, color: tk.text.tertiary },
    badge: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 3,
      borderRadius: rnRadius.md,
    },
    badgeText: { fontSize: 11, fontWeight: '600' },
    emptyBox: {
      borderWidth: StyleSheet.hairlineWidth,
      borderStyle: 'dashed',
      borderColor: tk.border.medium,
      borderRadius: rnRadius.lg,
      paddingVertical: rnSpacing['3xl'],
      alignItems: 'center',
      gap: rnSpacing.sm,
    },
    emptyText: { fontSize: 13, color: tk.text.secondary },
    /* 表单 */
    fieldLabel: { fontSize: 12, fontWeight: '600', color: tk.text.medium, marginTop: rnSpacing.xs },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.inputBg,
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.sm,
      fontSize: 13,
      color: tk.text.primary,
    },
    inputMultiline: { minHeight: 96, textAlignVertical: 'top' },
    replyInput: { minHeight: 56, textAlignVertical: 'top' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm },
    chip: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing['xs-loose'],
      borderRadius: rnRadius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
      backgroundColor: tk.surface.inputBg,
    },
    chipActive: { backgroundColor: tk.brand.cta, borderColor: tk.brand.cta },
    chipText: { fontSize: 12, color: tk.text.secondary },
    chipActiveText: { color: tk.brand.ctaForeground, fontWeight: '600' },
    formErr: { fontSize: 12, color: tk.danger.DEFAULT },
    formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: rnSpacing.sm },
    primaryBtn: {
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    primaryBtnText: { fontSize: 13, fontWeight: '600', color: tk.brand.ctaForeground },
    secondaryBtn: {
      alignSelf: 'flex-start',
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
      backgroundColor: tk.surface.inputBg,
    },
    secondaryBtnText: { fontSize: 13, color: tk.text.medium },
    btnDisabled: { opacity: 0.6 },
    /* 详情 */
    detailTitle: { fontSize: 16, fontWeight: '700', color: tk.text.primary, flex: 1 },
    detailNo: { fontSize: 11, color: tk.text.tertiary },
    metaLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: rnSpacing.sm },
    metaLabel: { fontSize: 12, color: tk.text.secondary },
    descBox: {
      backgroundColor: tk.surface.muted,
      borderRadius: rnRadius.sm,
      padding: rnSpacing['sm-loose'],
      gap: rnSpacing.xs,
    },
    descLabel: { fontSize: 11, fontWeight: '600', color: tk.text.tertiary },
    descText: { fontSize: 13, color: tk.text.primary, lineHeight: 19 },
    commentsBox: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      borderRadius: rnRadius.sm,
      padding: rnSpacing.sm,
      gap: rnSpacing.sm,
      maxHeight: 220,
    },
    commentRow: {
      borderRadius: rnRadius.sm,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing['xs-loose'],
      gap: rnSpacing['2xs'],
    },
    commentAdmin: { backgroundColor: tk.brandAccent.light },
    commentUser: { backgroundColor: tk.surface.muted },
    commentMeta: { fontSize: 11, color: tk.text.tertiary },
    commentRole: { fontSize: 11, fontWeight: '600', color: tk.text.secondary },
    commentText: { fontSize: 13, color: tk.text.primary, lineHeight: 18 },
    starRow: { flexDirection: 'row', gap: rnSpacing['xs-loose'] },
    ratingBox: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      borderRadius: rnRadius.sm,
      padding: rnSpacing['sm-loose'],
      gap: rnSpacing['xs-loose'],
    },
    errorText: { fontSize: 13, color: tk.danger.DEFAULT },
    skeletonRow: { height: 44, borderRadius: rnRadius.lg, backgroundColor: tk.border.light },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
