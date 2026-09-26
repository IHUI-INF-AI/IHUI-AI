// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Menu 网格的结构与几何单一源(小程序端与 RN 端共用),形状照 back-chevron-spec。
 *
 * 两端能在同一档上对齐的是**格子结构**(图块盒子、图文间距、行内留白、每行列数);
 * 图标载体不同(小程序走 CDN PNG + emoji 兜底,RN 只有 Image)属平台/功能差异,不在本文件表达。
 *
 * 消费方式只能是子路径 `@ihui/shared/ui/menu-spec`(禁挂根桶)。
 */

/** 每端注入的单位换算(一个逻辑 px 到该平台数值);泛型把单位类型带出来。 */
export type GeometryUnit<U extends string | number> = (px: number) => U

/** 每行列数:两端默认值都是 4,收进一处后改一端即改两端。 */
export const MENU_DEFAULT_COLUMNS = 4

/**
 * 图块边长 40:小程序 `w-10 h-10` = 40、RN `icon.width` = 40 两端同档;
 * RN 的 `height: 44` 是手抄漂移(守门 128 立项点名的正是这一型),现按 40 方档收口。
 */
export const MENU_TILE_PX = 40

/** 标签字号 12:两端现值已同(小程序 `text-xs` / RN `fontSize: 12`)。 */
export const MENU_LABEL_FONT_PX = 12

/** 图块与标签之间 8:小程序 `gap-2` = 8、RN `marginTop: 8` —— 同一个空间两种机制,数字收一处。 */
export const MENU_LABEL_GAP_PX = 8

/** 单格上下留白 8:小程序 `py-2` = 8 vs RN `paddingVertical: 10` —— 取紧凑档(AGENTS.md §4 compact)。 */
export const MENU_ITEM_PADDING_Y_PX = 8

/** 图块盒子:方档 + 居中(兜底位要在 40×40 里把 emoji 排正),居中原语只在这一处。 */
export function menuTileStyle<U extends string | number>(
  toUnit: GeometryUnit<U>,
): {
  width: U
  height: U
  display: 'flex'
  alignItems: 'center'
  justifyContent: 'center'
} {
  return {
    width: toUnit(MENU_TILE_PX),
    height: toUnit(MENU_TILE_PX),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }
}

/** 单格结构:竖排 + 水平居中 + 图文间距 + 上下留白(拆成 top/bottom:CSSProperties 不认 paddingVertical)。 */
export function menuItemStyle<U extends string | number>(
  toUnit: GeometryUnit<U>,
): {
  display: 'flex'
  flexDirection: 'column'
  alignItems: 'center'
  gap: U
  paddingTop: U
  paddingBottom: U
} {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: toUnit(MENU_LABEL_GAP_PX),
    paddingTop: toUnit(MENU_ITEM_PADDING_Y_PX),
    paddingBottom: toUnit(MENU_ITEM_PADDING_Y_PX),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
