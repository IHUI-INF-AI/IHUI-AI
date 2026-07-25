'use client'

import * as React from 'react'
import { useAuthStore } from '@/stores/auth'
import { useMounted } from '@/hooks/use-mounted'
import { TagsView } from '@/components/layout/TagsView'

/**
 * MainShell — (main) 路由组的工作区面板容器(2026-07-19 重构)
 *
 * 2026-07-25 重大修订:
 * - 恢复 bg-shell-panel 背景色(用户反馈:右列背景丢失)
 *   "细线"问题根因在 NativeTopBar 的 border-b,已在那里去掉,MainShell 恢复背景色不会引入分隔线
 * - TagsView 从 GlobalShell 移入 MainShell,只覆盖 main 同宽容器
 *   不再横跨整个右列(work-area-portal-root + WebWorkPanel)
 * - 圆角容器 my-2 mr-2 保留,与 Sidebar 留 8px 间距,与视口边缘留 8px 间距
 *
 * 工作区面板样式说明:
 * - my-2 mr-2:与 GlobalShell 的 Sidebar 之间留 8px 间距,与视口顶部/底部留 8px 间距
 * - TagsView 在 main 上方,mt-2 + h-9 (36px),与 main 同宽(被外层 rounded-xl my-2 mr-2 约束)
 * - main 的 p-4 md:p-6 lg:p-8:响应式 padding,内容不贴边
 * - main 的 thin-scroll flex-1 overflow-y-auto:细滚动条 + 独立滚动
 */
export function MainShell({ children }: { children: React.ReactNode }) {
  // hydration-safe: 订阅 mount 状态以触发 hydration 同步(useMounted 副作用)
  useMounted()
  // 显式订阅以触发 (main) 路由组的认证态变化
  useAuthStore((s) => s.isAuthenticated)

  return (
    // 2026-07-26 用户反馈:恢复 bg-shell-panel 背景色(NativeTopBar 那边 border-b 已去掉,
    // 顶栏与下方工作区容器无"细线"分隔,背景色不会再引入那条线)
    <div className="bg-shell-panel relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl my-2 mr-2">
      {/* 2026-07-26 用户反馈:TagsView 放在 MainShell 内,只覆盖 main 同宽容器,
          不会横跨 WebWorkPanel。占满"右侧工作展示区最上面那块空白区域"的同时
          严格匹配 main 宽度。SSR 安全(无 mounted 守卫,首帧直接渲染 placeholder) */}
      <React.Suspense fallback={null}>
        <TagsView />
      </React.Suspense>
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
