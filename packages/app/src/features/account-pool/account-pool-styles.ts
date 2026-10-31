// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadius, rnSpacing } from '@ihui/design-tokens'
import { StyleSheet } from 'react-native'
import type { AppThemeTokens } from '../../theme/tokens'

/** 号池共享屏的样式表(按主题取色;圆角一律走 rnRadius 档,§4 守门 77) */
export function createAccountPoolStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: { paddingHorizontal: rnSpacing.lg, paddingTop: rnSpacing.sm, gap: rnSpacing['2xs'] },
    title: { fontSize: 20, fontWeight: '700', color: tk.text.primary },
    subtitle: { fontSize: 12, color: tk.text.secondary, lineHeight: 18 },
    body: { padding: rnSpacing.lg, gap: rnSpacing.md, paddingBottom: rnSpacing['4xl'] },
    card: {
      backgroundColor: tk.surface.light,
      borderRadius: rnRadius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      padding: 14,
      gap: rnSpacing.sm,
    },
    rowHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    cardTitle: { fontSize: 15, fontWeight: '600', color: tk.text.primary, flexShrink: 1 },
    muted: { fontSize: 12, color: tk.text.secondary, lineHeight: 18 },
    badges: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing['xs-loose'] },
    badge: {
      fontSize: 11,
      color: tk.text.secondary,
      backgroundColor: tk.surface.muted,
      borderRadius: rnRadius.md,
      paddingHorizontal: rnSpacing['xs-loose'],
      paddingVertical: rnSpacing['2xs'],
      overflow: 'hidden',
    },
    badgeOn: { color: tk.success.DEFAULT, backgroundColor: tk.success.light },
    badgePending: { color: tk.warning.DEFAULT, backgroundColor: tk.warning.light },
    summary: { fontSize: 14, fontWeight: '600', color: tk.text.primary, flexShrink: 1 },
    linkBtn: { marginTop: rnSpacing.sm, alignItems: 'center', paddingVertical: rnSpacing.sm },
    linkText: { fontSize: 13, color: tk.brand.DEFAULT ?? tk.text.primary },
    actions: { flexDirection: 'row', gap: rnSpacing.sm, marginTop: rnSpacing['2xs'] },
    action: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing['xs-loose'],
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    actionText: { fontSize: 12, color: tk.text.primary },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm },
    chip: {
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing['xs-loose'],
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    chipOn: { backgroundColor: tk.brand.cta },
    chipText: { fontSize: 12, color: tk.text.secondary },
    chipTextOn: { color: tk.brand.ctaForeground },
    label: { fontSize: 12, color: tk.text.secondary, marginTop: rnSpacing.xs },
    tokenInput: { textAlignVertical: 'top', minHeight: 64 },
    submit: {
      marginTop: rnSpacing.sm,
      alignItems: 'center',
      paddingVertical: rnSpacing['sm-loose'],
      borderRadius: rnRadius.md,
      backgroundColor: tk.brand.cta,
    },
    submitOff: { opacity: 0.5 },
    submitText: { fontSize: 14, fontWeight: '600', color: tk.brand.ctaForeground },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
