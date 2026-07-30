/**
 * TabBar 样式定义 (mobile-rn 端)
 * 浅色优雅风 — 顶部 1px 边框 + 表面卡色背景,5 Tab 等宽布局。
 * 选中态用 tk.brand.DEFAULT,未选中用 tk.text.tertiary,无霓虹无渐变。
 */
import { StyleSheet } from 'react-native'
import type { ViewStyle, TextStyle, ImageStyle } from 'react-native'
import { rnLightTokens as tk } from '@ihui/design-tokens'

export const TAB_BAR_HEIGHT = 56
export const TAB_BAR_ICON_SIZE = 24
export const TAB_BAR_FONT_SIZE = 10
export const TAB_BAR_TOP_BORDER = 1

export const tabBarStyles = {
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: TAB_BAR_HEIGHT,
    backgroundColor: tk.surface.card,
    borderTopWidth: TAB_BAR_TOP_BORDER,
    borderTopColor: tk.border.light,
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
