// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​​‌​​​‍‍​‌​​‌​​​‍‍​‌​​‌​​​

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top

/**
 * 图标按钮统一样式 token — 全项目图标按钮尺寸/交互单一真相源
 *
 * 2026-09-17 定稿(用户指令):全项目图标按钮只允许 **一种尺寸 32×32**,
 * 禁止 sm/md 多档并存(28/32 两档曾导致关闭按钮与图标按钮不一致)。
 *
 * 规范:
 * - 容器:h-8 w-8(32×32),图标 h-4 w-4(16×16)
 * - 默认态无背景(纯图标 + muted-foreground),hover/active 用 bg-accent 高亮
 * - CloseButton 与 Button 组件 icon 档全部同源本文件,全项目不存在第二种图标按钮尺寸
 *
 * 消费方式:
 * - React:import { IconButton } from '@ihui/ui-react'
 * - 仅要类名:import { ICON_BUTTON_SIZE, ICON_BUTTON_ICON_SIZE } from '@ihui/design-tokens'
 */

/** 图标按钮容器类名(唯一尺寸,32×32) */
export const ICON_BUTTON_SIZE = 'h-8 w-8'

/** 图标按钮内图标类名(16×16) */
export const ICON_BUTTON_ICON_SIZE = 'h-4 w-4'

/** 图标按钮基础类名(尺寸之外共享的视觉) */
export const ICON_BUTTON_BASE_CLASS =
  'inline-flex shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50'

/** 完整容器类名(基础 + 唯一尺寸) */
export function iconButtonClasses(): string {
  return `${ICON_BUTTON_BASE_CLASS} ${ICON_BUTTON_SIZE}`
}

/** 图标类名(唯一尺寸) */
export function iconButtonIconClasses(): string {
  return ICON_BUTTON_ICON_SIZE
}
