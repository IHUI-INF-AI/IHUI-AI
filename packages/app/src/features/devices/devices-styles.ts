// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 设备管理共享屏样式表 —— 主题档由 getTokens(colorScheme) 注入,不读端内常量。
//
// 从 apps/mobile-rn/src/screens/DevicesScreen.tsx 的 makeStyles 迁来(2026-11-26),
// 只换掉 `tokens` 直取、改成 `createStyles(tk)`,数值档位逐字不动:
// 视觉上 RN 与小程序必须是同一张脸(AGENTS.md §4 跨端样式同步)。

import { StyleSheet } from 'react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { AppThemeTokens } from '../../theme/tokens'

export function createStyles(tokens: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tokens.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing['sm-loose'],
    },
    headerTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tokens.text.primary },
    body: { padding: rnSpacing.md, gap: rnSpacing.md, paddingBottom: rnSpacing['3xl'] },
    card: {
      padding: rnSpacing.lg,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: 'transparent',
      backgroundColor: tokens.surface.card,
      gap: rnSpacing.sm,
    },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing['xs-loose'] },
    cardTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tokens.text.primary },
    muted: { fontSize: rnType.bodySm.size, color: tokens.text.secondary, lineHeight: 19 },
    error: { fontSize: rnType.bodySm.size, color: tokens.danger.deepText },
    /** 离线/未启用提示:比正文弱一档、比辅助文字强一档,读得出来但不抢戏 */
    hint: {
      fontSize: rnType.bodySm.size,
      color: tokens.text.secondary,
      lineHeight: 19,
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      backgroundColor: tokens.surface.bg,
    },
    loading: { paddingVertical: rnSpacing.lg },
    centerBox: { alignItems: 'center', gap: rnSpacing.sm, paddingVertical: rnSpacing.lg },
    emptyTitle: { fontSize: rnType.body.size, fontWeight: '600', color: tokens.text.primary },
    button: {
      height: 44,
      borderRadius: rnRadius.md,
      backgroundColor: tokens.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: rnSpacing.xs,
    },
    disabled: { opacity: 0.5 },
    buttonText: {
      fontSize: rnType.strong.size,
      fontWeight: '600',
      color: tokens.brand.ctaForeground,
    },
    outlineButton: {
      height: 36,
      paddingHorizontal: rnSpacing.lg,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    outlineText: { fontSize: rnType.body.size, color: tokens.text.primary },
    pairBox: { alignItems: 'center', gap: rnSpacing.xs, paddingVertical: rnSpacing.sm },
    pairCode: {
      fontSize: rnType.displayLg.size,
      fontWeight: '700',
      letterSpacing: 8,
      color: tokens.brand.cta,
      fontVariant: ['tabular-nums'],
    },
    pairCodeExpired: { color: tokens.text.medium },
    deviceRow: {
      gap: rnSpacing['xs-loose'],
      paddingVertical: rnSpacing['sm-loose'],
      paddingHorizontal: rnSpacing['sm-loose'],
      borderRadius: rnRadius.md,
      backgroundColor: tokens.surface.bg,
    },
    rowHead: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    deviceName: {
      flex: 1,
      fontSize: rnType.strong.size,
      fontWeight: '600',
      color: tokens.text.primary,
    },
    badge: {
      paddingHorizontal: rnSpacing['xs-loose'],
      paddingVertical: 1,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tokens.border.light,
    },
    badgeOn: { borderColor: tokens.success.deep },
    badgeOff: { borderColor: tokens.border.medium },
    badgeText: { fontSize: rnType.badge.size, fontWeight: '600', color: tokens.text.secondary },
    meta: { fontSize: rnType.label.size, color: tokens.text.medium },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.lg,
      marginTop: rnSpacing['2xs'],
    },
    actionRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
    link: { fontSize: rnType.bodySm.size, fontWeight: '600', color: tokens.text.primary },
    dangerLink: { fontSize: rnType.bodySm.size, fontWeight: '600', color: tokens.danger.deepText },
    panel: {
      marginTop: rnSpacing.xs,
      padding: rnSpacing['sm-loose'],
      borderRadius: rnRadius.xl,
      backgroundColor: tokens.surface.card,
      borderWidth: 1,
      borderColor: 'transparent',
      gap: rnSpacing.xs,
    },
    panelTitle: {
      fontSize: rnType.label.size,
      fontWeight: '600',
      color: tokens.text.primary,
    },
    input: {
      height: 36,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      paddingHorizontal: rnSpacing.sm,
      fontSize: rnType.bodySm.size,
      color: tokens.text.primary,
    },
    // 聚焦换色不换宽(门 212):墨档是"描边不得取墨"的唯一例外位,只在此条件形态出现
    inputFocused: { borderColor: tokens.text.primary },
    convRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['xs-loose'],
    },
    convTitle: { flex: 1, fontSize: rnType.bodySm.size, color: tokens.text.primary },
    taskRow: { gap: rnSpacing['2xs'], paddingVertical: rnSpacing['xs-loose'] },
    taskSession: {
      flex: 1,
      fontFamily: 'monospace',
      fontSize: rnType.caption.size,
      color: tokens.text.secondary,
    },
  })
}

export type DevicesStyles = ReturnType<typeof createStyles>
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
