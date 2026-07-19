import * as React from 'react'
import type { Metadata } from 'next'
import { MarketingHeader } from '@/components/marketing/MarketingHeader'
import { SiteFooter } from '@/components/marketing/SiteFooter'

/**
 * Marketing 路由组布局
 *
 * - Server Component(含 metadata export)
 * - 含 Header + Footer,Sidebar + AISidePanel 由根 layout.tsx 的 GlobalShell 全局提供
 *   (2026-07-19 重构:不再单独说明"不含 sidebar",因为 Sidebar 现已是全局组件)
 * - metadata:站点级,所有 (marketing) 子路由继承
 *
 * 路由组 (marketing) 不影响 URL 路径:
 *   /(marketing)/page.tsx          → /
 *   /(marketing)/about/page.tsx    → /about
 *   /(marketing)/pricing/page.tsx  → /pricing
 *   /(marketing)/contact/page.tsx  → /contact
 *
 * 结构(填充在 GlobalShell 内容槽内):
 *   div flex-col flex-1 min-h-0 overflow-y-auto bg-background
 *     MarketingHeader  (sticky h-14 = 3.5rem)
 *     children          (首页用 height: calc(100vh - 3.5rem);其他页正常流)
 *     SiteFooter        (在内容流末尾,可由外层 overflow-y-auto 滚动可见)
 *   /div
 *
 * 高度策略:
 * - flex-1 min-h-0:在 GlobalShell 内容槽(flex 容器)中正确填充并允许子元素滚动
 * - overflow-y-auto:让 SiteFooter 可通过此容器滚动可见
 *   (原 min-h-screen 设计依赖 body 滚动,但 GlobalShell 用 h-screen overflow-hidden 锁定视口,
 *    改为容器自身滚动以保留"SiteFooter 在视口下方可见"的原始体验)
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
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      <MarketingHeader />
      {children}
      <SiteFooter />
    </div>
  )
}
