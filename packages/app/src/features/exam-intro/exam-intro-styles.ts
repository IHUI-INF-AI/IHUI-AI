// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadiusFor, rnSpacing, rnType } from '@ihui/design-tokens'
import { StyleSheet } from 'react-native'
import type { AppThemeTokens } from '../../theme/tokens'

/** 「试卷介绍」共享屏样式表(web + 小程序;RN 无此屏)。数值/圆角/CTA 均走 design-tokens 角色档。 */
export function createExamIntroStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: tk.surface.bg },
    scrollContent: { padding: rnSpacing['sm-loose'], paddingBottom: rnSpacing['2xl'] },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      marginBottom: rnSpacing.sm,
    },
    backBtn: { paddingVertical: rnSpacing.xs, paddingRight: rnSpacing.xs },
    headerTitle: { flex: 1, fontSize: rnType.bodySm.size, color: tk.text.secondary },
    card: {
      backgroundColor: tk.surface.card,
      borderRadius: rnRadiusFor.card,
      padding: rnSpacing['md-loose'],
      marginBottom: rnSpacing['sm-loose'],
    },
    paperTitle: {
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: rnSpacing.xs,
    },
    description: {
      fontSize: rnType.bodySm.size,
      color: tk.text.secondary,
      lineHeight: rnType.bodySm.size * 1.6,
      marginBottom: rnSpacing.sm,
    },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm },
    statCell: {
      width: '48%',
      backgroundColor: tk.surface.muted,
      borderRadius: rnRadiusFor.control,
      paddingVertical: rnSpacing.sm,
      alignItems: 'center',
    },
    statLabel: {
      fontSize: rnType.label.size,
      color: tk.text.secondary,
      marginBottom: 4,
    },
    statValue: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    sectionCard: {
      backgroundColor: tk.surface.card,
      borderRadius: rnRadiusFor.card,
      padding: rnSpacing.md,
      marginBottom: rnSpacing['sm-loose'],
    },
    sectionTitle: {
      fontSize: rnType.strong.size,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: rnSpacing.xs,
    },
    partRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: rnSpacing.xs,
    },
    partLabel: { fontSize: rnType.bodySm.size, color: tk.text.secondary },
    partValue: { fontSize: rnType.bodySm.size, color: tk.text.primary, fontWeight: '500' },
    ruleItem: {
      fontSize: rnType.bodySm.size,
      color: tk.text.secondary,
      lineHeight: rnType.bodySm.size * 1.6,
      marginBottom: 4,
    },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: rnSpacing.xs,
    },
    historyLeft: { flex: 1, gap: 2 },
    historyStatus: { fontSize: rnType.bodySm.size, color: tk.text.primary, fontWeight: '500' },
    historyMeta: { fontSize: rnType.label.size, color: tk.text.secondary },
    historyScore: { fontSize: rnType.bodySm.size, color: tk.text.primary, fontWeight: '600' },
    historyScoreFailed: { color: tk.danger.bright },
    emptyText: {
      fontSize: rnType.bodySm.size,
      color: tk.text.secondary,
      paddingVertical: rnSpacing.sm,
    },
    startBtn: {
      alignItems: 'center',
      paddingVertical: 15,
      borderRadius: rnRadiusFor.control,
      backgroundColor: tk.brand.cta,
    },
    startBtnDisabled: { opacity: 0.6 },
    startText: { fontSize: rnType.title.size, fontWeight: '600', color: tk.brand.ctaForeground },
    errorText: {
      fontSize: rnType.bodySm.size,
      color: tk.danger.bright,
      marginTop: rnSpacing.sm,
    },
    stateBox: { alignItems: 'center', paddingVertical: rnSpacing.xl },
    stateText: {
      fontSize: rnType.bodySm.size,
      color: tk.text.secondary,
      marginTop: rnSpacing.sm,
    },
    retryBtn: {
      marginTop: rnSpacing.md,
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadiusFor.control,
      backgroundColor: tk.brand.cta,
    },
    retryText: { fontSize: rnType.bodySm.size, fontWeight: '500', color: tk.brand.ctaForeground },
  })
}
