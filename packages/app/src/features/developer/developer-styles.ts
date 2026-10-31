// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadiusFor, rnSpacing } from '@ihui/design-tokens'
import { StyleSheet } from 'react-native'
import type { AppThemeTokens } from '../../theme/tokens'

/**
 * 「开发者空间」共享屏样式表。
 *
 * 数值 = 历史项目 rpx/2(与 RN 端 `rpx()` 换算同基准,逐元素对齐
 * `apps/mobile-rn/src/screens/DeveloperScreen.tsx` 收敛前的那一版,搬文件不改观感);
 * 圆角一律走角色档 rnRadiusFor(§4 守门 77 / 角色档一致性),
 * 主按钮取 brand.cta + brand.ctaForeground 成对(§4 品牌 CTA 同源),
 * 全表不出现描边取墨档的写法(守门 83 R8)。
 */
export function createDeveloperStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: tk.surface.bg },
    scrollContent: { padding: rnSpacing['sm-loose'], paddingBottom: rnSpacing['2xl'] },
    headerCard: {
      backgroundColor: tk.surface.card,
      borderRadius: rnRadiusFor.card,
      padding: 14,
      alignItems: 'center',
      marginBottom: rnSpacing['sm-loose'],
    },
    avatar: { width: 64, height: 64, borderRadius: rnRadiusFor.hero },
    userName: {
      fontSize: 17,
      fontWeight: '600',
      color: tk.text.primary,
      marginTop: rnSpacing.sm,
      marginBottom: rnSpacing.sm,
    },
    ctaBtn: {
      paddingHorizontal: rnSpacing.xl,
      paddingVertical: 5,
      borderRadius: rnRadiusFor.control,
      backgroundColor: tk.brand.cta,
    },
    ctaBtnText: { fontSize: 14, fontWeight: '600', color: tk.brand.ctaForeground },
    infoCard: {
      backgroundColor: tk.surface.card,
      borderRadius: rnRadiusFor.card,
      padding: rnSpacing.md,
      marginBottom: rnSpacing['sm-loose'],
    },
    infoTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: rnSpacing['xs-loose'],
    },
    infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: rnSpacing.xs },
    infoLabel: { width: 76, fontSize: 13, color: tk.text.secondary },
    infoValue: { flex: 1, fontSize: 13, color: tk.text.primary },
    infoAction: { fontSize: 12, color: tk.brand.DEFAULT, paddingHorizontal: rnSpacing.xs },
    dangerText: { color: tk.danger.bright },
    entryRow: {
      flexDirection: 'row',
      backgroundColor: tk.surface.card,
      borderRadius: rnRadiusFor.panel,
      paddingVertical: rnSpacing.md,
      marginBottom: rnSpacing['sm-loose'],
    },
    entryItem: { flex: 1, alignItems: 'center', gap: rnSpacing.xs },
    iconWell: {
      width: 48,
      height: 48,
      borderRadius: rnRadiusFor.hero,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    entryIcon: { width: 28, height: 28 },
    entryText: { fontSize: 13, color: tk.text.primary },
    faqSection: { gap: rnSpacing.sm },
    faqHeading: {
      fontSize: 15,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: rnSpacing.xs,
    },
    problemCard: {
      backgroundColor: tk.surface.card,
      borderRadius: rnRadiusFor.card,
      padding: rnSpacing.md,
    },
    problemTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: rnSpacing.xs,
    },
    problemDesc: { fontSize: 13, color: tk.text.secondary, marginBottom: rnSpacing.sm },
    problemBtn: {
      alignSelf: 'flex-start',
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadiusFor.control,
      backgroundColor: tk.brand.cta,
    },
    problemBtnText: { fontSize: 13, fontWeight: '500', color: tk.brand.ctaForeground },
    contactCard: {
      backgroundColor: tk.surface.card,
      borderRadius: rnRadiusFor.control,
      padding: rnSpacing.md,
      alignItems: 'center',
    },
    contactTitle: { fontSize: 15, fontWeight: '600', color: tk.text.primary },
    contactDesc: { fontSize: 12, color: tk.text.secondary, marginTop: 3 },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
