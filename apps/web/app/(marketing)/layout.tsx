import * as React from 'react'
import type { Metadata } from 'next'
import { MarketingHeader } from '@/components/marketing/MarketingHeader'
import { SiteFooter } from '@/components/marketing/SiteFooter'

/**
 * Marketing 路由组布局
 *
 * - Server Component(含 metadata export)
 * - 含 Header + Footer,不含 sidebar(营销页不需要侧栏)
 * - metadata:站点级,所有 (marketing) 子路由继承
 *
 * 路由组 (marketing) 不影响 URL 路径:
 *   /(marketing)/page.tsx          → /
 *   /(marketing)/about/page.tsx    → /about
 *   /(marketing)/pricing/page.tsx  → /pricing
 *   /(marketing)/contact/page.tsx  → /contact
 *
 * 结构:
 *   div flex-col min-h-screen
 *     MarketingHeader  (sticky h-14 = 3.5rem)
 *     children          (首页用 height: calc(100vh - 3.5rem);其他页正常流)
 *     SiteFooter
 *   /div
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
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingHeader />
      {children}
      <SiteFooter />
    </div>
  )
}
