// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 浮层(悬浮窗 / 菜单 / 提示气泡)几何单一源。
 *
 * 2026-11-16 立:Radix Popper 的 `collisionPadding` 缺省为 0,浮层撞到视口边缘时会被
 * 紧贴屏幕边缘裁停 —— 侧栏标题 Tooltip 实测 left=0。凡走 Radix Portal 的浮层
 * (tooltip / dropdown-menu / select / popover / context-menu)统一取本档作为
 * 与视口的最小安全间距,禁止各调用点再写裸数字。
 *
 * 取值 8:与 AI 浮窗拖动夹紧档 AI_FLOAT_MARGIN(8)同一档,竖向/横向一致。
 */
export const FLOATING_VIEWPORT_PADDING_PX = 8
