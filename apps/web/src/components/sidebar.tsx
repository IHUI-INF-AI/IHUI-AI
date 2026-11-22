// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * Sidebar 组件的公共入口(barrel)。
 *
 * 2026-08-28 重构:原 ~2303 行的巨型文件已拆分为语义子模块(见同目录 sidebar/):
 *   - sidebar/types.ts            导航项 / 组件 props 类型
 *   - sidebar/nav-data.ts         所有导航分组数据 + 派生常量(NAV_GROUPS / ALL_NAV_HREFS / FLAT_NAV_ITEMS / LANGUAGES)
 *   - sidebar/SidebarUserRow.tsx  底部用户区(登录 / 头像下拉;2026-09-21 起语言/下载/消息/主题/设置工具项已并入其下拉菜单)
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
import { rnGeometry } from '@ihui/design-tokens'

/**
 * 侧边栏宽度常量 —— **全部引用几何档,本文件不再持有任何数字**(2026-11-07 收口)。
 *
 * 为什么必须引用而不是就地写数字:侧栏/抽屉宽度在仓里有四个消费者 ——
 * web 常驻侧栏(本文件)、web 移动端抽屉(Sidebar.tsx 同一份 state)、
 * RN 左抽屉(`apps/mobile-rn/src/components/Drawer.tsx`)、小程序左抽屉
 * (`apps/miniapp-taro/src/components/DrawerComponent.tsx`)。此前 web 这四个
 * 数字是字面量、RN/小程序读 `drawerWidth` 档,两边"数值碰巧相等"而不是同源,
 * 于是出现"RN 250 / web 160"的跨端差(2026-11-07 机主定档统一为 160)。
 * 现在四个端都从 `GEOMETRY_PX` 取同一个数:改 `packages/design-tokens/src/geometry.js`
 * 一处,三端同时生效。
 *
 * - `drawerWidth`           160:展开态默认宽度(下限恒等于它,不另列档)
 * - `sidebarMaxWidth`       180:桌面拖拽上限
 * - `sidebarCollapsedWidth`  60:折叠态宽度(只显图标)
 *
 * ⚠️ 仍保留在 barrel 原位置:scripts/check-sidebar-width-consistency.mjs 守门脚本
 * 会解析本文件,校验「四枚常量确实引用 rnGeometry.* 且不含数字字面量」,并拿几何档
 * 与 tokens.css 的 --sidebar-width / --sidebar-collapsed-width 对账。请勿移到子模块,
 * 也勿改回 `const SIDEBAR_WIDTH = 160` 这种写法,否则该门直接判红。
 */
const SIDEBAR_WIDTH = rnGeometry.drawerWidth
const SIDEBAR_MIN_WIDTH = rnGeometry.drawerWidth
const SIDEBAR_MAX_WIDTH = rnGeometry.sidebarMaxWidth
const SIDEBAR_COLLAPSED_WIDTH = rnGeometry.sidebarCollapsedWidth
const SIDEBAR_WIDTH_STORAGE_KEY = 'sidebar-width'

// 导出供子模块(./sidebar/Sidebar)复用,避免 noUnusedLocals 误报;
// 同时保留本文件的声明形态,供 check-sidebar-width-consistency.mjs 校验引用关系。
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
