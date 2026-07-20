import * as React from 'react'
import type { Metadata } from 'next'

/**
 * Marketing 路由组布局
 *
 * - Server Component(含 metadata export)
 * - Sidebar + AISidePanel 由根 layout.tsx 的 GlobalShell 全局提供(全站统一导航)
 * - 与 (main) 路由组 MainShell 同款卡片容器结构:rounded-xl + bg-shell-panel + my-2 mr-2
 * - 已移除 MarketingHeader(2026-07-20):sidebar 已含全部 6 个路由
 *   (enterprise/learn/agents/news/ai-world/dashboard)+ 登录入口 + 品牌 logo,
 *   MarketingHeader 是纯冗余,违反"左侧侧边栏统一导航"项目设定
 * - SiteFooter 由各子页面自行渲染(首页放在 main 滚动流末尾,作为最后一个 snap section,
 *   跟随 main 滚动可见,避免 layout 中悬浮不可达)
 *
 * 路由组 (marketing) 不影响 URL 路径:
 *   /(marketing)/page.tsx          → /
 *
 * 结构(填充在 GlobalShell 内容槽内):
 *   div rounded-xl bg-shell-panel my-2 mr-2 overflow-hidden
 *     children          (首页 main 用 height: calc(100vh - 1rem) 独立滚动,
 *                        SiteFooter 在 main 内部末尾,跟随 main 滚动可见)
 *   /div
 *
 * 高度策略:
 * - flex-1 min-h-0:在 GlobalShell 内容槽(flex 容器)中正确填充
 * - overflow-hidden:裁剪子元素溢出 + 保持圆角不被覆盖
 * - my-2 mr-2:与 GlobalShell 的 Sidebar 之间留 8px 间距,与视口顶部/底部留 8px 间距
 */
export const metadata: Metadata = {
  title: {
    default: '智汇 AI 社区 — AI 时代企业理性效率伙伴',
    template: '%s | 智汇 AI',
  },
  description:
    'AI 时代企业理性效率服务与互助社群。帮助决策者深度理解 AI 与企业的关系,构建人机协同的超级组织,实现企业的理性效率提升。',
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    siteName: '智汇 AI 社区',
  },
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-shell-panel my-2 mr-2">
      {children}
    </div>
  )
}
