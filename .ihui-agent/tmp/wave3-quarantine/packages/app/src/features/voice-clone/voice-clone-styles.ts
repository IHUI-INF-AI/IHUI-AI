// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadius } from '@ihui/design-tokens'
import { StyleSheet } from 'react-native'
import type { AppThemeTokens } from '../../theme/tokens'

/**
 * 声纹库共享屏样式(web `apps/web/app/(main)/voices/page.tsx` 的 RN 承载)。
 * 颜色一律走既有 token,零硬编码色值;三态徽章用 success/warning/danger 语义档。
 */
export function createVoiceLibraryStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 12,
      gap: 12,
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: tk.text.primary, flexShrink: 1 },
    scroll: { padding: 12, paddingBottom: 32, gap: 12 },
    hero: { gap: 4 },
    heroTitle: { fontSize: 22, fontWeight: '700', color: tk.text.primary },
    heroSubtitle: { fontSize: 12, lineHeight: 18, color: tk.text.secondary },
    actionsRow: { flexDirection: 'row', gap: 8 },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: rnRadius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
    },
    actionBtnPrimary: { backgroundColor: tk.brand.cta, borderColor: tk.brand.cta },
    actionBtnDisabled: { opacity: 0.55 },
    actionText: { fontSize: 13, fontWeight: '600', color: tk.text.primary },
    actionTextPrimary: { fontSize: 13, fontWeight: '600', color: tk.brand.ctaForeground },
    hint: { fontSize: 12, lineHeight: 18, color: tk.text.tertiary },
    noticeBox: {
      borderRadius: rnRadius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.success.light,
      backgroundColor: tk.success.lightest,
      padding: 10,
    },
    noticeText: { fontSize: 13, lineHeight: 19, color: tk.success.deepText },
    errorBox: {
      borderRadius: rnRadius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.danger.light,
      backgroundColor: tk.danger.light,
      padding: 10,
    },
    errorText: { fontSize: 13, lineHeight: 19, color: tk.danger.DEFAULT },
    listCard: {
      backgroundColor: tk.surface.light,
      borderRadius: rnRadius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      overflow: 'hidden',
    },
    row: { padding: 12, gap: 8 },
    rowHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
    nameChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brandAccent.light,
      paddingHorizontal: 6,
      paddingVertical: 3,
    },
    nameChipText: { fontSize: 12, fontWeight: '600', color: tk.brandAccent.foreground },
    statusChip: {
      borderRadius: rnRadius.sm,
      paddingHorizontal: 6,
      paddingVertical: 3,
    },
    statusReady: { backgroundColor: tk.success.light },
    statusProcessing: { backgroundColor: tk.warning.light },
    statusFailed: { backgroundColor: tk.danger.light },
    statusReadyText: { fontSize: 10, fontWeight: '600', color: tk.success.deepText },
    statusProcessingText: { fontSize: 10, fontWeight: '600', color: tk.warning.amberText },
    statusFailedText: { fontSize: 10, fontWeight: '600', color: tk.danger.DEFAULT },
    metaText: { fontSize: 11, color: tk.text.tertiary },
    modelText: { fontSize: 11, color: tk.text.secondary },
    rowActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    smallBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: rnRadius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },
    smallBtnText: { fontSize: 11, color: tk.text.secondary },
    idBtnText: { fontSize: 11, color: tk.text.tertiary },
    dangerText: { fontSize: 11, color: tk.danger.DEFAULT },
    detailBox: {
      backgroundColor: tk.surface.muted,
      borderRadius: rnRadius.md,
      padding: 10,
      gap: 6,
    },
    detailRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
    detailLabel: { fontSize: 12, color: tk.text.secondary, minWidth: 76, flexShrink: 0 },
    detailValue: { fontSize: 12, color: tk.text.tertiary, flex: 1 },
    loadingBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 24 },
    loadingText: { fontSize: 13, color: tk.text.secondary },
    emptyBox: { alignItems: 'center', gap: 8, paddingVertical: 32 },
    emptyText: { fontSize: 13, color: tk.text.tertiary, textAlign: 'center' },
    skeletonRow: { height: 60, borderRadius: rnRadius.lg, backgroundColor: tk.border.light },
    footerCount: { fontSize: 12, color: tk.text.tertiary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
