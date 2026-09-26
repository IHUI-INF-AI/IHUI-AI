// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { View } from '@tarojs/components'
import type { CSSProperties } from 'react'
import { getRnTokens, TARO_RPX_PER_PX, type RnThemeMode } from '@ihui/design-tokens'
import {
  COLORFUL_LOADER_DEFAULT_SIZE_PX,
  COLORFUL_LOADER_DOT_COUNT,
  COLORFUL_LOADER_SPIN_MS,
  colorfuleLoaderDotSizePx,
  colorfuleLoaderDotColor,
  colorfuleLoaderRadiusPx,
} from '@ihui/shared/ui/colorful-loader-spec'
import { useAppTheme } from '@/lib/theme'

/**
 * Taro 适配层:ColorfulLoader
 *
 * 平台特有:依赖 @tarojs/components 的 View 组件,不适合共享层。
 *
 * 复用 packages/app/src/components/ColorfulLoader 的 props 契约 + 72 点 HSL 着色算法,
 * 替换 web 元素(`div`/`span` → `View`)+ keyframes 注入策略(改用 Tailwind `animate-spin`)。
 * 微信小程序不支持 document.head 注入全局 keyframes,改用 Tailwind 内置 animate 替代。
 *
 * 关于 HSL 颜色:Taro View 端 HSL 字符串可直接生效(编译后通过内联 style 透传),
 * 不依赖 keyframes 注入,根治原 web 端 `ensureKeyframes()` 在小程序环境的 document 报错。
 */
export interface ColorfulLoaderProps {
  /** 直径,rpx 数值(默认档来自共享源 colorful-loader-spec;端内那份同名死副本 components/ColorfulLoader.tsx 已于 2026-09-26 摘除,别再照它对齐) */
  size?: number
  visible?: boolean
  className?: string
  /** 已解析主题(主题仅影响 outer 容器背景,可选);默认 'light' */
  colorScheme?: RnThemeMode
}

/// 数字档唯一源在 @ihui/shared/ui/colorful-loader-spec(与 RN 端 Animated 实现同表)。
const DEFAULT_SIZE_RPX = COLORFUL_LOADER_DEFAULT_SIZE_PX * TARO_RPX_PER_PX
/** 容器背景色 token key:浅色 = 透明,深色 = 极深透明 */
const CONTAINER_BG: Record<RnThemeMode, string> = {
  light: 'transparent',
  dark: 'var(--color-black-10)',
}

/** Taro rpx 单位换算(1px = TARO_RPX_PER_PX rpx,系数来自共享源) */
const toRpx = (px: number): string => `${px * TARO_RPX_PER_PX}rpx`

/** 容器样式(独立函数避免 style 联合);size 入参为 rpx 数值 */
const containerStyle = (sizeRpx: number, colorScheme: RnThemeMode): CSSProperties => ({
  position: 'relative',
  width: `${sizeRpx}rpx`,
  height: `${sizeRpx}rpx`,
  backgroundColor: CONTAINER_BG[colorScheme],
  // 微信小程序 view 不支持 CSS animation 属性(行内 style 不解析 @keyframes);
  // 用 Tailwind className 注入 animate-spin 替代,样式来源:tailwind.config.js keyframes.spin
  // 这里保留 animation 字段作为 SSR/Web 端兼容(支付宝/抖音小程序支持);周期与 RN Animated 同档(共享源)
  animation: `spin ${COLORFUL_LOADER_SPIN_MS / 1000}s linear infinite`,
})

/** 单点样式:旋转定位 + HSL 着色 */
const dotStyle = (
  dotSize: number,
  radius: number,
  angle: number,
  color: string,
): CSSProperties => ({
  position: 'absolute',
  width: toRpx(dotSize),
  height: toRpx(dotSize),
  top: '50%',
  left: '50%',
  marginLeft: toRpx(-dotSize / 2),
  marginTop: toRpx(-dotSize / 2),
  borderRadius: '50%', // radius-exempt: 旋转加载装饰点正圆(指示点本体,非容器,不得方档化)
  backgroundColor: color,
  transform: `rotate(${angle}deg) translateY(-${toRpx(radius)})`,
})

export function ColorfulLoader({
  size = DEFAULT_SIZE_RPX,
  visible = true,
  className,
  colorScheme,
}: ColorfulLoaderProps) {
  const { resolved: appTheme } = useAppTheme()
  const effectiveScheme: RnThemeMode = colorScheme ?? appTheme

  if (!visible) return null

  // 触发主题 token 解析,即使未在 JS 中读取,主题色被打包进入 inline style
  void getRnTokens(effectiveScheme)

  // size prop 是 rpx 数值,先折回逻辑 px 再走共享公式(单位换算是平台通道,数值是共享档)
  const sizePx = size / TARO_RPX_PER_PX
  const radius = colorfuleLoaderRadiusPx(sizePx)
  const dotSize = colorfuleLoaderDotSizePx(sizePx)

  return (
    <View
      className={`animate-spin ${className ?? ''}`}
      style={containerStyle(size, effectiveScheme)}
    >
      {Array.from({ length: COLORFUL_LOADER_DOT_COUNT }).map((_, i) => {
        const angle = (360 / COLORFUL_LOADER_DOT_COUNT) * i
        return <View key={i} style={dotStyle(dotSize, radius, angle, colorfuleLoaderDotColor(i))} />
      })}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
