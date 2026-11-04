// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { View } from 'react-native'
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg'
import { tokens } from '../theme/active-tokens'

/**
 * 底部平滑淡出遮罩(mobile-rn 端)
 *
 * 贴在悬浮胶囊正上方的内容区底部:从透明(顶)渐变到页面背景色(底),
 * 让滚动内容在接近底部胶囊前平滑「溶解」,任何位置都不出现硬边。
 *
 * 层级:在内容之上、胶囊之下(`pointerEvents:'none'`,不挡滚动与点击)。
 * 真实模糊由胶囊玻璃承接(内容滚到胶囊底下被真实模糊);本层只负责「无硬边过渡」。
 *
 * 几何:渐变段占 `height`,其底边距屏幕底 = `offsetFromBottom`(一般 = 胶囊悬浮量 + 胶囊高,
 * 即胶囊顶沿);本体自渐变段顶一路铺到屏幕底,故胶囊下方的悬浮间距也被实底盖住(不留硬边)。
 * 渐变在靠近胶囊的最后约 55% 高度内由透明平滑转实底(约 55% 处已达 0.7 不透明,
 * 比初版更早更猛),故胶囊上方 ~100px 处的「返回顶部」按钮仍落在透明区,不受影响。
 */
const BOTTOM_FADE_HEIGHT_PX = 120

export interface BottomFadeMaskProps {
  /** 渐变段底边距屏幕底的距离(px):一般 = 胶囊悬浮量 + 胶囊高(即胶囊顶沿) */
  offsetFromBottom: number
  /** 渐变段高度(px),默认 120 */
  height?: number
}

export default function BottomFadeMask({
  offsetFromBottom,
  height = BOTTOM_FADE_HEIGHT_PX,
}: BottomFadeMaskProps) {
  const bg = tokens.surface.bg
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
