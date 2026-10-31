// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「话题详情」共享屏样式表(packages/app/src/features/topic-detail/TopicDetailScreen.tsx 专用)。
 * 数值 = 小程序端设计稿 rpx/2(750 设计宽),与 RN 端 rpx() 换算同基准(§4 跨端样式同步铁律)。
 * 圆角一律走 rnRadius 档(守门 77);关注按钮取 brand.cta + brand.ctaForeground 成对(§4 品牌 CTA 同源);
 * 本屏零描边,不涉及守门 83 R8。
 */
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native'
import { rnRadius, rnSpacing } from '@ihui/design-tokens'
import type { AppThemeTokens } from '../../theme/tokens'

export function createTopicDetailStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.md,
    },
    navTitle: { fontSize: 18, fontWeight: '700', color: tk.text.primary },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      padding: rnSpacing.md,
      backgroundColor: tk.surface.card,
    },
    headerInfo: { flex: 1, gap: rnSpacing.xs },
    topicName: { fontSize: 17, fontWeight: '600', color: tk.text.primary },
    topicDesc: { fontSize: 13, lineHeight: 18, color: tk.text.secondary },
    followers: { fontSize: 12, color: tk.text.tertiary },
    followBtn: {
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing['xs-loose'],
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    followBtnActive: { backgroundColor: tk.surface.muted },
    followBtnText: { fontSize: 13, fontWeight: '600', color: tk.brand.ctaForeground },
    followBtnTextActive: { color: tk.text.secondary },
    publishBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing['sm-loose'],
      backgroundColor: tk.surface.card,
    },
    publishText: { flex: 1, fontSize: 13, color: tk.text.tertiary },
    publishBtn: { fontSize: 13, fontWeight: '600', color: tk.brand.DEFAULT },
    listContent: { padding: rnSpacing.md, paddingBottom: rnSpacing.xl, gap: rnSpacing.sm },
    post: {
      gap: rnSpacing['xs-loose'],
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.card,
    },
    cardPressed: { opacity: 0.85 },
    postUser: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: rnRadius['2xl'],
      backgroundColor: tk.surface.muted,
    },
    userInfo: { flex: 1, gap: rnSpacing['2xs'] },
    author: { fontSize: 13, fontWeight: '500', color: tk.text.primary },
    time: { fontSize: 11, color: tk.text.tertiary },
    postTitle: { fontSize: 15, fontWeight: '600', color: tk.text.primary },
    postContent: { fontSize: 13, lineHeight: 19, color: tk.text.secondary },
    imgRow: { flexDirection: 'row', gap: rnSpacing['xs-loose'] },
    postImg: {
      width: 100,
      height: 100,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    imgMore: { alignItems: 'center', justifyContent: 'center' },
    imgMoreText: { fontSize: 14, fontWeight: '600', color: tk.text.secondary },
    postFooter: { flexDirection: 'row', gap: rnSpacing.lg },
    stat: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
    statNum: { fontSize: 12, color: tk.text.tertiary },
    stateText: { fontSize: 13, color: tk.text.tertiary },
    footer: { alignItems: 'center', paddingVertical: rnSpacing.md },
  } satisfies Record<string, ViewStyle | TextStyle>)
}

export type TopicDetailStyles = ReturnType<typeof createTopicDetailStyles>
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
