import * as React from 'react'
import type { Metadata } from 'next'
import { MarketingHeader } from '@/components/marketing/MarketingHeader'

/**
 * Marketing 路由组布局
 *
 * - Server Component(含 metadata export)
 * - 含 Header,Sidebar + AISidePanel 由根 layout.tsx 的 GlobalShell 全局提供
 * - SiteFooter 由各子页面自行渲染(首页放在 main 滚动流末尾,作为最后一个 snap section,
 *   跟随 main 滚动可见,避免 layout 中悬浮不可达)
 * - metadata:站点级,所有 (marketing) 子路由继承
 *
 * 路由组 (marketing) 不影响 URL 路径:
 *   /(marketing)/page.tsx          → /
 *
 * 结构(填充在 GlobalShell 内容槽内):
 *   div flex-col flex-1 min-h-0 overflow-y-auto bg-background
 *     MarketingHeader  (sticky h-14 = 3.5rem)
 *     children          (首页 main 用 height: calc(100vh - 3.5rem) 独立滚动,
 *                        SiteFooter 在 main 内部末尾,跟随 main 滚动可见)
 *   /div
 *
 * 高度策略:
 * - flex-1 min-h-0:在 GlobalShell 内容槽(flex 容器)中正确填充
 * - overflow-y-auto:为非首页子路由提供滚动能力(首页 main 自带 overflow-y-scroll)
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
  // overflow-x-hidden 兜底,防止子元素(首页 main 内的 Marquee / 跑马灯等
  // transform 动画元素)宽度溢出导致整页可左右滑动。
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto bg-background">
      <MarketingHeader />
      {children}
    </div>
  )
}
