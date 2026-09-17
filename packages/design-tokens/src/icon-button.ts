// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 图标按钮统一样式 token(2026-09-17 立)— 全项目图标按钮尺寸/交互单一真相源
 *
 * 背景:此前各图标按钮尺寸漂移(关闭 28px、标题栏 32px、弹窗 36px…),
 * 用户要求"整个项目统一、只有几种尺寸、统一使用设计 token"。
 *
 * 规范:两档尺寸,与 shadcn 图标按钮惯例对齐
 * - sm(28×28,图标 14×14):关闭、工具条小图标
 * - md(32×32,图标 16×16):标题栏、工具栏、面板控制图标(默认档)
 * 默认态无背景(纯图标 + muted-foreground),hover/active 用 bg-accent 高亮,
 * active/pressed 态(如 terminal 已打开、work panel 折叠)也叠加 bg-accent。
 *
 * 消费方式:
 * - React:import { IconButton } from '@ihui/ui-react'
 * - 仅要类名:import { ICON_BUTTON_SIZE, ICON_BUTTON_CLASSES } from '@ihui/design-tokens'
 */

/** 图标按钮尺寸档位 → 容器类名 */
export const ICON_BUTTON_SIZE = {
  /** 小(28×28),关闭按钮、紧凑工具条 */
  sm: 'h-7 w-7',
  /** 中(32×32),默认档,标题栏/工具栏/面板控制 */
  md: 'h-8 w-8',
} as const

/** 图标按钮尺寸档位 → 图标类名 */
export const ICON_BUTTON_ICON_SIZE = {
  /** sm 容器内图标 14×14 */
  sm: 'h-3.5 w-3.5',
  /** md 容器内图标 16×16 */
  md: 'h-4 w-4',
} as const

export type IconButtonSize = keyof typeof ICON_BUTTON_SIZE

/** 图标按钮基础类名(尺寸之外共享的视觉) */
export const ICON_BUTTON_BASE_CLASS =
  'inline-flex shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50'

/** 按尺寸生成完整类名(含尺寸 + 图标尺寸) */
export function iconButtonClasses(size: IconButtonSize = 'md'): string {
  return `${ICON_BUTTON_BASE_CLASS} ${ICON_BUTTON_SIZE[size]}`
}

/** 按尺寸生成图标类名 */
export function iconButtonIconClasses(size: IconButtonSize = 'md'): string {
  return ICON_BUTTON_ICON_SIZE[size]
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
