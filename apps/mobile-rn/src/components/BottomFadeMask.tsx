// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { View } from 'react-native'
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg'
import { tokens } from '../theme/active-tokens'

/**
 * 滚动边缘淡出遮罩(mobile-rn 端;RN 不支持 CSS mask-image,用 react-native-svg 实现)
 *
 * 两种模式:
 * 1) 多端一致「边缘渐变覆盖层」(不传 offsetFromBottom,2026-11-10 与 Web 端定稿同规格):
 *    贴父容器上/下边缘(edge,默认 bottom)的一条纯线性渐变 —— 边缘实底色 → 内侧完全透明,
 *    无实底平台,默认高 24px(heightPx)。pointerEvents 穿透,不挡滚动与点击。
 *    「该方向是否确有溢出」由宿主判定,本组件只负责「显示即贴边」。
 * 2) 旧「悬浮胶囊上方」模式(传 offsetFromBottom,TabBar 胶囊场景在用):保留已定稿的
 *    实底平台几何(前 22% 透明 → 约 55% 处 0.7 → 实底一路铺到屏幕底),行为与视觉不变。
 */
const BOTTOM_FADE_HEIGHT_PX = 90
/** 多端一致规格:边缘渐变覆盖层默认高度(px) */
const EDGE_FADE_HEIGHT_PX = 24

export interface BottomFadeMaskProps {
  /** 旧胶囊模式:渐变段底边距屏幕底的距离(px)= 胶囊悬浮量 + 胶囊高(即胶囊顶沿)。传入即走旧几何 */
  offsetFromBottom?: number
  /** 旧胶囊模式渐变段高度(px),默认 90 */
  height?: number
  /** 新模式:贴滚动视口哪条边缘,默认 'bottom' */
  edge?: 'top' | 'bottom'
  /** 新模式渐变高度(px),默认 24 */
  heightPx?: number
  /** 底色覆盖(默认页面背景令牌 tokens.surface.bg;抽屉等面板场景传面板自身底色) */
  color?: string
}

export default function BottomFadeMask({
  offsetFromBottom,
  height = BOTTOM_FADE_HEIGHT_PX,
  edge = 'bottom',
  heightPx = EDGE_FADE_HEIGHT_PX,
  color,
}: BottomFadeMaskProps) {
  const bg = color ?? tokens.surface.bg

  if (offsetFromBottom === undefined) {
    // 新模式:纯线性,无平台 —— edge 一侧 100% 实底,内侧 0% 完全透明
    return (
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: heightPx,
          pointerEvents: 'none',
          ...(edge === 'top' ? { top: 0 } : { bottom: 0 }),
        }}
      >
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id={`ihuiEdgeFade-${edge}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={bg} stopOpacity={edge === 'top' ? 1 : 0} />
              <Stop offset="100%" stopColor={bg} stopOpacity={edge === 'top' ? 0 : 1} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#ihuiEdgeFade-${edge})`} />
        </Svg>
      </View>
    )
  }

  // ── 旧胶囊模式(以下逐字节保持 2026-11-04 定稿几何,勿动)──
  // 渐变段仍只占 `height`,但本体一路铺到屏幕底:胶囊下方的悬浮间距(floatGap)此前没有任何
  // 覆盖层,滚动内容经过时会在胶囊底边形成硬切(2026-11-04 机主实拍点名「底部那一小段没被覆盖上」)。
  const total = height + offsetFromBottom
  const stop = (px: number) => `${(px / total) * 100}%`
  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: total,
        pointerEvents: 'none',
      }}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="ihuiBottomFade" x1="0" y1="0" x2="0" y2="1">
            {/* 顶部 22% 完全透明:内容照常显示(也包含返回顶部按钮所在区) */}
            <Stop offset="0%" stopColor={bg} stopOpacity={0} />
            <Stop offset={stop(height * 0.22)} stopColor={bg} stopOpacity={0} />
            {/* 更早、更猛地转实底:约 55% 处已达 0.7 不透明,无硬边地溶解进背景 */}
            <Stop offset={stop(height * 0.55)} stopColor={bg} stopOpacity={0.7} />
            <Stop offset={stop(height)} stopColor={bg} stopOpacity={1} />
            {/* 胶囊顶沿以下到屏幕底一律实底,把悬浮间距那段一并盖住 */}
            <Stop offset="100%" stopColor={bg} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#ihuiBottomFade)" />
      </Svg>
    </View>
  )
}
