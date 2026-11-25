// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { StyleSheet } from 'react-native'
import type { AppThemeTokens } from '../../theme/tokens'

/** 号池共享屏的样式表(按主题取色;圆角一律走 rnRadius 档,§4 守门 77) */
export function createAccountPoolStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    /* 返回键与标题同一行:BackChevron 自带 36dp 命中区,标题跟在它右侧。
       原写法只给了 gap 没给 flexDirection ⇒ 默认 column,返回键被顶到标题上方单独占一行,
       与圈子/话题等页的「左返回 + 标题」形态不一致(2026-11-26 逐页截图实测)。 */
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: rnSpacing.lg,
      paddingTop: rnSpacing.sm,
      gap: rnSpacing.sm,
    },
    title: { fontSize: rnType.heading.size, fontWeight: '700', color: tk.text.primary },
    subtitle: {
      fontSize: rnType.label.size,
      color: tk.text.secondary,
      lineHeight: rnType.bodySm.lineHeight,
    },
    body: { padding: rnSpacing.lg, gap: rnSpacing.md, paddingBottom: rnSpacing['4xl'] },
    /* 卡片面取 surface.card 而非 surface.light:两档亮值同为纯白(亮档零变化),
       但暗档 surface.light 与页面底 surface.bg 的 RGB 只差 2 级 ⇒ 卡片轮廓看不见;
       surface.card 暗档比底深约 10 级,卡面才立得起来。 */
    card: {
      backgroundColor: tk.surface.card,
      borderRadius: rnRadius.lg,
      padding: rnSpacing.md,
      gap: rnSpacing.sm,
    },
    /** 统计行:图标在左、数字贴右(需要 space-between) */
    rowHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    /** 「添加账号」这类小标题:图标与文字必须紧邻,不能各据一端 */
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing['xs-loose'],
    },
    cardTitle: {
      fontSize: rnType.strong.size,
      fontWeight: '600',
      color: tk.text.primary,
      flexShrink: 1,
    },
    muted: {
      fontSize: rnType.label.size,
      color: tk.text.secondary,
      lineHeight: rnType.bodySm.lineHeight,
    },
    badges: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing['xs-loose'] },
    badge: {
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
      backgroundColor: tk.surface.muted,
      borderRadius: rnRadius.md,
      paddingHorizontal: rnSpacing['xs-loose'],
      paddingVertical: rnSpacing['2xs'],
      overflow: 'hidden',
    },
    badgeOn: { color: tk.success.deep, backgroundColor: tk.success.light },
    badgePending: { color: tk.warning.amberText, backgroundColor: tk.warning.light },
    summary: {
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tk.text.primary,
      flexShrink: 1,
    },
    linkBtn: { marginTop: rnSpacing.sm, alignItems: 'center', paddingVertical: rnSpacing.sm },
    linkText: { fontSize: rnType.bodySm.size, color: tk.brand.DEFAULT ?? tk.text.primary },
    actions: { flexDirection: 'row', gap: rnSpacing.sm, marginTop: rnSpacing['2xs'] },
    action: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm },
    chip: {
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing['xs-loose'],
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    chipOn: { backgroundColor: tk.brand.cta },
    chipText: { fontSize: rnType.label.size, color: tk.text.secondary },
    chipOnText: { color: tk.brand.ctaForeground },
    label: { fontSize: rnType.label.size, color: tk.text.secondary, marginTop: rnSpacing.xs },
    tokenInput: { textAlignVertical: 'top', minHeight: 64 },
    submit: {
      marginTop: rnSpacing.sm,
      alignItems: 'center',
      paddingVertical: rnSpacing['sm-loose'],
      borderRadius: rnRadius.md,
      backgroundColor: tk.brand.cta,
    },
    /* 禁用态换底色+换字色,不用整体 opacity:半透明会让底与字同时变灰,
       亮档实测落成「灰底白字」(对比约 2.3:1,WCAG 不合格)。 */
    submitOff: { backgroundColor: tk.surface.muted },
    submitText: { fontSize: rnType.body.size, fontWeight: '600', color: tk.brand.ctaForeground },
    submitTextOff: { color: tk.text.secondary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
