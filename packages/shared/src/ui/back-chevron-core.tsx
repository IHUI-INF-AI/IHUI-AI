// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * BackChevron(页头返回键)的**平台无关组件核心** —— O81 票③第一例:
 * 「一份与平台无关的组件源 + 每端注入 primitive adapter」(AGENTS §4:自动生效只有这一种
 * 实现方式;2026-09-22 的单向适配器已因「同名 ≠ 同契约」删掉 4,662 行,不要再试第二条路)。
 *
 * 核心拥有(改一处、两端自动生效的那一层):
 *  - 尺寸与居中结构:`backChevronBoxStyle` / `backChevronGlyphPx`(真相源在 design-tokens
 *    的 geometry,含「移动端墨迹为何不取 web 顶栏 14px」的取值依据);
 *  - 按压透明度:`BACK_CHEVRON_PRESSED_OPACITY`(0.6 —— 两端此前各写一遍的那个数);
 *  - 无障碍语义:button 角色 + 调用方给的 `accessibilityLabel`(可见侧是裸箭头,
 *     名称必须脱离上下文也成立);
 *  - 字号缩放通道:墨迹边长 = `backChevronGlyphPx()` × 注入的倍率(RN 取系统字号,
 *     小程序端无此通道、注入恒 1)。
 * `onPress` / `onTap` 的**动作语义留调用方**(navigateBack / switchTab / 回登录页由各页持)。
 *
 * 平台原语由两端 adapter 注入。本文件**禁止 import 'react-native' / '@tarojs/*'** ——
 * 共享核心里出现平台件,小程序与 RN 的 tsc 就会有一端把它拉进被检程序(根桶事故同型):
 *  - 可按压容器 `Pressable`:RN = react-native Pressable(pressed 只能经 children render prop
 *    落到子 View 的**数组**样式上 —— 函数形态 style 会被 cssInterop 静默吃掉,守门 131
 *    立项那一型);小程序 = @tarojs/components View(onClick + 静态 hoverClass,端内 Tailwind
 *    生成器只认静态类名字面量)。
 *  - 盒子视图:由各端 Pressable 原语内部合成(几何 → pressed → 调用方 style 的压栈序)。
 *    不把 Box 也提到核心里渲染的理由:pressed 的表达方式是平台事实(RN render prop /
 *    小程序 hoverClass),抽上来只会造出「两端都不像自己」的第三种形态,还多一层 DOM。
 *  - 图标字形 `Glyph`:RN = lucide-react-native ChevronLeft;小程序 = LineIcon
 *    `name="chevron-left"`(守门 102 的 S0 机制清单按这两个字面量判「矢量出口仍在位」)。
 *  - 单位换算 `toUnit` / `glyphUnit`:RN dp 恒等;小程序盒走 rpx 串、墨迹走 rpx 数
 *    (LineIcon 的 size 收数值,它自己再按 H5/原生换算)。
 *
 * 接线形状(两端壳走本核心 + 原语经注入 + 调用点 props 形态不回退)由
 * `packages/shared/src/ui/__tests__/back-chevron-wiring.test.ts` 钉住 ——
 * 要改这份契约,先改那枚测试,不让「悄悄少注入一格」静默发生。
 */
import type { ComponentType, ReactNode } from 'react'

import {
  BACK_CHEVRON_PRESSED_OPACITY,
  backChevronBoxStyle,
  backChevronGlyphPx,
  type GeometryUnit,
} from './back-chevron-spec'

/** 命中方块几何(宽高 + 居中三件套)。形状与取值的唯一源 = `backChevronBoxStyle`。 */
export type BackChevronBoxStyle<U extends string | number> = ReturnType<
  typeof backChevronBoxStyle<U>
>

/** 图标字形原语的入参(墨迹边长 + 图标色)。两端都收**数值**:RN dp / 小程序 rpx 数。 */
export interface BackChevronGlyphProps {
  size: number
  color: string
}

/**
 * 可按压容器原语的入参。盒子视图的合成(几何 + 压暗 + 调用方样式)住在平台原语里,
 * 理由见文件头注(RN 的 pressed 只能落到子 View 数组样式;小程序只有静态 hoverClass)。
 *
 * `E` = 该端原生事件类型(RN `GestureResponderEvent` / 小程序 `ITouchEvent`):
 * 小程序侧 `onTap` 的事件形参是既有公开契约,经泛型原样带到端上 —— 不丢事件,
 * 也不给没有事件的一端伪造事件。
 */
export interface BackChevronPressableProps<UB extends string | number, S, E> {
  /** 激活动作(调用方语义);该端未接线时为 undefined */
  onActivate?: (event: E) => void
  /** 无障碍名称(button 角色由原语落成该端属性:accessibilityRole / ariaRole) */
  accessibilityLabel: string
  /** RN 测试钩子(小程序端无此通道,忽略) */
  testID?: string
  /** 小程序端定位/样式类名(RN 无此通道,忽略) */
  className?: string
  /** 命中方块几何(单位已由 `toUnit` 换算) */
  boxStyle: BackChevronBoxStyle<UB>
  /**
   * 按压态样式(核心恒定供出)。小程序原语没有 pressed 渲染通道,把它映射到静态
   * hoverClass —— 与 `BACK_CHEVRON_PRESSED_OPACITY` 的对应关系由 wiring 测试钉住,
   * 不靠注释口头同值。
   */
  pressedStyle: { opacity: number }
  /** 调用方附加样式(压在 pressed 之上 —— 与两端既有行为一致) */
  style?: S
  children: ReactNode
}

/** 每端注入的平台原语集。`UB` = 盒子几何的单位类型(RN number / 小程序 string)。 */
export interface BackChevronPlatform<UB extends string | number, S, E> {
  /** 逻辑 px → 盒子几何的平台单位(RN:恒等 dp;小程序:rpx 串) */
  toUnit: GeometryUnit<UB>
  /** 逻辑 px → 图标墨迹的平台单位**数值**(RN:dp;小程序:rpx 数) */
  glyphUnit: (px: number) => number
  /** 系统字号缩放倍率(小程序端无此通道,注入 `() => 1`) */
  useFontMultiplier: () => number
  /** 可按压容器(内部合成盒子视图 + 按压态) */
  Pressable: ComponentType<BackChevronPressableProps<UB, S, E>>
  /** 图标字形 */
  Glyph: ComponentType<BackChevronGlyphProps>
}

/** 核心入参:平台原语 + 两端 props 的并集(动作与配色由调用方/壳持)。 */
export interface BackChevronCoreProps<UB extends string | number, S, E> {
  platform: BackChevronPlatform<UB, S, E>
  /** 返回动作;各页语义不同,由调用方持有(`E` 为该端事件类型) */
  onPress?: (event: E) => void
  /** 无障碍名称(只用于无障碍,不参与可见渲染) */
  label: string
  /** 图标色(端内 token 或调用方自定义,经 Glyph 原语落到矢量载体) */
  glyphColor: string
  /** 调用方附加样式(端内样式类型,经 Pressable 原语落栈) */
  style?: S
  testID?: string
  className?: string
}

/**
 * 平台无关的返回键核心。它自己不 import 任何平台件 —— 渲染树完全由注入的原语拼出:
 * 编译期两端各实例化一次(RN `number` / `StyleProp<ViewStyle>` / `GestureResponderEvent`;
 * 小程序 `string` / `CSSProperties` / `ITouchEvent`),运行时跑的是同一份几何与结构代码。
 *
 * 为什么墨迹要 round:倍率是小数(1.0~1.4),不取整会把亚像素喂给图标载体;
 * 小程序倍率恒 1 ⇒ `Math.round(20 × 1)` 与改动前逐字同值。
 */
export function BackChevronCore<UB extends string | number, S, E>({
  platform,
  onPress,
  label,
  glyphColor,
  style,
  testID,
  className,
}: BackChevronCoreProps<UB, S, E>) {
  const multiplier = platform.useFontMultiplier()
  const boxStyle = backChevronBoxStyle(platform.toUnit)
  const glyphSize = platform.glyphUnit(Math.round(backChevronGlyphPx() * multiplier))

  return (
    <platform.Pressable
      onActivate={onPress}
      accessibilityLabel={label}
      testID={testID}
      className={className}
      boxStyle={boxStyle}
      pressedStyle={{ opacity: BACK_CHEVRON_PRESSED_OPACITY }}
      style={style}
    >
      <platform.Glyph size={glyphSize} color={glyphColor} />
    </platform.Pressable>
  )
}
