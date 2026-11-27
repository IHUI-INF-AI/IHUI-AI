// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { TAB_BAR_GAP_TOP_PX, TAB_BAR_MARGIN_H_PX } from '@ihui/shared/ui/tab-bar-spec'
import { GLASS_BAR_CLIP, GLASS_BAR_SURFACE } from '../theme/glass-bar-surface'

/**
 * 顶栏承载件 —— 全端唯一实现。
 *
 * 2026-11-24 用户定稿:顶栏与底部菜单栏共用同一套玻璃 token(背景、描边、圆角、阴影、模糊),
 * 改 `theme/glass-bar-surface.ts` 一处,顶部与底部同时生效。整条顶栏是一枚悬浮玻璃条,
 * 左右留边与底部胶囊同一垂直线,顶部留 6px 呼吸。
 *
 * 2026-11-27 四向投影修复:承载拆成「投影面 → 圆角裁剪」两层。投影面 `wrap` 不再
 * `overflow: hidden`,只投背景/描边/阴影;内层 `clip` 才裁行内内容。`wrap` 同时显式
 * 抬起 `position:relative + zIndex`,把下投影画在后续不透明正文层之上 —— 此前下投影
 * 被 `CommunityMainScreen` 的 `surface.bg` 正文盖住,四向只剩上缘一小截,正是用户实拍。
 *
 * 状态栏 inset 带仍由 App.tsx 根 View 按路由取色;凡渲染 NavBar 的路由都应取
 * `tokens.surface.bg`(与页面壳同档),由 `tests/nav-chrome-route-parity.test.ts` 现读锁住。
 */
export function NavChrome({ children }: { children: ReactNode }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.clip}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    ...GLASS_BAR_SURFACE,
    marginHorizontal: TAB_BAR_MARGIN_H_PX,
    marginTop: TAB_BAR_GAP_TOP_PX,
    // 下投影必须越过后续屏体:正文是后挂的不透明兄弟层,仅靠 DOM 顺序会被它整片盖住。
    // zIndex 在 Web/iOS 生效;Android 同时有 surface 的 elevation=10 抬层。
    position: 'relative',
    zIndex: 2,
  },
  clip: {
    ...GLASS_BAR_CLIP,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
