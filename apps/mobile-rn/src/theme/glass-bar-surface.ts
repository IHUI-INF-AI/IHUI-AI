// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 顶栏 / 底栏共用的一枚玻璃停靠面(2026-11-24 用户定「整条顶部栏跟底部菜单栏同一套样式 token,改一处双方都生效」)。
 *
 * 单一源纪律:
 * - 颜色 = `tokens.glass.bg` / `tokens.border.light`(源头 tokens.css 的 `--color-glass-bg` / `--color-border-light`);
 * - 圆角 = `rnRadius.xl`(12);
 * - 阴影 = `ELEVATION_STEPS.lg` 的投影语汇,半径按停靠留边收口(见下);
 * - web 模糊 = `TAB_BAR_GLASS_BLUR_PX`(与底部 TabBar 同一条模糊半径)。
 *
 * `TabBar.styles.ts` 的 container 与 `NavChrome.tsx` 的 wrap 都只 spread 本对象,
 * 不在端内各写一份背景/描边/圆角/阴影。要改顶栏和底栏观感,只改本文件。
 *
 * 2026-11-27 四向投影修复(用户实拍:社区页顶栏下投影被页面层盖住,左右/上缘也被屏边裁掉):
 * - 阴影必须落在**不被内容裁剪的承载层**。`overflow: hidden` 会连盒阴影一起建立裁剪容器;
 *   页面正文又是不透明兄弟层,会盖住下投影。故把"玻璃面"与"圆角裁剪"拆成两枚对象:
 *   面层只负责背景/描边/阴影,裁剪层 `GLASS_BAR_CLIP` 只负责圆角裁内容。
 * - 阴影半径不再盲取 lg 的 12:顶/底栏左右各停靠 `TAB_BAR_MARGIN_H_PX`(10),顶距
 *   `TAB_BAR_GAP_TOP_PX`(6),offsetY 4。半径 10 时,左右恰好铺满 10、上缘恰好 6,
 *   四边在屏幕内自然淡出;若沿用 12,左右各被屏幕裁 2、上缘被裁 2,正是实拍里的硬边。
 *   半径锚定停靠留边,留边改大/改小时投影跟着走,不再出现"只亮一边"。
 */
import { Platform, StyleSheet, type ViewStyle } from 'react-native'
import { ELEVATION_STEPS, rnRadius } from '@ihui/design-tokens'
import { TAB_BAR_GLASS_BLUR_PX, TAB_BAR_MARGIN_H_PX } from '@ihui/shared/ui/tab-bar-spec'
import { tokens as tk } from './active-tokens'

/** web 预览的 backdrop blur;原生端没有 backdropFilter,只保留半透明玻璃底。 */
const glassBlurLayer: ViewStyle =
  Platform.OS === 'web'
    ? ({ backdropFilter: `blur(${TAB_BAR_GLASS_BLUR_PX}px)` } as unknown as ViewStyle)
    : {}

/**
 * 玻璃条投影半径 = 横向停靠留边。
 * 推导:左右留边 10 ⇒ 半径不得超过 10,否则左右两翼被屏幕边裁掉;顶隙 6、offsetY 4
 * ⇒ 上翼 = 半径 - 4 = 6,也恰好铺满。底翼 14 落在正文之上,由 NavChrome 的 zIndex 保证可见。
 * Android 无 shadowRadius,以同值 elevation 取同量级轮廓。
 */
const GLASS_BAR_ELEVATION_RADIUS_PX = TAB_BAR_MARGIN_H_PX

/** 顶栏 / 底栏共用的玻璃面:背景、描边、圆角、四向投影、web 模糊。不含内容裁剪。 */
export const GLASS_BAR_SURFACE: ViewStyle = {
  backgroundColor: tk.glass.bg,
  borderRadius: rnRadius.xl,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: tk.border.light,
  ...ELEVATION_STEPS.lg,
  // lg 的原语保留(shadowColor/offset/opacity 同一套),只把半径收进停靠留边
  shadowRadius: GLASS_BAR_ELEVATION_RADIUS_PX,
  elevation: GLASS_BAR_ELEVATION_RADIUS_PX,
  ...glassBlurLayer,
}

/**
 * 玻璃面的圆角裁剪层:只裁内部 BlurView / rimLight / 图标，阴影由外层 `GLASS_BAR_SURFACE` 投。
 * 两者必须成对使用:直接给面层加 `overflow: hidden` 会把投影关回盒子里(本缺陷的起点)。
 */
export const GLASS_BAR_CLIP: ViewStyle = {
  borderRadius: rnRadius.xl,
  overflow: 'hidden',
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
