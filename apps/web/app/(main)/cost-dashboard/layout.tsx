// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// Cost Dashboard 成本看板页 metadata(SEO):服务端 wrapper 注入唯一 title/OG,区别于工作区通用标题。

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    absolute: '成本看板 Cost Dashboard | IHUI AI',
  },
  description:
    'IHUI AI 成本看板:全链路 Agent 调用成本账本聚合,按工具/模型拆分与时间走势,总成本、Token、耗时、步数一目了然,对标 Claude Code/Codex 成本透明可观测。',
  alternates: { canonical: '/cost-dashboard' },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    title: '成本看板 Cost Dashboard | IHUI AI',
    description: 'IHUI AI 成本看板:总成本 / Token / 耗时 / 步数,按工具与模型拆分的条 + 时间走势。',
    url: 'https://aizhs.top/cost-dashboard',
    siteName: 'IHUI AI',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'IHUI AI 成本看板' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '成本看板 Cost Dashboard | IHUI AI',
    description: 'IHUI AI 成本看板,全链路 Agent 成本透明可观测。',
    images: ['/og-image.png'],
  },
}

export default function CostDashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
