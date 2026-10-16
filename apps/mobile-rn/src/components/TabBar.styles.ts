// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * TabBar 样式定义 (mobile-rn 端)
 * 悬浮胶囊风(对齐 Telegram/钉钉 App 底部导航) — 绝对定位悬浮在内容之上:
 * 左右留边 + 圆角 + 投影,底部按 safe-area 悬浮避开手势区;液态玻璃底
 * (glass.bg 半透明 + backdrop blur),下方内容若隐若现。
 * 5 Tab 等宽布局;选中态用 text.primary(深色中性),未选中用 text.tertiary(中性灰)。
 */
import { Platform, StyleSheet } from 'react-native'
import type { ViewStyle, TextStyle, ImageStyle } from 'react-native'
import { tokens as tk } from '../theme/active-tokens'
import { rnRadius } from '@ihui/design-tokens'

export const TAB_BAR_HEIGHT = 56
export const TAB_BAR_ICON_SIZE = 24
export const TAB_BAR_FONT_SIZE = 11
/** 胶囊左右留边(对齐 Telegram/钉钉悬浮栏与屏幕边缘的间距) */
export const TAB_BAR_FLOAT_MARGIN_H = 12
/** 胶囊顶部与内容的间距 */
export const TAB_BAR_FLOAT_GAP_TOP = 6
/** 胶囊底部最小悬浮间距(无 safe-area 时兜底) */
export const TAB_BAR_FLOAT_GAP_BOTTOM_MIN = 8
/** 胶囊圆角(小圆角悬浮卡,对齐钉钉风格;2026-09-22 用户定稿"小圆角";原 14,R1 吸附至 xl(12)) */
export const TAB_BAR_RADIUS = rnRadius.xl

/**
 * 内容区底部预留(给悬浮胶囊让出滚动空间,内容可滚到胶囊底下若隐若现):
 * 胶囊高 + 顶隙 + 底隙 + 16dp 呼吸余量。safe-area 部分由各屏按 useSafeAreaInsets 追加
 * (App.tsx 的 SafeAreaView 只包 top 边,底部 inset 未全局占用)。
 */
export const TAB_BAR_FLOAT_RESERVE =
  TAB_BAR_HEIGHT + TAB_BAR_FLOAT_GAP_TOP + TAB_BAR_FLOAT_GAP_BOTTOM_MIN + 16

/**
 * 各屏滚动内容区的底部预留(px):内容滚到底时末项仍完整露在胶囊之上,
 * 继续滚动则内容钻到胶囊底下被玻璃半透出。insetsBottom 传 useSafeAreaInsets().bottom;
 * 底部无安全区的屏传 0。
 */
export function tabBarScrollReserve(insetsBottom: number): number {
  const floatGap = Math.max(TAB_BAR_FLOAT_GAP_BOTTOM_MIN, insetsBottom * 0.5 + 4)
  return TAB_BAR_HEIGHT + TAB_BAR_FLOAT_GAP_TOP + floatGap + 16
}

/**
 * 玻璃停靠区(HomeScreen 底部 InputArea + TabBar 整块玻璃)内给悬浮胶囊让位的 spacer 高度:
 * 胶囊自身高 + 与上方输入区的间隙 + 底部安全区悬浮量。停靠区高度 = 输入区高度 + 本值。
 */
export function tabBarDockSpacer(insetsBottom: number): number {
  const floatGap = Math.max(TAB_BAR_FLOAT_GAP_BOTTOM_MIN, insetsBottom * 0.5 + 4)
  return TAB_BAR_HEIGHT + TAB_BAR_FLOAT_GAP_TOP + floatGap
}

/**
 * 液态玻璃模糊半径(px)。web 预览(react-native-web)原生支持 View 的 backdropFilter,
 * 零依赖真模糊;原生端暂不引入 expo-blur,退化为 glass.bg 半透明底(仍"若隐若现",无模糊)。
 * 与 miniapp custom-tab-bar 的 backdrop-blur-xl(24px)同值,两端观感一致。
 */
const GLASS_BLUR_RADIUS = 24

/** web 预览专属模糊层(RNW 类型外属性,经 ViewStyle 断言注入,避免 any);
 *  TabBar 胶囊与 HomeScreen 底部玻璃停靠区共用同一模糊半径。 */
export const glassBlurLayer: ViewStyle =
  Platform.OS === 'web'
    ? ({ backdropFilter: `blur(${GLASS_BLUR_RADIUS}px)` } as unknown as ViewStyle)
    : {}

export const tabBarStyles = {
  /** 外层定位容器:绝对定位浮在内容之上,左右留边,底部贴齐(运行时注入 marginBottom 让出 safe-area) */
  wrapper: {
    position: 'absolute',
    left: TAB_BAR_FLOAT_MARGIN_H,
    right: TAB_BAR_FLOAT_MARGIN_H,
    bottom: 0,
  } satisfies ViewStyle,

  /** 内层胶囊:圆角 + 液态玻璃底 + 细描边 + 投影(替代原贴底全宽实心条) */
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: TAB_BAR_HEIGHT,
    backgroundColor: tk.glass.bg,
    borderRadius: TAB_BAR_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tk.border.light,
    shadowColor: tk.gray.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    ...glassBlurLayer,
  } satisfies ViewStyle,

  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: TAB_BAR_HEIGHT,
    paddingVertical: 4,
  } satisfies ViewStyle,

  icon: {
    width: TAB_BAR_ICON_SIZE,
    height: TAB_BAR_ICON_SIZE,
    resizeMode: 'contain',
  } satisfies ImageStyle,

  label: {
    fontSize: TAB_BAR_FONT_SIZE,
    marginTop: 2,
    lineHeight: TAB_BAR_FONT_SIZE + 2,
  } satisfies TextStyle,

  /** 选中态文字:深色中性(text.primary,亮 #0A0A0A / 暗 #FAFAFA) */
  labelActive: {
    color: tk.text.primary,
  } satisfies TextStyle,

  /** 未选中态文字:中性灰(text.tertiary,亮 #A3A3A3 / 暗 #737373) */
  labelInactive: {
    color: tk.text.tertiary,
  } satisfies TextStyle,
} as const

/**
 * StyleSheet.create 包装 — 运行时仍走 RN StyleSheet 注册,保留 transform 优化。
 * 类型提示保留对象字面量结构,避免 StyleSheet.create 把所有键 union 化。
 */
export const tabBarStyleSheet = StyleSheet.create(tabBarStyles)

export type TabBarStyles = typeof tabBarStyles
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
