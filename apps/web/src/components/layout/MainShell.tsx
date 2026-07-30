'use client'

import * as React from 'react'
import { useAuthStore } from '@/stores/auth'

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
    // 外层 wrapper:底部 8px + 右侧 8px 间距(与 GlobalTopBar 顶部 8px + 左右 8px 互补,
    // 共同构成 work-area 周围的 8px 视觉缓冲)。
    // 顶部间距由 GlobalTopBar 内部 pt-2 提供(统一管理,与 8 方向 resize 区域避让对齐)。
    <div className="flex min-h-0 flex-1 flex-col pb-2 pr-2 cursor-default">
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
          className="no-scrollbar flex-1 overflow-y-auto p-4 md:p-6 lg:p-8"
        >
          {children}
        </main>
      </div>
    </div>
  )
}

export default MainShell
