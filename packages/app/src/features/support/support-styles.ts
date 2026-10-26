// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadius, rnTokens } from '@ihui/design-tokens'
import { StyleSheet } from 'react-native'
import type { AppThemeTokens } from '../../theme/tokens'

/**
 * 工单状态语义色板(与 web helpers.ts STATUS_BADGE 同源:
 * pending=灰 / open=amber / resolved=emerald / closed=orange / rejected=red,
 * 固定语义色,不随主题换档 —— 与 status-styles.ts STATUS_PALETTE 同一先例)。
 */
export const TICKET_STATUS_PALETTE = {
  pending: { bg: 'rgba(107,114,128,0.12)', fg: '#6b7280' },
  open: { bg: 'rgba(245,158,11,0.12)', fg: '#d97706' },
  resolved: { bg: 'rgba(16,185,129,0.10)', fg: '#059669' },
  closed: { bg: 'rgba(249,115,22,0.12)', fg: '#ea580c' },
  rejected: { bg: 'rgba(239,68,68,0.12)', fg: rnTokens.danger.DEFAULT },
} as const

/** 优先级色板(与 web 端 amber/sky/red 语义同源)。 */
export const TICKET_PRIORITY_PALETTE = {
  low: { bg: 'rgba(107,114,128,0.12)', fg: '#6b7280' },
  medium: { bg: 'rgba(14,165,233,0.10)', fg: '#0284c7' },
  high: { bg: 'rgba(245,158,11,0.12)', fg: '#d97706' },
  urgent: { bg: 'rgba(239,68,68,0.12)', fg: rnTokens.danger.DEFAULT },
} as const

/** 服务评价星标琥珀色(web fill-amber-500 同源,取 design-tokens 的 warning.amber 单一真相源)。 */
export const RATING_AMBER = rnTokens.warning.amber

export function createSupportStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 12,
      gap: 12,
    },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: tk.text.primary },
    scroll: { padding: 12, paddingBottom: 32, gap: 12 },
    hero: { gap: 4 },
    heroTitle: { fontSize: 22, fontWeight: '700', color: tk.text.primary },
    heroSubtitle: { fontSize: 12, color: tk.text.secondary },
    /* 页签(web tab 条同源:容器描边 + 选中胶囊实底) */
    tabRow: {
      flexDirection: 'row',
      gap: 4,
      padding: 4,
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
      padding: 12,
      gap: 10,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: rnRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.muted,
    },
    cardTitle: { fontSize: 16, fontWeight: '700', color: tk.text.primary },
    rowMain: { flex: 1, gap: 2 },
    rowTitle: { fontSize: 14, fontWeight: '600', color: tk.text.primary },
    rowSub: { fontSize: 11, color: tk.text.tertiary },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: rnRadius.md,
    },
    badgeText: { fontSize: 11, fontWeight: '600' },
    emptyBox: {
      borderWidth: StyleSheet.hairlineWidth,
      borderStyle: 'dashed',
      borderColor: tk.border.medium,
      borderRadius: rnRadius.lg,
      paddingVertical: 32,
      alignItems: 'center',
      gap: 8,
    },
    emptyText: { fontSize: 13, color: tk.text.secondary },
    /* 表单 */
    fieldLabel: { fontSize: 12, fontWeight: '600', color: tk.text.medium, marginTop: 4 },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.inputBg,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 13,
      color: tk.text.primary,
    },
    inputMultiline: { minHeight: 96, textAlignVertical: 'top' },
    replyInput: { minHeight: 56, textAlignVertical: 'top' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: rnRadius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
      backgroundColor: tk.surface.inputBg,
    },
    chipActive: { backgroundColor: tk.brand.cta, borderColor: tk.brand.cta },
    chipText: { fontSize: 12, color: tk.text.secondary },
    chipActiveText: { color: tk.brand.ctaForeground, fontWeight: '600' },
    formErr: { fontSize: 12, color: tk.danger.DEFAULT },
    formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
    primaryBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    primaryBtnText: { fontSize: 13, fontWeight: '600', color: tk.brand.ctaForeground },
    secondaryBtn: {
      alignSelf: 'flex-start',
      paddingHorizontal: 16,
      paddingVertical: 8,
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
    metaLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    metaLabel: { fontSize: 12, color: tk.text.secondary },
    descBox: {
      backgroundColor: tk.surface.muted,
      borderRadius: rnRadius.sm,
      padding: 10,
      gap: 4,
    },
    descLabel: { fontSize: 11, fontWeight: '600', color: tk.text.tertiary },
    descText: { fontSize: 13, color: tk.text.primary, lineHeight: 19 },
    commentsBox: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      borderRadius: rnRadius.sm,
      padding: 8,
      gap: 8,
      maxHeight: 220,
    },
    commentRow: { borderRadius: rnRadius.sm, paddingHorizontal: 8, paddingVertical: 6, gap: 2 },
    commentAdmin: { backgroundColor: tk.brandAccent.light },
    commentUser: { backgroundColor: tk.surface.muted },
    commentMeta: { fontSize: 11, color: tk.text.tertiary },
    commentRole: { fontSize: 11, fontWeight: '600', color: tk.text.secondary },
    commentText: { fontSize: 13, color: tk.text.primary, lineHeight: 18 },
    starRow: { flexDirection: 'row', gap: 6 },
    ratingBox: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      borderRadius: rnRadius.sm,
      padding: 10,
      gap: 6,
    },
    errorText: { fontSize: 13, color: tk.danger.DEFAULT },
    skeletonRow: { height: 44, borderRadius: rnRadius.lg, backgroundColor: tk.border.light },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
