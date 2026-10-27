// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 学生中心域共享样式(Wave2 2026-10-26 立)。
 *
 * 色板与 status-styles.ts STATUS_PALETTE 同源档位(web 端 amber/emerald/muted/red 语义色):
 * - pending  amber  → 课程进行中(status=1)/ 资源待审核(status=0)
 * - completed emerald → 课程已完成(status=2)/ 资源已发布(status=1)
 * - muted    中性灰  → 课程已退款(status=3)/ 资源已下架(status=2),对齐 web bg-muted
 * - rejected rose   → 资源已驳回(status=3)
 * 品牌色(进度条/进行中数值/快捷入口图标底)一律走 tk.brand token,不硬编码。
 */
import { rnRadius } from '@ihui/design-tokens'
import { StyleSheet } from 'react-native'
import type { AppThemeTokens } from '../../theme/tokens'

/** 状态语义色板(固定语义色,不随主题换档;与 STATUS_PALETTE 同档同源)。 */
export const STUDENT_PALETTE = {
  pending: { bg: 'rgba(245,158,11,0.12)', fg: '#d97706' },
  completed: { bg: 'rgba(16,185,129,0.10)', fg: '#059669' },
  muted: { bg: 'rgba(115,115,115,0.12)', fg: '#737373' }, // handcopy-token-exempt: 学生状态"静默"档的固定语义色,与 text.tertiary 同值不同语义(状态色板整表不随主题换档,挂主题档会让暗色下状态色与文字色一起漂)
  rejected: { bg: 'rgba(244,63,94,0.12)', fg: '#e11d48' },
} as const

export type StudentTone = keyof typeof STUDENT_PALETTE

export function createStudentStyles(tk: AppThemeTokens) {
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
    headerActions: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6 },
    scroll: { padding: 12, paddingBottom: 32, gap: 12 },
    hero: { gap: 4 },
    heroTitle: { fontSize: 22, fontWeight: '700', color: tk.text.primary },
    heroSubtitle: { fontSize: 12, color: tk.text.secondary },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: tk.text.primary,
      marginBottom: 10,
    },
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
    // —— 统计卡网格(报告页)——
    statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    statCard: {
      flexGrow: 1,
      flexBasis: '46%',
      backgroundColor: tk.surface.light,
      borderRadius: rnRadius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      padding: 12,
      gap: 6,
    },
    statHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    statLabel: { fontSize: 12, color: tk.text.secondary },
    statValue: { fontSize: 22, fontWeight: '700', color: tk.text.primary },
    statValueCompleted: { fontSize: 22, fontWeight: '700', color: STUDENT_PALETTE.completed.fg },
    statValueBrand: { fontSize: 22, fontWeight: '700', color: tk.brand.DEFAULT },
    // —— 快捷入口(报告页)——
    quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    quickItem: {
      flexGrow: 1,
      flexBasis: '46%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: tk.surface.light,
      borderRadius: rnRadius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      padding: 12,
    },
    quickIconBox: {
      width: 36,
      height: 36,
      borderRadius: rnRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.brandAccent.light,
    },
    quickText: { fontSize: 14, fontWeight: '600', color: tk.text.primary, flex: 1 },
    // —— 导出按钮行 ——
    exportRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    exportBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: rnRadius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
    },
    exportBtnText: { fontSize: 12, fontWeight: '600', color: tk.text.primary },
    // —— 徽章 ——
    badge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: rnRadius.md,
    },
    badgeText: { fontSize: 11, fontWeight: '600' },
    // —— 列表行 ——
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tk.border.light,
    },
    rowMain: { flex: 1, gap: 4 },
    rowTitle: { fontSize: 14, fontWeight: '600', color: tk.text.primary },
    rowSub: { fontSize: 11, color: tk.text.tertiary },
    rowBody: { fontSize: 13, color: tk.text.secondary, lineHeight: 19 },
    rowMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    metaText: { fontSize: 11, color: tk.text.tertiary },
    thumb: {
      width: 84,
      height: 48,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
    },
    thumbPlaceholder: {
      width: 84,
      height: 48,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // —— 进度条 ——
    progressTrack: {
      height: 6,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
      overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: rnRadius.sm, backgroundColor: tk.brand.DEFAULT },
    // —— 操作按钮 ——
    iconBtn: { padding: 6, borderRadius: rnRadius.sm },
    dangerText: { fontSize: 12, fontWeight: '600', color: STUDENT_PALETTE.rejected.fg },
    ctaBtn: {
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
      paddingVertical: 11,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    ctaBtnText: { fontSize: 14, fontWeight: '600', color: tk.brand.ctaForeground },
    ghostBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 9,
      paddingHorizontal: 16,
      borderRadius: rnRadius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
    },
    ghostBtnText: { fontSize: 13, color: tk.text.secondary },
    // —— 分页 ——
    pagerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
    pagerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: rnRadius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
    },
    pagerBtnText: { fontSize: 13, color: tk.text.primary },
    pagerBtnTextDisabled: { fontSize: 13, color: tk.text.tertiary },
    pageInfo: { fontSize: 12, color: tk.text.secondary },
    // —— 空态 / 错误 / 骨架 ——
    emptyBox: {
      alignItems: 'center',
      gap: 8,
      paddingVertical: 32,
      borderRadius: rnRadius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
      borderStyle: 'dashed',
    },
    emptyText: { fontSize: 13, color: tk.text.tertiary },
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
    skeletonRow: { height: 56, borderRadius: rnRadius.lg, backgroundColor: tk.border.light },
    // —— 表单(线下学习记录)——
    formLabel: { fontSize: 12, color: tk.text.secondary, marginBottom: 4 },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
      borderRadius: rnRadius.sm,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 14,
      color: tk.text.primary,
      backgroundColor: tk.surface.inputBg,
    },
    inputArea: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
      borderRadius: rnRadius.sm,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 14,
      color: tk.text.primary,
      backgroundColor: tk.surface.inputBg,
      minHeight: 64,
      textAlignVertical: 'top',
    },
    formRow: { flexDirection: 'row', gap: 10 },
    formErr: { fontSize: 12, color: STUDENT_PALETTE.rejected.fg },
    formActions: { flexDirection: 'row', gap: 10 },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
