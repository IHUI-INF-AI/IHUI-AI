// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadius } from '@ihui/design-tokens'
import { StyleSheet } from 'react-native'
import type { AppThemeTokens } from '../../theme/tokens'

/** 号池共享屏的样式表(按主题取色;圆角一律走 rnRadius 档,§4 守门 77) */
export function createAccountPoolStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: { paddingHorizontal: 16, paddingTop: 8, gap: 2 },
    title: { fontSize: 20, fontWeight: '700', color: tk.text.primary },
    subtitle: { fontSize: 12, color: tk.text.secondary, lineHeight: 18 },
    body: { padding: 16, gap: 12, paddingBottom: 40 },
    card: {
      backgroundColor: tk.surface.light,
      borderRadius: rnRadius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      padding: 14,
      gap: 8,
    },
    rowHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    cardTitle: { fontSize: 15, fontWeight: '600', color: tk.text.primary, flexShrink: 1 },
    muted: { fontSize: 12, color: tk.text.secondary, lineHeight: 18 },
    badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    badge: {
      fontSize: 11,
      color: tk.text.secondary,
      backgroundColor: tk.surface.muted,
      borderRadius: rnRadius.md,
      paddingHorizontal: 6,
      paddingVertical: 2,
      overflow: 'hidden',
    },
    badgeOn: { color: tk.success.DEFAULT, backgroundColor: tk.success.light },
    badgePending: { color: tk.warning.DEFAULT, backgroundColor: tk.warning.light },
    summary: { fontSize: 14, fontWeight: '600', color: tk.text.primary, flexShrink: 1 },
    linkBtn: { marginTop: 8, alignItems: 'center', paddingVertical: 8 },
    linkText: { fontSize: 13, color: tk.brand.DEFAULT ?? tk.text.primary },
    actions: { flexDirection: 'row', gap: 8, marginTop: 2 },
    action: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    actionText: { fontSize: 12, color: tk.text.primary },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    chipOn: { backgroundColor: tk.brand.cta },
    chipText: { fontSize: 12, color: tk.text.secondary },
    chipOnText: { color: tk.brand.ctaForeground },
    label: { fontSize: 12, color: tk.text.secondary, marginTop: 4 },
    tokenInput: { textAlignVertical: 'top', minHeight: 64 },
    submit: {
      marginTop: 8,
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: rnRadius.md,
      backgroundColor: tk.brand.cta,
    },
    submitOff: { opacity: 0.5 },
    submitText: { fontSize: 14, fontWeight: '600', color: tk.brand.ctaForeground },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
