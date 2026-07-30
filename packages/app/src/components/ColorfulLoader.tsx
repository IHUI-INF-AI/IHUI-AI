import type { CSSProperties } from 'react'
import { getTokens, type AppThemeMode } from '../theme/tokens'

/**
 * 72 点彩色旋转加载器(纯装饰) — 跨端共享层。
 *
 * 对齐原项目 components/colorful_loader.vue:72 个彩色圆点环绕旋转。
 *
 * 简化实现:外层容器用 CSS `animation: spin` 旋转,72 点用数组渲染,
 * 每点按 (360/72)*i 度旋转定位、HSL 循环着色。
 * 颜色计算:HSL hue = i*5(0-355),sat 70%,light 60%,彩虹循环。
 */
export interface ColorfulLoaderProps {
  size?: number
  visible?: boolean
  className?: string
  /** 已解析主题,默认 'light'(主题仅影响 outer 容器背景,可选) */
  colorScheme?: AppThemeMode
}

const DOT_COUNT = 72
const DEFAULT_SIZE = 80
/** 容器背景色 token key:浅色 = 透明,深色 = 极深透明 */
const CONTAINER_BG: Record<AppThemeMode, string> = {
  light: 'transparent',
  dark: 'rgba(0,0,0,0.1)',
}

/** 自旋转 keyframes(行内 style 标签注入,只生成一次) */
const KEYFRAMES_ID = 'ihui-colorful-loader-keyframes'
let keyframesInjected = false
function ensureKeyframes(): void {
  if (keyframesInjected || typeof document === 'undefined') return
  if (document.getElementById(KEYFRAMES_ID)) {
    keyframesInjected = true
    return
  }
  const styleEl = document.createElement('style')
  styleEl.id = KEYFRAMES_ID
  styleEl.textContent = `
@keyframes ihui-colorful-loader-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}`
  document.head.appendChild(styleEl)
  keyframesInjected = true
}

/** view container 样式(独立函数避免 style 联合) */
const viewStyles = (size: number, colorScheme: AppThemeMode): CSSProperties => ({
  position: 'relative',
  width: size,
  height: size,
  backgroundColor: CONTAINER_BG[colorScheme],
  animation: 'ihui-colorful-loader-spin 1.2s linear infinite',
})

/** dot 样式 */
const dotStyles = (
  dotSize: number,
  radius: number,
  angle: number,
  color: string,
): CSSProperties => ({
  position: 'absolute',
  width: dotSize,
  height: dotSize,
  top: '50%',
  left: '50%',
  marginLeft: -dotSize / 2,
  marginTop: -dotSize / 2,
  borderRadius: '50%',
  backgroundColor: color,
  transform: `rotate(${angle}deg) translateY(-${radius}px)`,
})

export function ColorfulLoader({
  size = DEFAULT_SIZE,
  visible = true,
  className,
  colorScheme = 'light',
}: ColorfulLoaderProps) {
  if (!visible) return null

  ensureKeyframes()

  const radius = size / 2
  const dotSize = Math.max(2, size / 20)
  // 抑制未使用变量警告
  void getTokens(colorScheme)

  return (
    <div className={className} style={viewStyles(size, colorScheme)}>
      {Array.from({ length: DOT_COUNT }).map((_, i) => {
        const angle = (360 / DOT_COUNT) * i
        const color = `hsl(${i * 5}, 70%, 60%)`
        return <span key={i} style={dotStyles(dotSize, radius, angle, color)} />
      })}
    </div>
  )
}
