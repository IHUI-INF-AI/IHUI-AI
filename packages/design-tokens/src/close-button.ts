// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 关闭按钮统一样式 token(2026-09-16 立;2026-09-17 与 icon-button.ts 尺寸档位对齐)—
 * 全项目弹窗/抽屉/浮层关闭按钮单一真相源
 *
 * 背景:此前各处关闭按钮样式漂移(dialog/drawer/sheet h-9 w-9 @ right-4 top-4、
 * Modal opacity-70 裸图标、LoginPopup h-5 裸图标…),且大按钮与弹窗标题重叠
 * (2026-09-16 用户反馈)。本文件为唯一规范,所有关闭按钮必须引用以下常量,
 * 禁止在业务代码中手写 right-4 top-4 / h-9 w-9 / opacity-70 等散装样式。
 *
 * 规范值(2026-09-17 与 icon-button.ts 同源统一,全项目图标按钮唯一尺寸):
 * - 尺寸:h-8 w-8(32×32),图标 h-4 w-4(16×16)
 * - 浮层定位:absolute right-3 top-3(贴近右上角,配合 DialogHeader pr-8 避让标题)
 * - 亮底:text-muted-foreground,hover 浅背景 bg-accent
 * - 深底(图片查看器/全屏遮罩):text-white/80,hover bg-white/10
 *
 * 消费方式:
 * - React 组件:import { CloseButton } from '@ihui/ui-react'(优先,自带 X 图标)
 * - 仅要类名字符串(如 Radix DialogPrimitive.Close / SheetPrimitive.Close):
 *   import { CLOSE_BUTTON_BASE, CLOSE_BUTTON_ICON, CLOSE_BUTTON_POSITION, CLOSE_BUTTON_ON_DARK } from '@ihui/design-tokens'
 */

// 尺寸档从 icon-button.ts 复用,避免再开一套尺寸
import { ICON_BUTTON_SIZE, ICON_BUTTON_ICON_SIZE } from './icon-button.js'

/** 浮层(弹窗/抽屉)右上角定位。非浮层场景(标题栏行内)不加此类 */
export const CLOSE_BUTTON_POSITION = 'absolute right-3 top-3'

/** 按钮尺寸(与图标按钮同源唯一尺寸 32×32,2026-09-17 用户指令:全项目只有一种图标按钮尺寸) */
export const CLOSE_BUTTON_SIZE = ICON_BUTTON_SIZE

/** 图标尺寸(16×16,同源) */
export const CLOSE_BUTTON_ICON = ICON_BUTTON_ICON_SIZE

/** 亮底(默认)关闭按钮完整类名——浮层场景自行追加 CLOSE_BUTTON_POSITION */
export const CLOSE_BUTTON_BASE = `inline-flex ${CLOSE_BUTTON_SIZE} shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none`

/** 深底(全屏图片查看器/深色遮罩)关闭按钮完整类名——浮层场景自行追加 CLOSE_BUTTON_POSITION */
export const CLOSE_BUTTON_ON_DARK = `inline-flex ${CLOSE_BUTTON_SIZE} shrink-0 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50 disabled:pointer-events-none`
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
