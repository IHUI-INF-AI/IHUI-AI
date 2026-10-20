// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 底部悬浮玻璃胶囊的几何量(小程序端唯一出处)
 *
 * 本文件一律**转发** @ihui/shared/ui/tab-bar-spec —— 两端底部胶囊是同一个界面元素,尺子只许
 * 有一份。此前两端各写一份同名量、靠两份头注互指维持,而跨端门 128 按「同名成对文件」配对
 * 看不见这一族(两边文件名不同)⇒ 已在门 128 台账登记 TabBar 别名配对,这一族从此有判据。
 *
 * 高/留边自 2026-10-20 起取 62 / 10(与 RN 同值):用户定稿「底部菜单栏的高宽要跟 AI 输入框
 * 一致」。留边这一维两端同时成立 —— 本端首页 ai-home 输入栏写的是 `padding: '10rpx 20rpx 20rpx'`,
 * 20rpx 在 750 设计稿下 = 10 逻辑像素,与 RN 的 INPUT_AREA_CONTAINER_PADDING_X_PX 是同一档。
 * 高度这一维两端不同形(本端输入栏是原项目 rpx 复刻的紧凑条,行高另成一档),取的是「两端胶囊
 * 同值」优先;把本端输入栏抬到同一档不在本票射程。
 *
 * px 在微信里就是逻辑像素,与 RN 的 dp 同尺,不做 rpx 换算。
 *
 * 为什么单独成模块:自定义 tabBar 是浮层(实测 systemInfo.windowHeight == screenHeight),
 * 它不压缩页面视口 ⇒ 每个 tab 页都要自己让出底部距离,这个量必须和组件用的是同一个数。
 */
import {
  TAB_BAR_FONT_SIZE_ACTIVE_PX,
  TAB_BAR_FONT_SIZE_PX,
  TAB_BAR_GAP_BOTTOM_MINIAPP_PX,
  TAB_BAR_GLOW_RADIUS_PX as TAB_BAR_GLOW_RADIUS_SRC_PX,
  TAB_BAR_HEIGHT_PX,
  TAB_BAR_ICON_SIZE_PX,
  TAB_BAR_INDICATOR_H_PX,
  TAB_BAR_MARGIN_H_PX,
} from '@ihui/shared/ui/tab-bar-spec'

export const TAB_BAR_HEIGHT = TAB_BAR_HEIGHT_PX
export const TAB_BAR_ICON_SIZE = TAB_BAR_ICON_SIZE_PX
export const TAB_BAR_FONT_SIZE = TAB_BAR_FONT_SIZE_PX
/**
 * 选中态字号(比未选中大 1px)—— 2026-10-20 用户定稿「选中时文字稍微放大加粗」;
 * 本端字重 600 早已在位,这一档补的是字号那一半。
 */
export const TAB_BAR_FONT_SIZE_ACTIVE = TAB_BAR_FONT_SIZE_ACTIVE_PX
/** 胶囊与屏幕左右边缘的悬浮间距 */
export const TAB_BAR_MARGIN_H = TAB_BAR_MARGIN_H_PX
/** 胶囊与页面底部的最小悬浮间距(不含安全区)—— 与 RN 那枚兜底档语义不同,各取各的(见 spec 注) */
export const TAB_BAR_GAP_BOTTOM = TAB_BAR_GAP_BOTTOM_MINIAPP_PX
/** 选中态顶部指示条高度 */
export const TAB_BAR_INDICATOR_H = TAB_BAR_INDICATOR_H_PX

/**
 * 选中态光晕半径(px)。颜色一律走 CSS 变量(--color-brand-accent-deep),端内不得出现裸 hex。
 */
export const TAB_BAR_GLOW_RADIUS_PX = TAB_BAR_GLOW_RADIUS_SRC_PX

/**
 * 浮层胶囊实际占掉的底部高度(不含安全区):胶囊高 + 它与屏幕底的悬浮间距。
 * 页面里 `position: fixed` 且贴底的元素(如首页输入栏)要按这个量抬到胶囊之上。
 */
export const TAB_BAR_OCCUPIED_PX = TAB_BAR_HEIGHT + TAB_BAR_GAP_BOTTOM
/** 胶囊顶边到屏幕底的距离(含安全区),供 fixed 元素做 bottom 偏移 */
export const TAB_BAR_OCCUPIED_CSS = `calc(${TAB_BAR_OCCUPIED_PX}px + env(safe-area-inset-bottom))`

/**
 * tab 页滚动内容底部留位(CSS 值):胶囊高 + 悬浮间距 + 呼吸位,安全区由 env() 追加。
 * 用法:`<ScrollView style={{ paddingBottom: TAB_BAR_PAGE_RESERVE_CSS }}>`
 */
export const TAB_BAR_PAGE_RESERVE_CSS = `calc(${TAB_BAR_OCCUPIED_PX + 16}px + env(safe-area-inset-bottom))`
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
