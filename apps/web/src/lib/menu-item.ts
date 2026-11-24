// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { cn } from '@/lib/utils'

/**
 * 菜单行视觉唯一源(2026-11-15 收敛)。
 *
 * 背景:菜单行此前在 20+ 个文件里各抄一份 px/py/rounded/hover 组合,同一个 AI 面板
 * 溢出菜单内「任务回顾」因为抄成了 `hover:bg-accent` + 14px 灰图标,而其余项是
 * Radix Item + 24px 继承色图标 —— 行高、图标大小、键盘高亮三种观感同时分叉。
 *
 * 约束:
 *  - Radix `DropdownMenu.Item` 与自绘 `role="menuitem"` 的行必须引用本文件;
 *  - 四态同源:hover(鼠标)/ focus(键盘)/ data-[highlighted](Radix 高亮)/ disabled;
 *  - 颜色只用实色 token(hover/focus 都是 accent 实色,不做透明度微调);
 *  - 行内直属 svg 统一 14px,避免再出现 24px / 14px 两套图标尺寸。
 */
export const MENU_ITEM_BASE_CLASS =
  'flex w-full min-w-0 cursor-default select-none items-center gap-2 rounded-sm text-left text-label text-popover-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus-visible:outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&>svg]:size-3.5 [&>svg]:shrink-0'

/** 标准菜单行(左右 10px / 上下 6px):下拉项、自绘 menuitem 一律用它 */
export const MENU_ITEM_CLASS = cn(MENU_ITEM_BASE_CLASS, 'px-2.5 py-1.5')

/** 菜单行前置图标:低对比色,与分组标题同源(尺寸由 MENU_ITEM_CLASS 统一) */
export const MENU_ITEM_ICON_CLASS = 'shrink-0 text-muted-foreground'

/** 菜单行标签:占满剩余宽度并单行截断 */
export const MENU_ITEM_LABEL_CLASS = 'min-w-0 flex-1 truncate'

/** 菜单行尾部勾选/状态图标(继承行文字色,不改成 muted) */
export const MENU_ITEM_CHECK_CLASS = 'ml-auto shrink-0'

/** 菜单行尾部进入箭头 */
export const MENU_ITEM_CHEVRON_CLASS = 'ml-auto h-2.5 w-2.5 shrink-0 text-muted-foreground'

/** 菜单分组标题(与菜单行左内边距对齐) */
export const MENU_ITEM_SECTION_CLASS =
  'block px-2.5 pb-0.5 pt-1 text-caption font-medium text-muted-foreground'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
