// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnHue, rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { StyleSheet } from 'react-native'
import type { AppThemeTokens } from '../../theme/tokens'

/**
 * finance-ai 财务部板块固定语义色板(与 web 端 tailwind emerald/blue/rose/amber/slate 同源)。
 * 固定语义色不随主题换档;色值唯一真相源 = packages/design-tokens/src/hue-tints.js 的 rnHue 表。
 * 结构色(容器/文字/边框/输入底/CTA)一律走 tk.* token,零硬编码(先例:edu-ai-styles.ts)。
 */
export const FINANCE_AI_PALETTE = {
  emerald: { bg: rnHue.emerald.tint, fg: rnHue.emerald.fg },
  blue: { bg: rnHue.blue.tint, fg: rnHue.blue.fg },
  violet: { bg: rnHue.violet.tint, fg: rnHue.violet.fg },
  rose: { bg: rnHue.rose.tintStrong, fg: rnHue.rose.fg },
  amber: { bg: rnHue.amber.tintStrong, fg: rnHue.amber.fg },
  slate: { bg: rnHue.zinc.tintStrong, fg: rnHue.zinc.fg },
} as const
export type FinanceAiTone = keyof typeof FINANCE_AI_PALETTE

export function createFinanceAiStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    scroll: { paddingHorizontal: rnSpacing.md, paddingBottom: rnSpacing.xl, gap: rnSpacing.md },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingTop: rnSpacing.md,
      paddingBottom: rnSpacing.xs,
    },
    headerIcon: { color: tk.brandAccent.DEFAULT },
    headerTitle: {
      fontSize: rnType.title.size,
      fontWeight: '700',
      color: tk.text.primary,
      flex: 1,
    },
    intro: {
      fontSize: rnType.body.size,
      lineHeight: rnType.body.lineHeight,
      color: tk.text.secondary,
    },

    card: {
      backgroundColor: tk.surface.light,
      borderRadius: rnRadius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      padding: rnSpacing.md,
      gap: rnSpacing.sm,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    cardIcon: { color: tk.brandAccent.DEFAULT },
    cardTitle: {
      fontSize: rnType.subtitle.size,
      fontWeight: '700',
      color: tk.text.primary,
      flex: 1,
    },
    cardDesc: {
      fontSize: rnType.label.size,
      lineHeight: rnType.label.lineHeight,
      color: tk.text.secondary,
    },

    fieldLabel: { fontSize: rnType.label.size, fontWeight: '600', color: tk.text.primary },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
      borderRadius: rnRadius.md,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.xs,
      fontSize: rnType.body.size,
      color: tk.text.primary,
      backgroundColor: tk.surface.bg,
    },
    textarea: { minHeight: 72, textAlignVertical: 'top' },

    // 平台自动化目标多选
    targetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.xs },
    targetChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 6,
      borderRadius: rnRadius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    targetChipActive: {
      borderColor: tk.brand.DEFAULT,
      backgroundColor: FINANCE_AI_PALETTE.emerald.bg,
    },
    targetChipText: { fontSize: rnType.label.size, color: tk.text.primary },
    targetChipTextActive: { color: FINANCE_AI_PALETTE.emerald.fg, fontWeight: '600' },

    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.xs,
      backgroundColor: tk.brand.DEFAULT,
      borderRadius: rnRadius.md,
      paddingVertical: rnSpacing.sm,
    },
    ctaDisabled: { opacity: 0.5 },
    ctaText: { color: tk.brand.ctaForeground, fontWeight: '600', fontSize: rnType.body.size },
    note: {
      fontSize: rnType.label.size,
      lineHeight: rnType.label.lineHeight,
      color: tk.text.tertiary,
    },

    // 进度回显
    progressHead: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
    progressTitle: { fontSize: rnType.subtitle.size, fontWeight: '700', color: tk.text.primary },
    stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: rnSpacing.xs },
    stepDot: {
      marginTop: 4,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: tk.text.tertiary,
    },
    stepDotActive: { backgroundColor: FINANCE_AI_PALETTE.emerald.fg },
    stepText: {
      flex: 1,
      fontSize: rnType.label.size,
      lineHeight: rnType.label.lineHeight,
      color: tk.text.secondary,
    },
    emptyText: {
      fontSize: rnType.body.size,
      color: tk.text.tertiary,
      paddingVertical: rnSpacing.sm,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
