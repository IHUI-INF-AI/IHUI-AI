// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * NavBar(顶部导航栏)的**平台无关组件核心**。
 *
 * 与 `scroll-jump-core.tsx` / `back-chevron-core.tsx` 同形:一份与平台无关的组件源 +
 * 每端注入 primitive adapter。核心拥有**骨架与语义**:
 *   容器 → [状态栏占位] → 行(左槽 / 中槽[标题+副标题] / 右槽) → [行下附加条]
 * 几何/字号/圆角/描边/类名/无障碍属性仍由两端壳持(经 style/className 注入),
 * 端内颜色与 token 取值、按压态、hoverClass、hitSlop、返回键手势也留在壳里。
 *
 * 本文件**禁止 import 'react-native' / '@tarojs/*'** —— 共享核心里出现平台件,
 * 一端 tsc 就会把它拉进被检程序(根桶事故同型)。
 * 动作语义(`onPress` / `onTap` / `onClick`)一律留调用方,核心只摆结构。
 */
import type { ComponentType, ReactNode } from 'react'

/** 盒子原语入参:`B` = 该端盒样式类型,`C` = 该端类名类型(RN 不传,小程序传 string)。 */
export interface NavBarCoreBoxProps<B, C> {
  style?: B
  className?: C
  children?: ReactNode
}

/** 文本原语入参:`T` = 该端文本样式类型;`numberOfLines` 由 RN adapter 映射为截断语义。 */
export interface NavBarCoreTextProps<T, C> {
  style?: T
  className?: C
  numberOfLines?: number
  children?: ReactNode
}

/** 每端注入的平台原语集。 */
export interface NavBarCorePlatform<B, T, C> {
  Box: ComponentType<NavBarCoreBoxProps<B, C>>
  Text: ComponentType<NavBarCoreTextProps<T, C>>
}

/**
 * 核心入参:平台原语 + 两端 props 的并集。
 * 左/中/右/前后槽位承载端内差异(返回键、菜单、分类、加入社区群、通知条……),
 * 核心只决定"谁在什么位置",不决定"长什么样"。
 */
export interface NavBarCoreProps<B, T, C> {
  platform: NavBarCorePlatform<B, T, C>
  /** 状态栏占位(RN 由 SafeAreaView 外部注入,不传;小程序传高度占位) */
  leading?: ReactNode
  containerStyle?: B
  containerClassName?: C
  rowStyle?: B
  rowClassName?: C
  left?: ReactNode
  leftStyle?: B
  leftClassName?: C
  /** 覆盖默认 title 的中心内容(小程序 ai-home 的「每日资讯/排行榜」切换) */
  center?: ReactNode
  centerStyle?: B
  centerClassName?: C
  title?: string
  titleStyle?: T
  titleClassName?: C
  subtitle?: string
  subtitleStyle?: T
  subtitleClassName?: C
  right?: ReactNode
  rightStyle?: B
  rightClassName?: C
  /** 行下方附加条(两端通知条);默认模式由壳给绝对定位,ai-home 为行内块 */
  trailing?: ReactNode
}

/**
 * 平台无关的导航栏核心。编译期两端各实例化一次
 * (RN `StyleProp<ViewStyle>` / `StyleProp<TextStyle>`;小程序 `CSSProperties` / string),
 * 运行时跑的是同一份骨架与标题语义。
 */
export function NavBarCore<B, T, C>({
  platform,
  leading,
  containerStyle,
  containerClassName,
  rowStyle,
  rowClassName,
  left,
  leftStyle,
  leftClassName,
  center,
  centerStyle,
  centerClassName,
  title,
  titleStyle,
  titleClassName,
  subtitle,
  subtitleStyle,
  subtitleClassName,
  right,
  rightStyle,
  rightClassName,
  trailing,
}: NavBarCoreProps<B, T, C>) {
  return (
    <platform.Box style={containerStyle} className={containerClassName}>
      {leading}
      <platform.Box style={rowStyle} className={rowClassName}>
        <platform.Box style={leftStyle} className={leftClassName}>
          {left}
        </platform.Box>
        <platform.Box style={centerStyle} className={centerClassName}>
          {center ??
            (title ? (
              <platform.Text style={titleStyle} className={titleClassName} numberOfLines={1}>
                {title}
              </platform.Text>
            ) : null)}
          {subtitle ? (
            <platform.Text
              style={subtitleStyle}
              className={subtitleClassName}
              numberOfLines={1}
            >
              {subtitle}
            </platform.Text>
          ) : null}
        </platform.Box>
        <platform.Box style={rightStyle} className={rightClassName}>
          {right}
        </platform.Box>
      </platform.Box>
      {trailing}
    </platform.Box>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
