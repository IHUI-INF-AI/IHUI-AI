// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * TabBar 样式定义 (mobile-rn 端)
 * 悬浮胶囊风(对齐 Telegram/钉钉 App 底部导航) — 胶囊脱离屏幕边缘:
 * 左右留边 + 圆角 + 投影,底部按 safe-area 悬浮避开手势区。
 * 5 Tab 等宽布局;选中态用 tk.brand.DEFAULT,未选中用 tk.text.tertiary,无霓虹无渐变。
 */
import { StyleSheet } from 'react-native'
import type { ViewStyle, TextStyle, ImageStyle } from 'react-native'
import { tokens as tk } from '../theme/active-tokens'

export const TAB_BAR_HEIGHT = 56
export const TAB_BAR_ICON_SIZE = 24
export const TAB_BAR_FONT_SIZE = 11
/** 胶囊左右留边(对齐 Telegram/钉钉悬浮栏与屏幕边缘的间距) */
const TAB_BAR_FLOAT_MARGIN_H = 12
/** 胶囊顶部与内容的间距 */
export const TAB_BAR_FLOAT_GAP_TOP = 6
/** 胶囊底部最小悬浮间距(无 safe-area 时兜底) */
export const TAB_BAR_FLOAT_GAP_BOTTOM_MIN = 8
/** 胶囊圆角(小圆角悬浮卡,对齐钉钉风格;2026-09-22 用户定稿"小圆角") */
export const TAB_BAR_RADIUS = 14

export const tabBarStyles = {
  /** 外层留白容器:负责水平留边与底部 safe-area 悬浮(运行时注入 marginBottom) */
  wrapper: {
    marginHorizontal: TAB_BAR_FLOAT_MARGIN_H,
    marginTop: TAB_BAR_FLOAT_GAP_TOP,
  } satisfies ViewStyle,

  /** 内层胶囊:圆角 + 卡色底 + 投影(替代原贴底全宽条) */
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: TAB_BAR_HEIGHT,
    backgroundColor: tk.surface.card,
    borderRadius: TAB_BAR_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tk.border.light,
    shadowColor: tk.gray.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
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

  labelActive: {
    color: tk.brand.DEFAULT,
  } satisfies TextStyle,

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
