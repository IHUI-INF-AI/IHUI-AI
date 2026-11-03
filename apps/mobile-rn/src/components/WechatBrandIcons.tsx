// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信系品牌图标(ShareSheet 分享面板):微信好友白色双气泡 + 朋友圈官方七彩光圈。
 *
 * 2026-10-16 用户定:分享面板两个图标此前用 lucide 通用图标(MessageCircle / Users)
 * 冒充品牌图标,辨识度不足,必须换成真实官方图形。
 *
 * - 实现走 inline react-native-svg(同 PanelLeftRounded.tsx 范式),**不得**改用
 *   require('*.svg'):vitest 无 require 垫片,模块顶层 require 图片资源在测试收集期即崩
 *   (见 tests/login-error-identity.test.ts 文件头记录的硬约束);react-native-svg 有现成
 *   vitest mock(tests/__mocks__/react-native-svg.ts)。
 * - 颜色:微信绿底取 OAUTH_BRAND_COLORS.wechat(#07C160 官方品牌绿)、白色前景取
 *   OAUTH_BUTTON_FOREGROUND,均来自 @ihui/design-tokens(平台品牌身份色豁免档)。
 * - 朋友圈光圈 8 片叶色与黑色外环为**官方品牌图形固有色**(参照 oauth-colors.ts 文件头
 *   「平台品牌身份色豁免 token」同一先例),内嵌常量,不并入语义 token。
 * - 几何数据源:微信双气泡取 Simple Icons 官方 wechat path(CC0,viewBox 0 0 24 24);
 *   朋友圈光圈按微信开放平台官方素材 icon_res_download_moments.png(600×600)像素级
 *   实测还原(黑环外半径 ≈220、8 片叶角跨 ≈37.5°/间距 45°、内缘螺旋 136→90、叶色 r=170
 *   逐片采样,均 ÷25 换算到 24 视区)。
 * - 不用 transform="rotate(...)":react-native-svg 各版本对 transform 字符串支持不一,
 *   直接算好绝对坐标输出 path,渲染零风险。
 */
import Svg, { Circle, Path } from 'react-native-svg'
import { OAUTH_BUTTON_FOREGROUND } from '@ihui/design-tokens'

export interface WechatBrandIconProps {
  /** 墨迹 px;缺省 24 对齐 lucide 既有图标尺寸 */
  size?: number
}

/**
 * 微信官方双气泡(大泡套小泡 + 尾芽),Simple Icons simple-icons/wechat 单 path 填充式。
 */
const WECHAT_BUBBLES_PATH =
  'M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213c0 .163.13.295.29.295a.33.33 0 0 0 .167-.054l1.903-1.114a.86.86 0 0 1 .717-.098a10.2 10.2 0 0 0 2.837.403c.276 0 .543-.027.811-.05c-.857-2.578.157-4.972 1.932-6.446c1.703-1.415 3.882-1.98 5.853-1.838c-.576-3.583-4.196-6.348-8.596-6.348M5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178a1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18m5.34 2.867c-1.797-.052-3.746.512-5.28 1.786c-1.72 1.428-2.687 3.72-1.78 6.22c.942 2.453 3.666 4.229 6.884 4.229c.826 0 1.622-.12 2.361-.336a.72.72 0 0 1 .598.082l1.584.926a.3.3 0 0 0 .14.047c.134 0 .24-.111.24-.247c0-.06-.023-.12-.038-.177l-.327-1.233a.6.6 0 0 1-.023-.156a.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983a.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983a.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982'

/** 微信好友位:官方微信绿实底 + 白色双气泡(微信绿/白色均来自 oauth-colors 品牌豁免档) */
export function WechatFriendIcon({ size = 24 }: WechatBrandIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={WECHAT_BUBBLES_PATH} fill={OAUTH_BUTTON_FOREGROUND} />
    </Svg>
  )
}

/**
 * 朋友圈官方七彩光圈 8 片叶色(中线角 → 色),官方素材 r=170 逐片采样:
 * 蓝 / 青 / 绿 / 黄绿 / 黄 / 橙黄 / 橙红 / 紫。
 * 品牌图形固有色豁免 token(同 oauth-colors.ts 文件头先例),改色即失真,勿"统一收编"。
 */
const MOMENTS_LEAF_COLORS = [
  'rgb(90,158,241)', // 0° 蓝
  'rgb(90,229,241)', // 45° 青
  'rgb(94,241,90)', // 90° 绿
  'rgb(186,241,90)', // 135° 黄绿
  'rgb(241,221,90)', // 180° 黄
  'rgb(241,179,90)', // 225° 橙黄
  'rgb(241,118,90)', // 270° 橙红
  'rgb(108,90,241)', // 315° 紫
] as const

/** 图形几何常量(viewBox 24,圆心 12;均自官方 600×600 实测值 ÷25) */
const CENTER = 12
/** 黑色外环中线半径(实测外缘 ≈8.8、环厚 ≈0.5) */
const RING_R = 8.7
const RING_STROKE = 0.5
/** 叶片外缘半径(略压进黑环内缘,不留白缝) */
const PETAL_R_OUT = 8.6
/** 每片角跨(实测 36–38° 取中)与内缘螺旋起止半径(实测 136→约 90) */
const PETAL_SPAN = 37.5
const PETAL_R_IN_LEAD = 5.44
const PETAL_R_IN_TRAIL = 3.55

/** 极坐标 → 屏幕坐标(SVG y 向下,角度增即顺时针,与素材采样约定一致) */
function polar(r: number, deg: number): readonly [number, number] {
  const rad = (deg * Math.PI) / 180
  return [CENTER + r * Math.cos(rad), CENTER + r * Math.sin(rad)] as const
}

const fmt = (n: number): string => String(Math.round(n * 1000) / 1000)

/**
 * 生成单片快门叶片 path(以 mid 为中线角):前缘内点 → 外缘前点 → 顺时针外弧 →
 * 外缘后点 → 后缘内点 → 二次贝塞尔沿内缘螺旋(中角、均半径为控制点)闭合。
 */
function petalPath(mid: number): string {
  const a0 = mid - PETAL_SPAN / 2
  const a1 = mid + PETAL_SPAN / 2
  const [x0, y0] = polar(PETAL_R_IN_LEAD, a0)
  const [x1, y1] = polar(PETAL_R_OUT, a0)
  const [x2, y2] = polar(PETAL_R_OUT, a1)
  const [x3, y3] = polar(PETAL_R_IN_TRAIL, a1)
  const [qx, qy] = polar((PETAL_R_IN_LEAD + PETAL_R_IN_TRAIL) / 2, (a0 + a1) / 2)
  return [
    `M${fmt(x0)} ${fmt(y0)}`,
    `L${fmt(x1)} ${fmt(y1)}`,
    `A${PETAL_R_OUT} ${PETAL_R_OUT} 0 0 1 ${fmt(x2)} ${fmt(y2)}`,
    `L${fmt(x3)} ${fmt(y3)}`,
    `Q${fmt(qx)} ${fmt(qy)} ${fmt(x0)} ${fmt(y0)}`,
    'Z',
  ].join(' ')
}

/** 朋友圈位:黑色外环 + 8 片等角快门叶片(官方七彩光圈) */
export function WechatMomentsIcon({ size = 24 }: WechatBrandIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle
        cx={CENTER}
        cy={CENTER}
        r={RING_R}
        stroke="rgb(0,0,0)"
        strokeWidth={RING_STROKE}
        fill="none"
      />
      {MOMENTS_LEAF_COLORS.map((color, i) => (
        <Path key={color} d={petalPath(i * 45)} fill={color} />
      ))}
    </Svg>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
