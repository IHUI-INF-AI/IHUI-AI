// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SectionHeader「区段标题 + 更多」的结构与几何单一源(小程序端与 RN 端共用),形状照 back-chevron-spec。
 *
 * 两端真实实现:
 *  - RN 端唯一实现 = packages/app/src/components/SectionHeader.tsx(features 各屏经 `@ihui/rn-app` 消费);
 *  - 小程序端两条渲染腿 = apps/miniapp-taro/src/components/SectionHeader.tsx(页面直连)
 *    与 apps/miniapp-taro/src/components/adapters/SectionHeader.taro.tsx(pkg-learn/pkg-shop 经适配层),
 *    两条腿同取本表 —— 只改一条就是"把某一条腿改成另一条腿的值却不收进共享源"。
 *
 * 消费方式只能是子路径 `@ihui/shared/ui/section-header-spec`(禁挂根桶)。
 * spec 内只存逻辑 px;小程序端换算 `(px) => rpx(px * TARO_RPX_PER_PX)`,RN 端 1:1。
 *
 * 取值裁决:「更多」入口的字号/箭头不在本表(§4 已定 RN/web 12px、小程序 24rpx,且 RN 侧由
 * MoreLink 单源),本表只管标题区。
 */

/** 每端注入的单位换算(一个逻辑 px 到该平台数值);泛型把单位类型带出来。 */
export type GeometryUnit<U extends string | number> = (px: number) => U

/**
 * 标题字号 16:RN 端现档;小程序端原 28rpx = 14、适配层原 14。规则 2 取可读更稳的一档,
 * 且与 NavBar 标题(16)同档,区段头与页头不再两级分叉。
 */
export const SECTION_HEADER_TITLE_FONT_PX = 16

/** 标题字重 700:两端现值已同(小程序 `font-bold` / RN '700'),收一处防分叉。 */
export const SECTION_HEADER_TITLE_FONT_WEIGHT = '700'

/** 副标题字号 12:两端现值已同(小程序 `text-[length:24rpx]` / RN 12)。 */
export const SECTION_HEADER_SUBTITLE_FONT_PX = 12

/** 副标题与标题间距 8:两端现值已同(小程序 `ml-2` / RN `marginLeft: 8`)。 */
export const SECTION_HEADER_SUBTITLE_GAP_PX = 8

/** 「更多」入口与左侧内容区的间距 8:两端现值已同(小程序 `ml-2` / 适配层 marginLeft 8)。 */
export const SECTION_HEADER_MORE_MARGIN_LEFT_PX = 8

/** 文字与箭头图标间距 2:两端现值已同(小程序 `4rpx` = 2 / 适配层 `toRpx(2)`);取更稳的一档不再放大。 */
export const SECTION_HEADER_ARROW_MARGIN_LEFT_PX = 2

/** 标题区结构:行内水平居中 + 可截断(溢出省略的三件套只在这一处排)。 */
export function sectionHeaderTitleStyle<U extends string | number>(
  toUnit: GeometryUnit<U>,
): {
  fontSize: U
  fontWeight: '700'
  overflow: 'hidden'
  textOverflow: 'ellipsis'
  whiteSpace: 'nowrap'
} {
  return {
    fontSize: toUnit(SECTION_HEADER_TITLE_FONT_PX),
    fontWeight: SECTION_HEADER_TITLE_FONT_WEIGHT,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
