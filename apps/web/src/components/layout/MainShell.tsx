'use client'

import * as React from 'react'
import { TagsView } from '@/components/layout/TagsView'
import { useAuthStore } from '@/stores/auth'
import { useMounted } from '@/hooks/use-mounted'

/**
 * MainShell — (main) 路由组的工作区面板容器(2026-07-19 重构)
 *
 * 重构说明:
 * - 原 MainShell 同时承担"全局骨架(Sidebar + AISidePanel + PWA)"与"工作区面板样式"两职责,
 *   且仅在 (main) 路由组的 layout 中挂载,导致 (marketing)/(auth)/sso/h5/forbidden 等路由
 *   无法享用左侧 Sidebar 与右侧 AI 对话框这两个全局组件。
 * - 现已将"全局骨架"职责拆分到新组件 GlobalShell(挂载于根 layout.tsx),
 *   让所有路由共享 Sidebar + AISidePanel。
 * - 本 MainShell 仅保留"工作区面板样式"职责:圆角卡片容器 + TagsView + 可滚动 main + padding。
 * - 仅 (main) 路由组使用本组件(由 app/(main)/layout.tsx 套用)。
 *
 * 结构(填充在 GlobalShell 的内容槽内):
 *   <div flex-1 flex-col my-2 mr-2 rounded-xl bg-shell-panel>   ← 圆角卡片容器
 *     <TagsView />                                              ← 已登录才显示
 *     <main id="main" flex-1 overflow-y-auto p-4 md:p-6 lg:p-8>
 *       {children}
 *     </main>
 *   </div>
 *
 * 工作区面板样式说明:
 * - my-2 mr-2:与 GlobalShell 的 Sidebar 之间留 8px 间距,与视口顶部/底部留 8px 间距
 * - rounded-xl bg-shell-panel:圆角卡片背景,营造"工作区"的视觉容器感
 * - main 的 p-4 md:p-6 lg:p-8:响应式 padding,内容不贴边
 * - main 的 thin-scroll flex-1 overflow-y-auto:细滚动条 + 独立滚动
 */
export function MainShell({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  // hydration-safe: 首屏不渲染 TagsView,挂载后再按真实态渲染,避免 SSR/CSR 不一致
  const mounted = useMounted()
  const showTagsView = mounted && isAuthenticated

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-shell-panel my-2 mr-2">
      {showTagsView && (
        <React.Suspense fallback={null}>
          <TagsView />
        </React.Suspense>
      )}
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
