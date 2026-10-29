// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * chat-workbench 共享屏样式工厂(2026-10-29 立,自 web WorkbenchShell 提取)。
 *
 * 形制照 `features/student/student-styles.ts`:StyleSheet.create 工厂 + 入参主题 token,
 * 色值一律取自 `getTokens(colorScheme)`(AGENTS §4 跨端单一色值源),
 * 圆角/间距/字号取 `@ihui/design-tokens` 档位(§4 圆角单一源头 + 非色档三族同源)。
 *
 * 与 web 的对应关系(web Tailwind → RN):
 * - shellClass(整屏)    → container
 * - railClass(左会话栏) → rail(web 是并列栏,移动端一屏只放得下栏 ⇒ 全屏化)
 * - centerClass(中主区) → center(移动端会话本体由薄壳跳既有 Chat 屏承载,本屏只留提示面)
 * - 选中行 border-l-brand-accent-deep → rowActive.borderLeftColor
 *   (强调描边取 brandAccent,不取墨档 = §4 描边铁律)
 */
import { rnRadiusFor, rnSpacing, rnType } from '@ihui/design-tokens'
import { StyleSheet } from 'react-native'
import type { AppThemeTokens } from '../../theme/tokens'

export function createChatWorkbenchStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    /** 顶栏:返回键 + 标题 + 轻动作(web WorkbenchPaneHeader 在移动端的等价最小档) */
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.md,
    },
    headerTitle: {
      ...rnType.title,
      fontWeight: '700',
      color: tk.text.primary,
      flexShrink: 1,
    },
    headerActions: {
      marginLeft: 'auto',
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      flexShrink: 0,
    },
    /** 头部轻按钮(新建会话) */
    headBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadiusFor.control,
      backgroundColor: tk.surface.light,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
    },
    headBtnText: { ...rnType.label, color: tk.text.primary },
    /** 会话栏容器(web railClass ⇒ 移动端整屏主体) */
    rail: { flex: 1, paddingHorizontal: rnSpacing.sm },
    searchBox: { paddingBottom: rnSpacing.sm },
    list: { gap: rnSpacing.xs },
    /** 栏标题(web sticky 分组头在移动端只留一枚标签,不做 sticky) */
    sectionLabel: {
      ...rnType.caption,
      color: tk.text.tertiary,
      paddingHorizontal: rnSpacing.xs,
      paddingTop: rnSpacing.xs,
      paddingBottom: rnSpacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing.md,
      paddingLeft: rnSpacing.xs,
      paddingRight: rnSpacing.sm,
      borderRadius: rnRadiusFor.control,
      borderLeftWidth: 2,
      borderLeftColor: 'transparent',
      backgroundColor: tk.surface.light,
    },
    rowActive: {
      borderLeftColor: tk.brandAccent.deep,
      backgroundColor: tk.brandAccent.light,
    },
    rowTitle: { ...rnType.body, flex: 1, color: tk.text.primary },
    rowTime: { ...rnType.caption, color: tk.text.tertiary, flexShrink: 0 },
    /** 居中提示面(未选会话 / 空列表) */
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: rnSpacing.xl,
    },
    hint: { ...rnType.caption, color: tk.text.tertiary, textAlign: 'center' },
  })
}

export type ChatWorkbenchStyles = ReturnType<typeof createChatWorkbenchStyles>
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
