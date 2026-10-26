// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  CHART_AMBER,
  CHART_BLUE,
  CHART_CYAN,
  CHART_GREEN,
  CHART_ROSE,
  CHART_VIOLET,
  rnRadius,
  rnType,
} from '@ihui/design-tokens'
import { StyleSheet } from 'react-native'
import type { AppThemeTokens } from '../../theme/tokens'

/** 标签云轮转色(与 web tags/page.tsx TAG_COLORS 同源:primary/emerald/amber/rose/violet/cyan,统一收编到 chart token)。 */
export const TAG_CLOUD_COLORS = [
  CHART_BLUE,
  CHART_GREEN,
  CHART_AMBER,
  CHART_ROSE,
  CHART_VIOLET,
  CHART_CYAN,
] as const

/** 热门标签 chip 轮转色(与 web TAG_CHIP_COLORS 同五档)。 */
export const TAG_CHIP_COLORS = [
  CHART_BLUE,
  CHART_GREEN,
  CHART_AMBER,
  CHART_ROSE,
  CHART_VIOLET,
] as const

/**
 * 标签云字号档位(rnType token 档,覆盖 web :49-52 的 12-28px 线性 ramp):
 * label 12 / body 14 / title 16 / subtitle 18 / display 24。
 * web 用连续像素值,RN 侧按档位映射(任务硬规则:字号必须走 token 档,不写裸像素)。
 */
export const TAG_FONT_TIERS = [
  rnType.label,
  rnType.body,
  rnType.title,
  rnType.subtitle,
  rnType.display,
] as const

/** usageCount 归一占比 [0,1] → 字号档索引;max===min 时 web 回退 16px ⇒ 取 title 档。 */
export function tagFontTierIndex(ratio: number | null): number {
  if (ratio === null) return 2
  const clamped = Math.min(1, Math.max(0, ratio))
  return Math.round(clamped * (TAG_FONT_TIERS.length - 1))
}

/** 轮转色取值(noUncheckedIndexedAccess 下的收敛访问器:数索引回退到字面量档,类型零 undefined)。 */
export function tagCloudColorAt(i: number): (typeof TAG_CLOUD_COLORS)[number] {
  return TAG_CLOUD_COLORS[i % TAG_CLOUD_COLORS.length] ?? TAG_CLOUD_COLORS[0]
}

export function tagChipColorAt(i: number): (typeof TAG_CHIP_COLORS)[number] {
  return TAG_CHIP_COLORS[i % TAG_CHIP_COLORS.length] ?? TAG_CHIP_COLORS[0]
}

export function tagFontTierAt(ratio: number | null): (typeof TAG_FONT_TIERS)[number] {
  return TAG_FONT_TIERS[tagFontTierIndex(ratio)] ?? TAG_FONT_TIERS[2]
}

export function createTagsStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 12,
      gap: 12,
    },
    headerTitle: { fontSize: rnType.subtitle.size, fontWeight: '700', color: tk.text.primary },
    scroll: { padding: 12, paddingBottom: 32, gap: 12 },
    hero: { gap: 4 },
    heroTitle: { fontSize: rnType.display.size, fontWeight: '700', color: tk.text.primary },
    heroSubtitle: { fontSize: rnType.label.size, color: tk.text.secondary },
    card: {
      backgroundColor: tk.surface.light,
      borderRadius: rnRadius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      padding: 12,
      gap: 10,
    },
    cardTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    cloudRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: 12,
      rowGap: 8,
    },
    tagLink: { flexDirection: 'row', alignItems: 'center', gap: 4, fontWeight: '500' },
    popularRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    popularChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: rnRadius.md,
    },
    popularChipText: { fontSize: rnType.body.size, fontWeight: '600' },
    popularChipCount: { fontSize: rnType.caption.size, opacity: 0.75 },
    emptyBox: { alignItems: 'center', gap: 8, paddingVertical: 32 },
    emptyText: { fontSize: rnType.label.size, color: tk.text.secondary },
    metaLine: { fontSize: rnType.label.size, color: tk.text.secondary },
    descText: { fontSize: rnType.label.size, color: tk.text.secondary },
    groupHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    groupLabel: { fontSize: rnType.caption.size, fontWeight: '600', color: tk.text.tertiary },
    groupCount: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    resourceList: { gap: 2 },
    resourceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: rnRadius.sm,
    },
    resourceId: {
      flex: 1,
      fontSize: rnType.body.size,
      color: tk.text.primary,
      fontFamily: 'monospace',
    },
    resourceDate: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    errorBox: { alignItems: 'center', gap: 8, paddingVertical: 24 },
    errorText: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    refreshBtn: {
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    refreshText: { fontSize: rnType.body.size, fontWeight: '600', color: tk.brand.ctaForeground },
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
