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
import { rnDarkTokens, rnHue, rnRadius, rnSpacing } from '@ihui/design-tokens'
import { StyleSheet } from 'react-native'
import type { AppThemeTokens } from '../../theme/tokens'

/** 状态语义色板(固定语义色,不随主题换档;与 STATUS_PALETTE 同档同源,
 *  色相族底/前景唯一真相源 = packages/design-tokens/src/hue-tints.js 的 rnHue 表,2026-10-31 收编)。 */
export const STUDENT_PALETTE = {
  pending: { bg: rnHue.amber.tintStrong, fg: rnHue.amber.fg },
  completed: { bg: rnHue.emerald.tint, fg: rnHue.emerald.fg },
  muted: { bg: rnHue.zinc.tintStrong, fg: rnDarkTokens.text.tertiary },
  rejected: { bg: rnHue.rose.tintStrong, fg: rnHue.rose.fg },
} as const

export type StudentTone = keyof typeof STUDENT_PALETTE

export function createStudentStyles(tk: AppThemeTokens) {
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
    headerActions: {
      marginLeft: 'auto',
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing['xs-loose'],
    },
    scroll: { padding: rnSpacing.md, paddingBottom: rnSpacing['3xl'], gap: rnSpacing.md },
    hero: { gap: rnSpacing.xs },
    heroTitle: { fontSize: 22, fontWeight: '700', color: tk.text.primary },
    heroSubtitle: { fontSize: 12, color: tk.text.secondary },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: tk.text.primary,
      marginBottom: rnSpacing['sm-loose'],
    },
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
    // —— 统计卡网格(报告页)——
    statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing['sm-loose'] },
    statCard: {
      flexGrow: 1,
      flexBasis: '46%',
      backgroundColor: tk.surface.light,
      borderRadius: rnRadius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      padding: rnSpacing.md,
      gap: rnSpacing['xs-loose'],
    },
    statHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    statLabel: { fontSize: 12, color: tk.text.secondary },
    statValue: { fontSize: 22, fontWeight: '700', color: tk.text.primary },
    statValueCompleted: { fontSize: 22, fontWeight: '700', color: STUDENT_PALETTE.completed.fg },
    statValueBrand: { fontSize: 22, fontWeight: '700', color: tk.brand.DEFAULT },
    // —— 快捷入口(报告页)——
    quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing['sm-loose'] },
    quickItem: {
      flexGrow: 1,
      flexBasis: '46%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing['sm-loose'],
      backgroundColor: tk.surface.light,
      borderRadius: rnRadius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      padding: rnSpacing.md,
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
    exportRow: { flexDirection: 'row', gap: rnSpacing.sm, flexWrap: 'wrap' },
    exportBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
    },
    exportBtnText: { fontSize: 12, fontWeight: '600', color: tk.text.primary },
    // —— 徽章 ——
    badge: {
      alignSelf: 'flex-start',
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 3,
      borderRadius: rnRadius.md,
    },
    badgeText: { fontSize: 11, fontWeight: '600' },
    // —— 列表行 ——
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing['sm-loose'],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tk.border.light,
    },
    rowMain: { flex: 1, gap: rnSpacing.xs },
    rowTitle: { fontSize: 14, fontWeight: '600', color: tk.text.primary },
    rowSub: { fontSize: 11, color: tk.text.tertiary },
    rowBody: { fontSize: 13, color: tk.text.secondary, lineHeight: 19 },
    rowMeta: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: rnSpacing['sm-loose'],
    },
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
    progressFill: {
      height: '100%',
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brandAccent.deep,
    },
    // —— 操作按钮 ——
    iconBtn: { padding: rnSpacing['xs-loose'], borderRadius: rnRadius.sm },
    dangerText: { fontSize: 12, fontWeight: '600', color: STUDENT_PALETTE.rejected.fg },
    ctaBtn: {
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: rnSpacing['xs-loose'],
      paddingVertical: 11,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    ctaBtnText: { fontSize: 14, fontWeight: '600', color: tk.brand.ctaForeground },
    ghostBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 9,
      paddingHorizontal: rnSpacing.lg,
      borderRadius: rnRadius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
    },
    ghostBtnText: { fontSize: 13, color: tk.text.secondary },
    // —— 分页 ——
    pagerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.md,
    },
    pagerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      paddingVertical: rnSpacing.sm,
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
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['3xl'],
      borderRadius: rnRadius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
      borderStyle: 'dashed',
    },
    emptyText: { fontSize: 13, color: tk.text.tertiary },
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
    skeletonRow: { height: 56, borderRadius: rnRadius.lg, backgroundColor: tk.border.light },
    // —— 表单(线下学习记录)——
    formLabel: { fontSize: 12, color: tk.text.secondary, marginBottom: rnSpacing.xs },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
      borderRadius: rnRadius.sm,
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.sm,
      fontSize: 14,
      color: tk.text.primary,
      backgroundColor: tk.surface.inputBg,
    },
    inputArea: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
      borderRadius: rnRadius.sm,
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.sm,
      fontSize: 14,
      color: tk.text.primary,
      backgroundColor: tk.surface.inputBg,
      minHeight: 64,
      textAlignVertical: 'top',
    },
    formRow: { flexDirection: 'row', gap: rnSpacing['sm-loose'] },
    formErr: { fontSize: 12, color: STUDENT_PALETTE.rejected.fg },
    formActions: { flexDirection: 'row', gap: rnSpacing['sm-loose'] },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
