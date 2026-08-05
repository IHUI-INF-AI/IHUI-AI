'use client'

import * as React from 'react'
import { useAuthStore } from '@/stores/auth'
import { GlobalErrorBanner } from '@/components/common/GlobalErrorBanner'

/**
 * MainShell — (main) 路由组的工作区卡片容器(2026-07-30 第十四次修订:精简)
 *
 * 历史沿革(2026-07-30 修订):
 * - 原 MainShell 内含顶栏(拖拽 + 窗口控制 + TagsView + Globe 入口)
 * - 现顶栏逻辑已迁移至 GlobalTopBar(GlobalShell 全局挂载,所有路由组共享)
 * - MainShell 仅保留"工作区卡片"容器:bg-shell-panel 圆角卡片 + main 内容槽
 *
 * 布局:
 *   <div pb-2 pr-2 min-h-0 flex-1>           ← 外层 wrapper(底部 8px + 右侧 8px,与 GlobalTopBar 的 pt-2/px-2 互补)
 *     <div bg-shell-panel rounded-xl flex-1>   ← 工作区卡片
 *       <main p-4>{children}</main>
 *     </div>
 *   </div>
 *
 * 显式订阅 useAuthStore 触发 (main) 路由组认证态变化重渲染(原顶栏副作用保留)。
 * 桌面端(Tauri)逻辑(8 方向 resize + 窗口控制 + 拖拽 + 主题跟随 + 托盘状态)
 * 全部迁移到 GlobalTopBar,本组件仅承担工作区卡片容器职责。
 *
 * 平台独占:仅 web 端,desktop Tauri 桌面端特殊行为由 GlobalTopBar 接管。
 */
export function MainShell({ children }: { children: React.ReactNode }) {
  // 显式订阅以触发 (main) 路由组的认证态变化(2026-07-30:从原顶栏副作用保留)
  useAuthStore((s) => s.isAuthenticated)

  return (
    // 外层 wrapper:底部 + 右侧各 8px 间距(与 GlobalTopBar 顶部 8px + 左右 8px 互补,
    // 共同构成 work-area 周围的 8px 视觉缓冲)。
    // 顶部间距由 GlobalTopBar 内部 pt-2 提供(统一管理,与 8 方向 resize 区域避让对齐)。
    // 左侧间距由 AISidePanel 容器 mr-1.5 (6px) 提供(打开态=面板右边缘到卡片左边缘 6px;
    // 关闭态=width=0 + mr-1.5 = 6px 占位),此处不再加 pl-2 避免叠加导致 14px 错乱。
    //
    // pl-[var(--topbar-content-left)](2026-08-01 立,根治移动端错位):
    // 移动端(<1024px)顶栏第 0 个元素是汉堡按钮(mobileMenu),占 ml-1.5(6)+w-9(36)+gap-1(4)=46px,
    // 把搜索按钮挤到 left=46px。本 pl 让工作区卡片对齐搜索按钮 left,消除 46px 错位。
    // 桌面端(≥1024px)汉堡按钮 hidden,--topbar-content-left=0px,pl 不生效。
    //
    // ⚠️ 变量值来源(2026-08-01 根治方案):
    // - SSR 首屏:globals.css :root + @media (min-width:1024px) 硬编码 fallback(46px/0px)
    // - JS 执行后:GlobalTopBar 的 ResizeObserver 动态测量搜索按钮实际 left,用 inline style
    //   覆盖(优先级 > stylesheet)。工作区卡片自动跟随 mobileMenu 样式变化,无需手动同步。
    //   详见 GlobalTopBar.tsx useEffect 注释。
    // - 历史根因:旧方案纯硬编码,依赖 mobileMenu 的 ml-1.5/w-9/gap-1,样式变化即失效
    //   → "反反复复修不好"。新方案动态测量根治。
    <div className="flex min-h-0 flex-1 flex-col pb-2 pr-2 pl-[var(--topbar-content-left)] cursor-default">
      {/* 工作区卡片:仅包含 main 内容
          - bg-shell-panel rounded-xl 保持卡片视觉
          - flex-1 + min-h-0 填充剩余高度
          - overflow-hidden 裁剪子元素溢出 + 保持圆角不被覆盖
          - cursor-default:覆盖外层(工作区内是默认光标) */}
      <div
        className="bg-shell-panel relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl cursor-default"
        data-workspace-card
      >
        <main
          id="main"
          tabIndex={-1}
          // 2026-08-01 用户要求"完全去掉 padding,内容占满工作内容展示区":
          // 原 p-3 → laptop:p-8(桌面 32px 四边留白)导致编辑器等所有页面四边有留白,
          // 用户反馈"为啥不占满啊"。现改为无 padding,内容完全贴工作区卡片边缘。
          // 各页面如需内部留白应自行在页面组件内设置(如 about 的 px-4 py-8 已自带)。
          // 2026-08-05 性能优化:content-visibility:auto + contain-intrinsic-size:1000px
          // 让浏览器跳过副屏外内容的渲染,显著提升首帧渲染速度。
          className="no-scrollbar flex-1 overflow-y-auto [content-visibility:auto] [contain-intrinsic-size:1000px]"
        >
          {/* 2026-08-01 全局错误通知条:从顶部滑下,常驻直到用户关闭
              (用户需求:internet server error 这种错误提示应该从页面上面滑下来,常驻直到错误解决) */}
          <GlobalErrorBanner />
          {children}
        </main>
      </div>
    </div>
  )
}

export default MainShell
