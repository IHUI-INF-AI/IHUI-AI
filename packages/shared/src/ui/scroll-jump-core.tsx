// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ScrollJumpButton(「返回顶部 / 跳到最新」浮动箭头)的**平台无关组件核心**。
 *
 * 与 `back-chevron-core.tsx` 同形:一份与平台无关的组件源 + 每端注入 primitive adapter,
 * 尺寸/圆角/描边/按压档仍由 `scroll-jump-spec` 与 design-tokens 唯一供出。核心拥有
 * 方向 → 图标语义(`scrollJumpIconName`)、按压态(`SCROLL_JUMP_PRESSED_OPACITY`)、
 * 可访问名称与渲染结构;盒子视图与图标字形由两端 adapter 注入。
 *
 * 本文件**禁止 import 'react-native' / '@tarojs/*'** —— 共享核心里出现平台件,
 * 一端 tsc 就会把它拉进被检程序(根桶事故同型)。`onPress` / `onTap` 的动作语义留调用方。
 */
import type { ComponentType, ReactNode } from 'react'

import {
  SCROLL_JUMP_PRESSED_OPACITY,
  scrollJumpGlyphPx,
  scrollJumpIconName,
  type ScrollJumpDirection,
} from './scroll-jump-spec'

/** 图标字形原语的入参:方向已归一成 lucide 名,墨迹边长按该端单位换算后给数。 */
export interface ScrollJumpGlyphProps {
  name: 'chevron-up' | 'arrow-down'
  size: number
  color: string
}

/**
 * 可按压容器原语的入参。盒子视图的合成(几何 + 压暗 + 调用方样式)住在平台原语里:
 * RN 的 pressed 只能经 children render prop 落到子 View 数组样式(守门 131);
 * 小程序只有静态 hoverClass。
 */
export interface ScrollJumpPressableProps<B, S, E> {
  onActivate?: (event: E) => void
  accessibilityLabel: string
  testID?: string
  className?: string
  boxStyle: B
  pressedStyle: { opacity: number }
  style?: S
  children: ReactNode
}

/** 每端注入的平台原语集。`B` = 盒样式类型,`S` = 调用方样式类型,`E` = 原生事件类型。 */
export interface ScrollJumpPlatform<B, S, E> {
  /** 逻辑 px → 图标墨迹的平台单位**数值**(RN:dp;小程序:rpx 数) */
  glyphUnit: (px: number) => number
  Pressable: ComponentType<ScrollJumpPressableProps<B, S, E>>
  Glyph: ComponentType<ScrollJumpGlyphProps>
}

/** 核心入参:平台原语 + 两端 props 的并集(动作/配色/定位由壳与调用方持)。 */
export interface ScrollJumpButtonCoreProps<B, S, E> {
  platform: ScrollJumpPlatform<B, S, E>
  direction: ScrollJumpDirection
  onPress?: (event: E) => void
  /** 无障碍名称(只用于无障碍,不参与可见渲染) */
  label: string
  /** 盒子外观 + 几何(端内已按 design-tokens 投影,核心不重复取数) */
  boxStyle: B
  /** 图标色(端内 token 或调用方自定义,经 Glyph 原语落到矢量载体) */
  glyphColor: string
  style?: S
  testID?: string
  className?: string
}

/**
 * 平台无关的滚动按钮核心。渲染树完全由注入的原语拼出:
 * 编译期两端各实例化一次(RN `StyleProp<ViewStyle>` / `GestureResponderEvent`;
 * 小程序 `CSSProperties` / `ITouchEvent`),运行时跑的是同一份方向与按压语义。
 */
export function ScrollJumpButtonCore<B, S, E>({
  platform,
  direction,
  onPress,
  label,
  boxStyle,
  glyphColor,
  style,
  testID,
  className,
}: ScrollJumpButtonCoreProps<B, S, E>) {
  const glyphSize = platform.glyphUnit(scrollJumpGlyphPx())

  return (
    <platform.Pressable
      onActivate={onPress}
      accessibilityLabel={label}
      testID={testID}
      className={className}
      boxStyle={boxStyle}
      pressedStyle={{ opacity: SCROLL_JUMP_PRESSED_OPACITY }}
      style={style}
    >
      <platform.Glyph
        name={scrollJumpIconName(direction)}
        size={glyphSize}
        color={glyphColor}
      />
    </platform.Pressable>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
