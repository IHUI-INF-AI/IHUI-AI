// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 云运行域共享样式 —— 对齐 web `apps/web/src/components/cloud-runs/CloudRunsView.tsx`。
 *
 * 状态三档语义色与 `student-styles.ts` 的 STATUS_PALETTE 同源(done=emerald-600、error=rose-600),
 * running 走品牌主色(与 web `bg-primary` 同档)⇒ 本域不自立第二份色表。
 * 圆角一律取 `rnRadius.*` 角色档(§4 圆角单源),不写 px 字面量。
 */
import { rnRadius, rnSpacing } from '@ihui/design-tokens'
import { StyleSheet } from 'react-native'
import type { AppThemeTokens } from '../../theme/tokens'

export function createCloudRunsStyles(tk: AppThemeTokens) {
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
    headerActionText: { fontSize: 13, color: tk.brand.DEFAULT },
    subtitle: { fontSize: 12, color: tk.text.secondary, paddingHorizontal: rnSpacing.md },
    scroll: { padding: rnSpacing.md, paddingBottom: rnSpacing['3xl'], gap: rnSpacing['sm-loose'] },

    card: {
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.light,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      padding: rnSpacing.md,
      gap: rnSpacing['xs-loose'],
    },
    cardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    cardTitle: { flexShrink: 1, fontSize: 15, fontWeight: '600', color: tk.text.primary },
    cardMeta: { fontSize: 12, color: tk.text.tertiary },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing['xs-loose'] },
    statusDot: { width: 8, height: 8, borderRadius: rnRadius.xs },
    statusText: { fontSize: 12, fontWeight: '600' },

    detailLabel: { width: 96, fontSize: 12, color: tk.text.tertiary },
    detailValue: { flex: 1, fontSize: 13, color: tk.text.primary },
    detailRow: { flexDirection: 'row', gap: rnSpacing.md },
    mono: { fontSize: 12, color: tk.text.secondary },
    outputBlock: {
      backgroundColor: tk.surface.muted,
      borderRadius: rnRadius.md,
      padding: rnSpacing['sm-loose'],
    },
    outputText: { fontSize: 12, lineHeight: 18, color: tk.text.secondary },

    // —— 分页条(与 ListPager 的四个键同名同档;该组件的样式面已收为最小结构类型)——
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
      backgroundColor: tk.surface.light,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
    },
    pagerBtnText: { fontSize: 13, color: tk.text.primary },
    pagerBtnTextDisabled: { fontSize: 13, color: tk.text.tertiary },
    pageInfo: { fontSize: 12, color: tk.text.secondary },

    // —— 空态 / 错误 / 加载 ——
    emptyBox: { alignItems: 'center', gap: rnSpacing.sm, paddingVertical: rnSpacing['3xl'] },
    emptyText: { fontSize: 13, color: tk.text.tertiary },
    errorBox: {
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.light,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.medium,
      padding: rnSpacing.md,
    },
    errorText: { fontSize: 13, color: tk.text.primary },
  })
}

export type CloudRunsStyles = ReturnType<typeof createCloudRunsStyles>
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
