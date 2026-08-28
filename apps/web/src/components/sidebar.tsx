'use client'

/**
 * Sidebar 组件的公共入口(barrel)。
 *
 * 2026-08-28 重构:原 ~2303 行的巨型文件已拆分为语义子模块(见同目录 sidebar/):
 *   - sidebar/types.ts            导航项 / 组件 props 类型
 *   - sidebar/nav-data.ts         所有导航分组数据 + 派生常量(NAV_GROUPS / ALL_NAV_HREFS / FLAT_NAV_ITEMS / LANGUAGES)
 *   - sidebar/SidebarActions.tsx  底部工具栏(语言/下载/消息/主题/设置)
 *   - sidebar/SidebarUserRow.tsx  底部用户区(登录 / 头像下拉)
 *   - sidebar/NavLink.tsx         普通导航项
 *   - sidebar/ExpandableNavItem.tsx 可展开二级菜单(折叠态走 Dropdown)
 *   - sidebar/NavGroupSection.tsx 顶级分组(分组级折叠)
 *   - sidebar/SidebarHeader.tsx   顶栏 Logo + 折叠/关闭按钮(桌面/移动两种形态)
 *   - sidebar/SidebarQuickActions.tsx 顶部快捷操作(新建任务/插件市场/自动化)
 *   - sidebar/Sidebar.tsx         Sidebar 主组件(组合以上子组件 + 宽度拖拽/乐观路由)
 *
 * 本文件仅作为稳定公共 API 层:所有外部 importer(如 GlobalShell、path-labels)
 * 继续从 '@/components/sidebar' 导入,无需改动。
 */

import { Sidebar } from './sidebar/Sidebar'

/**
 * 侧边栏宽度常量(2026-07-17 统一,2026-08-01 默认宽度+最小宽度同步加大)
 * - 160px 是展开态默认宽度(桌面 + 移动抽屉复用)
 * - 60px 是折叠态宽度,只显图标
 * - 桌面端展开态支持拖拽调整,范围 160-180px(2026-08-01:最小宽度从 130 加大到 160,跟默认值一致)
 *
 * ⚠️ 保留在 barrel 原位置:scripts/check-sidebar-width-consistency.mjs 守门脚本
 * 通过正则 `const\s+SIDEBAR_WIDTH\s*=\s*(\d+)` 校验本文件,确保与 design-tokens.css 的
 * --sidebar-width 一致。请勿移到子模块,否则该守门会报"未找到 SIDEBAR_WIDTH 常量"。
 */
const SIDEBAR_WIDTH = 160
const SIDEBAR_MIN_WIDTH = 160
const SIDEBAR_MAX_WIDTH = 180
const SIDEBAR_COLLAPSED_WIDTH = 60
const SIDEBAR_WIDTH_STORAGE_KEY = 'sidebar-width'

// 导出供子模块(./sidebar/Sidebar)复用,避免 noUnusedLocals 误报;
// 同时保留本文件 `const SIDEBAR_WIDTH = 160` 字面量,供 check-sidebar-width-consistency.mjs 校验。
export {
  SIDEBAR_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_WIDTH_STORAGE_KEY,
}

// 主导航项尺寸常量已迁移到 `@/lib/nav-styles` 共享模块(2026-07-19 立)。
// 保留本文件重新导出仅为向后兼容外部引用(如 TagsView 旧版可能 import)。
// 未来新代码请直接 import from '@/lib/nav-styles'。
export {
  NAV_ITEM_BASE_CLASS,
  NAV_ITEM_COLLAPSED_CLASS,
  NAV_ITEM_EXPANDED_CLASS,
} from '@/lib/nav-styles'

export { NAV_GROUPS, ALL_NAV_HREFS, FLAT_NAV_ITEMS } from './sidebar/nav-data'

export { Sidebar }
export default Sidebar
