// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * NavBar 顶部导航栏的结构与几何单一源(小程序端与 RN 端共用),形状照 back-chevron-spec。
 *
 * 两端真实实现:apps/miniapp-taro/src/components/NavBar.tsx ↔ apps/mobile-rn/src/components/NavBar.tsx。
 * (packages/app/src/components/NavBar.tsx 是 div/span 形态的 DOM 副本,不在 RN 屏幕上渲染,
 *  不消费本文件 —— 移动端取景只量这两条腿。)
 *
 * 消费方式只能是子路径 `@ihui/shared/ui/navbar-spec`(禁挂根桶,根桶会把整棵 src/chat 拉进被检程序)。
 * spec 内只存逻辑 px;小程序端换算 `(px) => rpx(px * TARO_RPX_PER_PX)`,RN 端 1:1。
 *
 * 取值裁决(两端分叉时的定档依据,AGENTS.md §4 / O81 交付标准):
 *  1. web 端同一元素有既有值 → 取 web;
 *  2. 否则取触控与可读更稳的一档(字号 ≥12、间距取两端较大者);
 *  3. 平台机制不同的数值对齐、通道各端保留 —— 见文件末 MECHANISM_WAIVERS。
 */
import { GEOMETRY_PX } from '@ihui/design-tokens'

/** 每端注入的单位换算(一个逻辑 px 到该平台数值);泛型把单位类型带出来。 */
export type GeometryUnit<U extends string | number> = (px: number) => U

/**
 * 标题行高 44:RN 端现档(44 = iOS 标准导航栏高,亦是触控可读的稳档)。
 * 小程序端行高由微信胶囊实测推导(menuButton.height + 8),属平台机制,见 waives 第 1 条。
 */
export const NAVBAR_ROW_HEIGHT_PX = 44

/** 带副标题时的行高 56:RN 端现档;副标题是双行文本,单行档装不下。 */
export const NAVBAR_ROW_HEIGHT_SUBTITLE_PX = 56

/** 左右内边距 10:两端现值已同(小程序 ai-home `20rpx` = 10px,RN `paddingHorizontal: 10`),收进一处防分叉。 */
export const NAVBAR_SIDE_PADDING_PX = 10

/** 侧占位宽 32:RN 端无内容侧的标题居中补偿;取两端较大者(小程序右钮 h-8 = 32)。 */
export const NAVBAR_SIDE_PLACEHOLDER_PX = 32

/**
 * 返回命中块 36:直接引用 GEOMETRY_PX.tapBox(web 顶栏 `w-9` = 36px,守门 46 的唯一档)。
 * RN 端此前自写 32×32 —— 规则 1,web 有既有值,收口到 36。
 */
export const NAVBAR_BACK_BOX_PX = GEOMETRY_PX.tapBox

/** 返回箭头墨迹 20:引用 GEOMETRY_PX.glyphMd;RN 端此前自写 24,小程序 BackChevron 已是 20。 */
export const NAVBAR_BACK_GLYPH_PX = GEOMETRY_PX.glyphMd

/** 侧按钮最小宽 28:RN 端 2026-09-23 P1 修复的既定格(给标题留横向空间,勿回升);小程序端原 20px 盒收口到 28。 */
export const NAVBAR_ACTION_MIN_WIDTH_PX = 28

/** 侧按钮高 32:RN 端现档;小程序端 rightText `h-8` = 32px,两端同值收一处。 */
export const NAVBAR_ACTION_HEIGHT_PX = 32

/** 侧按钮图标墨迹 20:引用 GEOMETRY_PX.glyphMd(小程序 ai-home 菜单钮已是 40rpx=20px,RN 18→20)。 */
export const NAVBAR_ACTION_GLYPH_PX = GEOMETRY_PX.glyphMd

/** 侧按钮文字 14:取两端较大者(小程序 rightText 14px vs RN actionLabel 12),规则 2 可读更稳。 */
export const NAVBAR_ACTION_LABEL_FONT_PX = 14

/**
 * 标题字号 16:web 顶栏标题档 + RN 端 2026-09-23 P1 修复定格(18→16,防"智汇AI"截断);
 * 小程序 ai-home 15px / 默认 16px 统一收口到 16。
 */
export const NAVBAR_TITLE_FONT_PX = 16

/** 副标题字号 12:两端现值已同(RN 12 / 共享层 12)。 */
export const NAVBAR_SUBTITLE_FONT_PX = 12

/** 副标题与主标题间距 2:RN 端现档,与小程序端无对立取值。 */
export const NAVBAR_SUBTITLE_MARGIN_TOP_PX = 2

/**
 * 侧按钮盒子:最小宽 + 定高 + 行内水平居中(图标与文字并排),居中原语只在这一处。
 * 返回类型由泛型带出单位,禁止退化成 string | number(RN ViewStyle 编译不过,实测 TS1360)。
 */
export function navbarActionBoxStyle<U extends string | number>(
  toUnit: GeometryUnit<U>,
): {
  minWidth: U
  height: U
  display: 'flex'
  flexDirection: 'row'
  alignItems: 'center'
  justifyContent: 'center'
} {
  return {
    minWidth: toUnit(NAVBAR_ACTION_MIN_WIDTH_PX),
    height: toUnit(NAVBAR_ACTION_HEIGHT_PX),
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  }
}

/**
 * 本族的平台机制差异登记(数值对齐、通道各端保留;主会话写入台账 waivers 用):
 *  1. 导航栏总高:小程序端 = 微信胶囊实测(menuButton.top 状态栏占位 + menuButton.height + 8 行高),
 *     RN 端 = 状态栏由 App.tsx SafeAreaView 单点注入 + NAVBAR_ROW_HEIGHT_PX(44)。两端行高不要求同数
 *     (胶囊高度是设备/微信版本决定的平台量),但几何常量已同表。
 *  2. 返回键按下反馈:小程序 hoverClass,RN activeOpacity/pressed 样式 —— 同一弱化语义两种载体。
 *  3. RN 端 hitSlop(top/bottom/left/right 扩张命中)在小程序没有等价通道,小程序靠盒子本身尺寸,
 *     故盒子档(28/32/36)按双方都可点稳的档取。
 */
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
