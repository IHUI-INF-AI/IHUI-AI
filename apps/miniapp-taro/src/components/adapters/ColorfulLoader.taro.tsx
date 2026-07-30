import { View } from '@tarojs/components'
import type { CSSProperties } from 'react'
import { getRnTokens, type RnThemeMode } from '@ihui/design-tokens'

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
  size?: number
  visible?: boolean
  className?: string
  /** 已解析主题(主题仅影响 outer 容器背景,可选);默认 'light' */
  colorScheme?: RnThemeMode
}

const DOT_COUNT = 72
const DEFAULT_SIZE = 80
/** 容器背景色 token key:浅色 = 透明,深色 = 极深透明 */
const CONTAINER_BG: Record<RnThemeMode, string> = {
  light: 'transparent',
  dark: 'rgba(0,0,0,0.1)',
}

/** Taro rpx 单位换算(1px = 2rpx) */
const toRpx = (px: number): string => `${px * 2}rpx`

/** 容器样式(独立函数避免 style 联合) */
const containerStyle = (size: number, colorScheme: RnThemeMode): CSSProperties => ({
  position: 'relative',
  width: toRpx(size),
  height: toRpx(size),
  backgroundColor: CONTAINER_BG[colorScheme],
  // 微信小程序 view 不支持 CSS animation 属性(行内 style 不解析 @keyframes);
  // 用 Tailwind className 注入 animate-spin 替代,样式来源:tailwind.config.js keyframes.spin
  // 这里保留 animation 字段作为 SSR/Web 端兼容(支付宝/抖音小程序支持)
  animation: 'spin 1.2s linear infinite',
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
  borderRadius: '50%',
  backgroundColor: color,
  transform: `rotate(${angle}deg) translateY(-${toRpx(radius)})`,
})

export function ColorfulLoader({
  size = DEFAULT_SIZE,
  visible = true,
  className,
  colorScheme = 'light',
}: ColorfulLoaderProps) {
  if (!visible) return null

  // 触发主题 token 解析,即使未在 JS 中读取,主题色被打包进入 inline style
  void getRnTokens(colorScheme)

  const radius = size / 2
  const dotSize = Math.max(2, size / 20)

  return (
    <View className={`animate-spin ${className ?? ''}`} style={containerStyle(size, colorScheme)}>
      {Array.from({ length: DOT_COUNT }).map((_, i) => {
        const angle = (360 / DOT_COUNT) * i
        const color = `hsl(${i * 5}, 70%, 60%)`
        return <View key={i} style={dotStyle(dotSize, radius, angle, color)} />
      })}
    </View>
  )
}
