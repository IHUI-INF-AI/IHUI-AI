// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { View } from '@tarojs/components'
import { useAppTheme } from '@/lib/theme'
import { COLORS } from '@/constants/style'

/**
 * 底部平滑淡出遮罩(小程序端,与 mobile-rn BottomFadeMask 1:1 对标)
 *
 * 贴在悬浮玻璃胶囊正上方:从透明(顶)渐变到页面背景色(底),让滚动内容在接近
 * 底部胶囊前平滑「溶解」,任何位置都不出现硬边。
 *
 * 层级:在内容之上、胶囊之下(`pointerEvents: 'none'`,不挡滚动与点击);
 * `zIndex: 40` < 胶囊 `50`,且遮罩底边 = 胶囊顶沿(`bottomOffsetCss`),故不覆盖胶囊。
 *
 * 真实模糊由胶囊玻璃承接(内容滚到胶囊底下被真实模糊);本层只负责「无硬边过渡」。
 *
 * 色值纪律:自定义 tabBar 在页面树之外,内联 style 里的 `var(--color-*)` 与
 * 新版 `hsl(H S% L% / A)` 斜杠 alpha 语法实测均不解析 ⇒ 用 COLORS.bgPrimary(同源
 * tokens.css 的 surface.bg)经 hsl→rgba 手转,做带透明度的渐变停点,避免 `transparent`
 * 关键字在渐变里产生「透明黑」插值灰带(硬边同源病)。
 */
const BOTTOM_FADE_HEIGHT_PX = 120

/** `hsl(H S% L%)` → `rgba(r,g,b,a)`。微信内联 style 不解析 var(--color-*) 与斜杠 alpha,
 *  这里把 tokens 的 hsl 值手动转 rgba,以便渐变停点带正确透明度(同 hue/sat/light 保证无灰带)。 */
function hslToRgba(hsl: string, alpha: number): string {
  const m = hsl.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/)
  if (!m) return `rgba(0,0,0,${alpha})`
  const h = parseFloat(m[1] ?? '0')
  const s = parseFloat(m[2] ?? '0') / 100
  const l = parseFloat(m[3] ?? '0') / 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const mm = l - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) {
    r = c
    g = x
    b = 0
  } else if (h < 120) {
    r = x
    g = c
    b = 0
  } else if (h < 180) {
    r = 0
    g = c
    b = x
  } else if (h < 240) {
    r = 0
    g = x
    b = c
  } else if (h < 300) {
    r = x
    g = 0
    b = c
  } else {
    r = c
    g = 0
    b = x
  }
  const ri = Math.round((r + mm) * 255)
  const gi = Math.round((g + mm) * 255)
  const bi = Math.round((b + mm) * 255)
  return `rgba(${ri}, ${gi}, ${bi}, ${alpha})`
}

export interface BottomFadeMaskProps {
  /** 遮罩底边距屏幕底的距离(CSS 值):一般 = 胶囊顶沿(与 RN 的 capsuleTopOffset 等价) */
  bottomOffsetCss: string
  /** 遮罩高度(px),默认 120 */
  height?: number
}

export default function BottomFadeMask({
  bottomOffsetCss,
  height = BOTTOM_FADE_HEIGHT_PX,
}: BottomFadeMaskProps) {
  const { resolved } = useAppTheme()
  const bg = COLORS.bgPrimary[resolved]
  const c0 = hslToRgba(bg, 0)
  const c50 = hslToRgba(bg, 0.5)
  const c100 = hslToRgba(bg, 1)
  return (
    <View
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: bottomOffsetCss,
        height: `${height}px`,
        pointerEvents: 'none',
        zIndex: 40,
        backgroundImage: `linear-gradient(to bottom, ${c0} 0%, ${c0} 35%, ${c50} 78%, ${c100} 100%)`,
      }}
    />
  )
}
