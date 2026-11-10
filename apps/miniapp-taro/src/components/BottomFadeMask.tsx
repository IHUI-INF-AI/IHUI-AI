// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { View } from '@tarojs/components'
import { useAppTheme } from '@/lib/theme'
import { COLORS } from '@/constants/style'

/**
 * 滚动边缘淡出遮罩(小程序端),两种形态:
 *
 * ① 旧「底部实底平台」形态(custom-tab-bar 悬浮胶囊上方,默认路径):
 *    贴在胶囊正上方,从透明(顶,含 22% 平台段)渐变到页面背景实色(底)并一路铺到屏幕底,
 *    让滚动内容在接近底部胶囊前平滑「溶解」,任何位置都不出现硬边。
 *    层级:在内容之上、胶囊之下(`pointerEvents: 'none'`,不挡滚动与点击);
 *    `zIndex: 40` < 胶囊 `50`,故本体虽自渐变段顶一路铺到屏幕底,仍不覆盖胶囊。
 *    真实模糊由胶囊玻璃承接(内容滚到胶囊底下被真实模糊);本层只负责「无硬边过渡」。
 *    既有调用点(custom-tab-bar)不传新参时,渲染结果与本文件升级前逐字节一致。
 *
 * ② 多端一致「纯渐变边缘条」形态(`pureGradient: true`,2026-11-10 与 Web 端
 *    ScrollEdgeFades 同规格定档):滚动视口上/下边缘各贴一条纯线性渐变
 *    (边缘实底色 → 内侧完全透明,**无实底平台**),默认高 24px,
 *    仅当该方向确有溢出内容时由宿主挂载,pointer-events 穿透,颜色用所在区域背景令牌。
 *
 * 色值纪律:自定义 tabBar 在页面树之外,内联 style 里的 `var(--color-*)` 与
 * 新版 `hsl(H S% L% / A)` 斜杠 alpha 语法实测均不解析 ⇒ 用 COLORS.bgPrimary(同源
 * tokens.css 的 surface.bg)经 hsl→rgba 手转,做带透明度的渐变停点,避免 `transparent`
 * 关键字在渐变里产生「透明黑」插值灰带(硬边同源病)。页面树内消费同理(见 Web 端
 * color-mix 注释:透明端必须是同色 alpha 0)。
 */
const BOTTOM_FADE_HEIGHT_PX = 90

/** 多端一致规格的淡出条高度(px):Web/RN/小程序三端同值(非必要不要改) */
export const EDGE_FADE_HEIGHT_PX = 24

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

/**
 * 纯渐变边缘条的渐变串构建(2026-11-10 追加票:从组件抽出为纯函数,单测直测):
 * 边缘实底色(alpha 1)@0px → 内侧完全透明(同色 alpha 0)@heightPx,**两停点、无平台**;
 * 透明端用同色 alpha 0(非 `transparent` 关键字,防「透明黑」灰带)。
 */
export function buildPureEdgeGradient(
  bgHsl: string,
  edge: 'top' | 'bottom',
  heightPx: number,
): string {
  const c100 = hslToRgba(bgHsl, 1)
  const c0 = hslToRgba(bgHsl, 0)
  const dir = edge === 'top' ? 'to bottom' : 'to top'
  return `linear-gradient(${dir}, ${c100} 0px, ${c0} ${heightPx}px)`
}

export interface BottomFadeMaskProps {
  /** 渐变段底边距屏幕底(或 absolute 模式下属容器底)的距离(CSS 值):一般 = 胶囊顶沿(与 RN 的 capsuleTopOffset 等价);纯渐变 edge='bottom' 时 = 淡出条底边偏移 */
  bottomOffsetCss?: string
  /** 渐变段高度(px),默认 90(旧形态) */
  height?: number
  /** 淡出条贴哪条边缘:'bottom'(默认,旧行为)| 'top'(纯渐变新形态用) */
  edge?: 'top' | 'bottom'
  /** 新规格高度(px);默认沿用旧值 90 以兼容,与 height 同传时 heightPx 优先 */
  heightPx?: number
  /** 纯渐变模式开关:true ⇒ 边缘实底色 → 内侧完全透明,无实底平台、不向屏幕边缘延伸 */
  pureGradient?: boolean
  /** 布局模式:'fixed'(默认,贴屏幕坐标)| 'absolute'(贴最近定位容器,如抽屉内包裹层) */
  positionMode?: 'fixed' | 'absolute'
  /** 纯渐变 edge='top' 时,淡出条顶边距屏幕顶(或容器顶)的 CSS 值 */
  topOffsetCss?: string
  /** 淡出条左偏移(CSS 值),默认 '0px'(全宽);抽屉等窄容器传实测矩形左边距 */
  leftOffsetCss?: string
  /** 淡出条宽度(CSS 值),默认 '100%';窄容器传实测矩形宽度 */
  widthCss?: string
  /** 层级,默认 40(旧胶囊档:< 胶囊 50) */
  zIndex?: number
  /** 实底色源(hsl 字符串,如 tokens 的 --color-card 同值);默认 COLORS.bgPrimary(页面背景) */
  bgColorHsl?: string
}

export default function BottomFadeMask({
  bottomOffsetCss = '0px',
  height = BOTTOM_FADE_HEIGHT_PX,
  edge = 'bottom',
  heightPx,
  pureGradient = false,
  positionMode = 'fixed',
  topOffsetCss = '0px',
  leftOffsetCss = '0px',
  widthCss = '100%',
  zIndex = 40,
  bgColorHsl,
}: BottomFadeMaskProps) {
  const { resolved } = useAppTheme()
  const bg = bgColorHsl ?? COLORS.bgPrimary[resolved]
  const h = heightPx ?? height

  if (pureGradient) {
    // 多端一致规格(Web ScrollEdgeFades 2026-11-10 定档):判据与渐变串构建已纯化
    // (buildPureEdgeGradient,单测直测),行为与抽出前逐字一致。
    const gradient = buildPureEdgeGradient(bg, edge, h)
    return (
      <View
        style={{
          position: positionMode,
          left: leftOffsetCss,
          width: widthCss,
          ...(edge === 'top' ? { top: topOffsetCss } : { bottom: bottomOffsetCss }),
          height: `${h}px`,
          pointerEvents: 'none',
          zIndex,
          backgroundImage: gradient,
        }}
      />
    )
  }

  // ===== 旧形态(custom-tab-bar 胶囊上方,行为与升级前逐字一致)=====
  const c0 = hslToRgba(bg, 0)
  const c70 = hslToRgba(bg, 0.7)
  const c100 = hslToRgba(bg, 1)
  // 渐变段仍只占 `h`(停点用绝对 px,形态与延伸前逐字一致),但本体铺到屏幕底:
  // 胶囊下方的悬浮间距此前没有任何覆盖层,滚动内容经过时会在胶囊底边形成硬切。
  return (
    <View
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        height: `calc(${bottomOffsetCss} + ${h}px)`,
        pointerEvents: 'none',
        zIndex,
        backgroundImage: `linear-gradient(to bottom, ${c0} 0px, ${c0} ${h * 0.22}px, ${c70} ${h * 0.55}px, ${c100} ${h}px, ${c100} 100%)`,
      }}
    />
  )
}
