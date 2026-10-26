// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 快捷笔记屏样式(D03,从 QuickNotesScreen 拆出的纯样式模块)
 * 圆角只走 rnRadius 档位;描边只取 tk.border.*(墨档禁用,守门 83 R8)。
 */

import { StyleSheet, type TextStyle } from 'react-native'
import { rnRadius } from '@ihui/design-tokens'
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
      gap: 10,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 6,
    },
    title: { flex: 1, fontSize: 20, fontWeight: '600', color: tk.text.primary },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    addBtnText: { color: tk.brand.ctaForeground, fontSize: 14, fontWeight: '600' },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingTop: 6,
    },
    searchInput: { flex: 1, fontSize: 14 } as TextStyle,
    archivedToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    archivedDot: {
      width: 14,
      height: 14,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      backgroundColor: tk.surface.card,
    },
    archivedDotOn: { backgroundColor: tk.brandAccent.deep, borderColor: tk.brandAccent.deep },
    archivedToggleText: { fontSize: 13, color: tk.text.secondary },
    list: { flex: 1, paddingHorizontal: 12 },
    empty: { paddingVertical: 40, alignItems: 'center' },
    emptyText: { fontSize: 14, color: tk.text.tertiary },
    card: {
      padding: 14,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      marginBottom: 12,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cardTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: tk.text.primary },
    badgeArchived: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    badgeArchivedText: { fontSize: 11, color: tk.text.tertiary },
    cardContent: { marginTop: 8, fontSize: 14, color: tk.text.medium },
    cardMeta: { marginTop: 8, fontSize: 11, color: tk.text.tertiary },
    cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
    insertBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
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
      padding: 16,
    },
    modalTitle: { fontSize: 18, fontWeight: '600', color: tk.text.primary, marginBottom: 12 },
    input: { marginBottom: 10, fontSize: 14 } as TextStyle,
    inputMultiline: { height: 120, marginBottom: 10, fontSize: 14 } as TextStyle,
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
    cancelBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
    },
    cancelBtnText: { color: tk.text.secondary, fontSize: 14 },
    saveBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    saveBtnText: { color: tk.brand.ctaForeground, fontSize: 14, fontWeight: '600' },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
