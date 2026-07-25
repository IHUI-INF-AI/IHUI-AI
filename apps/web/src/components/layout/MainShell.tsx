'use client'

import * as React from 'react'
import { useAuthStore } from '@/stores/auth'
import { useMounted } from '@/hooks/use-mounted'

/**
 * MainShell — (main) 路由组的工作区面板容器(2026-07-19 重构)
 *
 * 2026-07-25 重大修订:
 * - 原职责:工作区面板样式(圆角容器 + TagsView + 可滚动 main + padding)
 * - 现职责:仅保留可滚动 main + padding(顶栏下方唯一容器)
 * - TagsView 已上移至 GlobalShell(2026-07-25 用户反馈:右侧工作展示区顶部那块空白需填满),
 *   跨路由组共享,所有路由都享受同一套标签栏
 * - 圆角容器 my-2 mr-2 保留,与 Sidebar 留 8px 间距,与视口边缘留 8px 间距
 *
 * 工作区面板样式说明:
 * - my-2 mr-2:与 GlobalShell 的 Sidebar 之间留 8px 间距,与视口顶部/底部留 8px 间距
 * - main 的 p-4 md:p-6 lg:p-8:响应式 padding,内容不贴边
 * - main 的 thin-scroll flex-1 overflow-y-auto:细滚动条 + 独立滚动
 */
export function MainShell({ children }: { children: React.ReactNode }) {
  // hydration-safe: 首屏不渲染需要 auth 的内容
  const mounted = useMounted()
  // 显式订阅以触发 (main) 路由组的认证态变化
  useAuthStore((s) => s.isAuthenticated)
  // HMR touch trigger: 2026-07-25 22:55

  return (
    // 2026-07-25 用户反馈:去掉 bg-shell-panel,顶栏(透明背景)和下方工作区容器完全融合,没有"细线"分隔
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl my-2 mr-2">
      <main
        id="main"
        tabIndex={-1}
        className="thin-scroll flex-1 overflow-y-auto p-4 md:p-6 lg:p-8"
      >
        {children}
      </main>
    </div>
  )
}

export default MainShell
