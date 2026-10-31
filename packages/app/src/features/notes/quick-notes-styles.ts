// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 快捷笔记屏样式(D03,从 QuickNotesScreen 拆出的纯样式模块)
 * 圆角只走 rnRadius 档位;描边只取 tk.border.*(墨档禁用,守门 83 R8)。
 */

import { StyleSheet, type TextStyle } from 'react-native'
import { rnRadius, rnSpacing } from '@ihui/design-tokens'
import type { AppThemeTokens } from '../../theme/tokens'

export function formatQuickNoteStamp(ts: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(ts),
  )
}

export function createQuickNotesStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.light },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing['sm-loose'],
      paddingHorizontal: rnSpacing.md,
      paddingTop: rnSpacing['sm-loose'],
      paddingBottom: rnSpacing['xs-loose'],
    },
    title: { flex: 1, fontSize: 20, fontWeight: '600', color: tk.text.primary },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    addBtnText: { color: tk.brand.ctaForeground, fontSize: 14, fontWeight: '600' },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingHorizontal: rnSpacing.md,
      paddingTop: rnSpacing['xs-loose'],
    },
    searchInput: { flex: 1, fontSize: 14 } as TextStyle,
    archivedToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing['xs-loose'],
      alignSelf: 'flex-start',
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
    },
    archivedDot: {
      width: 14,
      height: 14,
      borderRadius: rnRadius.xs,
      borderWidth: 1,
      borderColor: tk.border.medium,
      backgroundColor: tk.surface.card,
    },
    archivedDotOn: { backgroundColor: tk.brandAccent.deep, borderColor: tk.brandAccent.deep },
    archivedToggleText: { fontSize: 13, color: tk.text.secondary },
    list: { flex: 1, paddingHorizontal: rnSpacing.md },
    empty: { paddingVertical: rnSpacing['4xl'], alignItems: 'center' },
    emptyText: { fontSize: 14, color: tk.text.tertiary },
    card: {
      padding: 14,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      marginBottom: rnSpacing.md,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    cardTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: tk.text.primary },
    badgeArchived: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing['2xs'],
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    badgeArchivedText: { fontSize: 11, color: tk.text.tertiary },
    cardContent: { marginTop: rnSpacing.sm, fontSize: 14, color: tk.text.medium },
    cardMeta: { marginTop: rnSpacing.sm, fontSize: 11, color: tk.text.tertiary },
    cardActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      marginTop: rnSpacing['sm-loose'],
    },
    insertBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing['xs-loose'],
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    insertBtnText: { color: tk.brand.ctaForeground, fontSize: 13, fontWeight: '500' },
    iconBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
    },
  })
}

export function createQuickNoteEditorStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      width: '92%',
      borderRadius: rnRadius.xl,
      backgroundColor: tk.surface.card,
      padding: rnSpacing.lg,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: rnSpacing.md,
    },
    input: { marginBottom: rnSpacing['sm-loose'], fontSize: 14 } as TextStyle,
    inputMultiline: { height: 120, marginBottom: rnSpacing['sm-loose'], fontSize: 14 } as TextStyle,
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: rnSpacing['sm-loose'],
      marginTop: rnSpacing.xs,
    },
    cancelBtn: {
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
    },
    cancelBtnText: { color: tk.text.secondary, fontSize: 14 },
    saveBtn: {
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    saveBtnText: { color: tk.brand.ctaForeground, fontSize: 14, fontWeight: '600' },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
